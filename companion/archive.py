"""Validated portable recording format; no credentials or filesystem paths."""
import math
import re

MAX_BYTES = 64 * 1024 * 1024
MAX_SAMPLES = 200000


def reject_constant(value):
    raise ValueError('Non-finite JSON numbers are not allowed.')


def number(value):
    return type(value) in (int, float) and math.isfinite(value)


def annotation(value):
    if not isinstance(value, dict):
        raise ValueError('Session details must be an object.')
    result = {}
    for key in ('track', 'layout', 'direction', 'mode', 'weather', 'timeOfDay', 'bop', 'notes'):
        text = value.get(key, '')
        if not isinstance(text, str) or len(text) > (2000 if key == 'notes' else 120):
            raise ValueError('Invalid or oversized session details.')
        result[key] = text.strip()
    for key in ('fuelMultiplier', 'tyreMultiplier'):
        val = value.get(key)
        if val is not None and (not number(val) or not 0 <= val <= 100):
            raise ValueError('Invalid session multiplier.')
        result[key] = val
    return result


def validate(bundle):
    if not isinstance(bundle, dict) or bundle.get('format') != 'gt-paddock-session' or bundle.get('version') != 1:
        raise ValueError('Choose a GT Paddock version 1 full-session backup. Legacy or summary-only exports cannot be imported.')
    session, samples = bundle.get('session'), bundle.get('samples')
    if not isinstance(session, dict) or not isinstance(samples, list) or not 1 <= len(samples) <= MAX_SAMPLES:
        raise ValueError('Backup must contain 1 to 200,000 samples.')
    if not isinstance(session.get('id'), str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', session['id']):
        raise ValueError('Invalid session ID.')
    if type(session.get('car_id')) is not int or session['car_id'] < 0 or session.get('source') not in ('console', 'simulation'):
        raise ValueError('Invalid car or recording source.')
    if session.get('state') not in ('completed', 'interrupted', None):
        raise ValueError('Finish the driving session before exporting a backup.')
    if any(not number(session.get(k)) for k in ('started_at', 'ended_at', 'top_speed')) or session['ended_at'] < session['started_at'] or session['top_speed'] < 0:
        raise ValueError('Invalid session times or speed.')
    if session.get('samples') != len(samples):
        raise ValueError('Sample count does not match: this backup may be incomplete.')
    laps = session.get('laps')
    if not isinstance(laps, list) or len(laps) > 10000:
        raise ValueError('Invalid lap list.')
    for lap in laps:
        if not isinstance(lap, dict) or type(lap.get('lap')) is not int or not number(lap.get('time_ms')) or lap['time_ms'] <= 0:
            raise ValueError('Invalid lap timing.')
    previous = None
    cleaned_samples = []
    for sample in samples:
        if not isinstance(sample, dict) or not number(sample.get('captured_at')) or not number(sample.get('speed')) or sample['speed'] < 0:
            raise ValueError('Invalid telemetry sample.')
        timestamp = sample['captured_at']
        if previous is not None and timestamp < previous or not session['started_at'] <= timestamp <= session['ended_at']:
            raise ValueError('Sample timestamps are inconsistent.')
        if sample.get('car_id') != session['car_id'] or sample.get('on_track') is not True or sample.get('paused') is not False or sample.get('loading') is not False:
            raise ValueError('Backup contains non-driving or mismatched-car samples.')
        for key in ('rpm', 'gear', 'lap', 'throttle', 'brake'):
            if not number(sample.get(key)):
                raise ValueError('Missing or invalid driving channel: ' + key)
        for key in ('fuel', 'last_lap_ms', 'best_lap_ms'):
            if sample.get(key) is not None and not number(sample[key]):
                raise ValueError('Invalid optional telemetry channel.')
        tyres = sample.get('tyres')
        if not isinstance(tyres, list) or len(tyres) != 4 or any(v is not None and not number(v) for v in tyres):
            raise ValueError('Invalid tyre temperatures.')
        if type(sample.get('packet_id')) is not int or type(sample.get('lap')) is not int:
            raise ValueError('Invalid packet or lap identifier.')
        clean_sample = {key: sample[key] for key in ('captured_at', 'car_id', 'packet_id', 'speed', 'rpm', 'gear', 'lap', 'throttle', 'brake', 'on_track', 'paused', 'loading', 'tyres')}
        clean_sample.update({key: sample.get(key) for key in ('fuel', 'last_lap_ms', 'best_lap_ms')})
        clean_sample['source'] = session['source']
        cleaned_samples.append(clean_sample)
        previous = timestamp
    # Retain only recording data, not arbitrary top-level metadata.
    clean = {key: session[key] for key in ('id', 'car_id', 'source', 'started_at', 'ended_at', 'top_speed', 'samples', 'laps')}
    clean.update(state=session.get('state') or 'completed', end_reason='imported_backup')
    for key in ('gaps', 'active_seconds', 'last_lap'):
        if key in session:
            if not number(session[key]) or session[key] < 0:
                raise ValueError('Invalid session metadata.')
            clean[key] = session[key]
    return clean, cleaned_samples, annotation(bundle.get('annotation', {}))
