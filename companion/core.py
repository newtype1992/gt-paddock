"""GT7 packet normalization and durable recording, independent of network transport."""
import json
import math
import sqlite3
import time
import uuid
from archive import annotation, validate


def finite(value, default=None):
    return value if isinstance(value, (int, float)) and math.isfinite(value) else default


def normalize(packet):
    return {
        'packet_id': packet.packet_id, 'car_id': packet.car_id,
        'captured_at': packet.received_time,
        'speed': max(0, finite(packet.car_speed, 0) * 3.6),
        'rpm': max(0, finite(packet.engine_rpm, 0)),
        'gear': packet.current_gear, 'fuel': finite(packet.gas_level),
        'throttle': min(100, max(0, packet.throttle / 255 * 100)),
        'brake': min(100, max(0, packet.brake / 255 * 100)),
        'lap': packet.lap_count, 'last_lap_ms': packet.last_lap_time,
        'best_lap_ms': packet.best_lap_time,
        'tyres': [finite(getattr(packet.wheels, corner).temperature) for corner in
                  ('front_left', 'front_right', 'rear_left', 'rear_right')],
        'paused': packet.flags.paused, 'loading': packet.flags.loading_or_processing,
        'on_track': packet.flags.car_on_track,
    }


class Recorder:
    def __init__(self, path, source='console'):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.execute('pragma journal_mode=WAL')
        self.db.executescript('''
          create table if not exists sessions(id text primary key, payload text not null);
          create table if not exists samples(session_id text, captured_at real, payload text);
          create index if not exists samples_session on samples(session_id, captured_at);
          create table if not exists annotations(session_id text primary key, payload text not null);
        ''')
        self.source = source
        self.current = None
        self.previous = None
        self.latest = None
        self.last_active_at = 0
        self.inactive_since = None
        self.last_finished = None
        # Recover only sessions written with the new explicit lifecycle fields.
        for row in self.db.execute('select id, payload from sessions').fetchall():
            session = json.loads(row[1])
            if session.get('state') in ('recording', 'paused', 'signal_lost'):
                session.update(state='interrupted', end_reason='companion_restart')
                self.db.execute('update sessions set payload=? where id=?', (json.dumps(session), row[0]))
        self.db.commit()

    def save_current(self):
        if self.current:
            self.db.execute('insert or replace into sessions values (?,?)', (self.current['id'], json.dumps(self.current)))
            self.db.commit()

    def finish(self, reason):
        if not self.current:
            return
        self.current['state'] = 'interrupted' if reason in ('signal_loss', 'companion_shutdown') else 'completed'
        self.current['end_reason'] = reason
        self.save_current()
        self.last_finished = self.current
        self.current = None
        self.previous = None
        self.inactive_since = None

    def tick(self, now=None):
        now = time.time() if now is None else now
        if not self.current or not self.latest:
            return
        silence = now - self.latest['captured_at']
        if silence > 10:
            self.finish('signal_loss')
        elif silence > 3:
            if self.current['state'] != 'signal_lost':
                self.current['state'] = 'signal_lost'
                self.save_current()
        elif self.inactive_since is not None and now - self.inactive_since > 5:
            self.finish('left_track')

    def accept(self, sample):
        self.tick(sample['captured_at'])
        if self.latest and sample['packet_id'] == self.latest['packet_id']:
            return
        was_paused = self.latest and self.latest.get('paused')
        self.latest = {**sample, 'source': self.source}
        if sample['loading'] or not sample['on_track']:
            self.finish('left_track')
            self.previous = None
            return
        if sample['paused']:
            # A pause or gap makes the currently observed lap incomplete.
            self.previous = None
            if self.current:
                if sample['paused']:
                    self.inactive_since = None
                    if self.current['state'] != 'paused':
                        self.current['state'] = 'paused'
                        self.save_current()
                elif self.inactive_since is None:
                    self.inactive_since = sample['captured_at']
            return
        gap = sample['captured_at'] - self.last_active_at
        changed = self.current and (self.current['car_id'] != sample['car_id'] or
                  (sample.get('lap') is not None and sample['lap'] < self.current.get('last_lap', 0)))
        if changed:
            self.finish('car_changed' if self.current['car_id'] != sample['car_id'] else 'lap_reset')
        self.inactive_since = None
        if not self.current:
            self.current = {'id': str(uuid.uuid4()), 'car_id': sample['car_id'],
                            'started_at': sample['captured_at'], 'ended_at': sample['captured_at'],
                            'laps': [], 'top_speed': 0, 'source': self.source, 'samples': 0,
                            'state': 'recording', 'gaps': 0, 'active_seconds': 0}
            self.previous = None
        elif gap > 1 and not was_paused:
            self.current['gaps'] += 1
        self.current['state'] = 'recording'
        self.current['last_lap'] = sample.get('lap') or 0
        if self.previous and 0 < gap <= 1:
            self.current['active_seconds'] += gap
        if self.previous and gap <= 2 and sample.get('lap') == (self.previous.get('lap') or 0) + 1:
            lap_ms = sample.get('last_lap_ms')
            if finite(lap_ms, 0) > 0:
                self.current['laps'].append({'lap': self.previous['lap'], 'time_ms': lap_ms})
        self.current['ended_at'] = sample['captured_at']
        self.current['samples'] += 1
        self.current['top_speed'] = max(self.current['top_speed'], sample['speed'])
        self.db.execute('insert or replace into sessions values (?,?)', (self.current['id'], json.dumps(self.current)))
        self.db.execute('insert into samples values (?,?,?)', (self.current['id'], sample['captured_at'], json.dumps(self.latest)))
        self.db.commit()
        self.previous = sample
        self.last_active_at = sample['captured_at']

    def sessions(self):
        result = []
        for payload, details in self.db.execute('select s.payload, a.payload from sessions s left join annotations a on a.session_id=s.id order by s.rowid desc limit 50'):
            session = json.loads(payload)
            if details is not None:
                session['annotation'] = json.loads(details)
            result.append(session)
        return result

    def save_annotation(self, session_id, value):
        if not self.db.execute('select 1 from sessions where id=?', (session_id,)).fetchone():
            raise ValueError('Session not found.')
        details = annotation(value)
        with self.db:
            self.db.execute('insert or replace into annotations values (?,?)', (session_id, json.dumps(details)))
        return details

    def bundle(self, session_id):
        if self.current and self.current['id'] == session_id:
            raise ValueError('Finish the driving session before exporting a backup.')
        row = self.db.execute('select payload from sessions where id=?', (session_id,)).fetchone()
        if not row:
            raise ValueError('Session not found.')
        details = self.db.execute('select payload from annotations where session_id=?', (session_id,)).fetchone()
        samples = [json.loads(r[0]) for r in self.db.execute('select payload from samples where session_id=? order by captured_at', (session_id,))]
        return {'format': 'gt-paddock-session', 'version': 1,
                'session': json.loads(row[0]), 'annotation': json.loads(details[0]) if details else {}, 'samples': samples}

    def import_bundle(self, bundle):
        session, samples, details = validate(bundle)
        if session['source'] != self.source:
            raise ValueError('Simulation and console recordings must remain separate.')
        if self.db.execute('select 1 from sessions where id=?', (session['id'],)).fetchone():
            raise FileExistsError('This session already exists. Nothing was overwritten.')
        with self.db:
            self.db.execute('insert into sessions values (?,?)', (session['id'], json.dumps(session)))
            self.db.executemany('insert into samples values (?,?,?)', ((session['id'], s['captured_at'], json.dumps(s, allow_nan=False)) for s in samples))
            self.db.execute('insert into annotations values (?,?)', (session['id'], json.dumps(details)))
        return {**session, 'annotation': details}

    def history(self, session_id):
        return [json.loads(row[0]) for row in self.db.execute('select payload from samples where session_id=? order by captured_at limit 36000', (session_id,))]

    def status(self):
        self.tick()
        return {'sample': self.latest, 'stale': not self.latest or time.time() - self.latest['captured_at'] > 3,
                'session': self.current, 'last_session': self.last_finished, 'source': self.source,
                'recording_state': self.current['state'] if self.current else 'waiting',
                'diagnostics': {'sample_rate_target_hz': 10, 'silence_seconds': round(max(0, time.time() - self.latest['captured_at']), 1) if self.latest else None}}
