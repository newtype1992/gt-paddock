"""Loopback-only GT7 companion. Secrets are kept out of URLs and recording files."""
import argparse
import getpass
import ipaddress
import json
import math
import os
import secrets
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from core import Recorder, normalize
from archive import MAX_BYTES, reject_constant


def private_ipv4(value):
    ip = ipaddress.ip_address(value)
    allowed = any(ip in ipaddress.ip_network(n) for n in ('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'))
    if ip.version != 4 or not allowed or str(ip).endswith('.255'):
        raise argparse.ArgumentTypeError('Use the PlayStation private IPv4 address on your home network.')
    return str(ip)


class Cloud:
    def __init__(self):
        self.url = os.environ['GT7_SUPABASE_URL'].rstrip('/')
        if not self.url.startswith('https://'):
            raise ValueError('Cloud sync requires HTTPS.')
        self.key = os.environ['GT7_SUPABASE_PUBLISHABLE_KEY']
        self.access = None
        self.session = self.request('/auth/v1/token?grant_type=password',
                                    {'email': input('GT Paddock email: '), 'password': getpass.getpass('GT Paddock password: ')})
        self.access = self.session['access_token']
        self.refresh_at = time.time() + self.session.get('expires_in', 3600) - 120

    def request(self, path, body):
        headers = {'apikey': self.key, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates'}
        if self.access:
            headers['Authorization'] = 'Bearer ' + self.access
        req = urllib.request.Request(self.url + path, data=json.dumps(body).encode(), headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            content = response.read()
            return json.loads(content) if content else None

    def sync(self, status, sessions):
        if time.time() >= self.refresh_at:
            self.session = self.request('/auth/v1/token?grant_type=refresh_token', {'refresh_token': self.session['refresh_token']})
            self.access = self.session['access_token']
            self.refresh_at = time.time() + self.session.get('expires_in', 3600) - 120
        owner = self.session['user']['id']
        self.request('/rest/v1/gt7_live?on_conflict=owner_id', {'owner_id': owner, 'payload': status})
        if sessions:
            self.request('/rest/v1/gt7_sessions?on_conflict=id', [{'id': s['id'], 'owner_id': owner, 'payload': s} for s in sessions])


def main():
    parser = argparse.ArgumentParser(description='GT Paddock console telemetry companion')
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--ps-ip', type=private_ipv4)
    source.add_argument('--simulate', action='store_true', help='Explicitly labeled test data; never console data')
    parser.add_argument('--port', type=int, default=4181)
    parser.add_argument('--origin', action='append', default=['http://127.0.0.1:4178', 'http://localhost:4178'])
    parser.add_argument('--cloud', action='store_true')
    parser.add_argument('--pairing-window', action='store_true', help='Show the local pairing window instead of printing the code')
    parser.add_argument('--data-dir', default=str(Path(__file__).parent / 'recordings'))
    args = parser.parse_args()
    cloud = Cloud() if args.cloud else None
    Path(args.data_dir).mkdir(parents=True, exist_ok=True)
    token = os.environ.get('GT7_PAIRING_TOKEN') or secrets.token_urlsafe(24)
    stop = threading.Event()
    lock = threading.Lock()
    errors = {'receiver': None, 'cloud': None}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def respond(self, code, value):
            self.send_response(code)
            origin = self.headers.get('Origin')
            if origin in args.origin:
                self.send_header('Access-Control-Allow-Origin', origin)
                self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(value, allow_nan=False).encode())

        def permitted(self):
            return self.headers.get('Host') in (f'127.0.0.1:{args.port}', f'localhost:{args.port}') and self.headers.get('Origin') in args.origin

        def do_OPTIONS(self):
            self.respond(204 if self.permitted() else 403, {})

        def do_GET(self):
            if not self.permitted():
                return self.respond(403, {'error': 'Origin not allowed'})
            if not secrets.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + token):
                return self.respond(401, {'error': 'Pairing code is invalid'})
            parsed = urlparse(self.path)
            with lock:
                if parsed.path == '/status':
                    payload = {**recorder.status(), 'errors': errors.copy(), 'cloud_enabled': bool(cloud)}
                elif parsed.path == '/sessions':
                    payload = recorder.sessions()
                elif parsed.path == '/export':
                    session_id = parse_qs(parsed.query).get('session', [''])[0]
                    payload = recorder.history(session_id)
                elif parsed.path == '/backup':
                    try:
                        payload = recorder.bundle(parse_qs(parsed.query).get('session', [''])[0])
                        if len(json.dumps(payload).encode()) > MAX_BYTES or len(payload['samples']) > 200000:
                            return self.respond(413, {'error': 'Backup exceeds the portable format limit (64 MiB / 200,000 samples). Preserve the SQLite database instead.'})
                    except ValueError as exc:
                        return self.respond(400, {'error': str(exc)})
                else:
                    return self.respond(404, {'error': 'Not found'})
            self.respond(200, payload)

        def do_POST(self):
            if not self.permitted():
                return self.respond(403, {'error': 'Origin not allowed'})
            if not secrets.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + token):
                return self.respond(401, {'error': 'Pairing code is invalid'})
            if self.path not in ('/annotations', '/import'):
                return self.respond(404, {'error': 'Not found'})
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                return self.respond(415, {'error': 'JSON required'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= (MAX_BYTES if self.path == '/import' else 16384):
                    return self.respond(413, {'error': 'Request exceeds size limit'})
                self.connection.settimeout(15)
                data = json.loads(self.rfile.read(size), parse_constant=reject_constant)
                if not isinstance(data, dict):
                    raise ValueError('Expected a JSON object.')
                with lock:
                    result = recorder.import_bundle(data) if self.path == '/import' else recorder.save_annotation(data.get('id'), data.get('annotation'))
                self.respond(200, result)
            except FileExistsError as exc:
                self.respond(409, {'error': str(exc)})
            except (ValueError, TypeError, UnicodeError) as exc:
                self.respond(400, {'error': str(exc)})
            except (OSError, sqlite3.Error):
                self.respond(500, {'error': 'Could not store recording. Check disk space and retry.'})

    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    db_path = Path(args.data_dir) / ('simulation.sqlite' if args.simulate else 'gt7.sqlite')
    if db_path.exists():
        with sqlite3.connect(db_path) as source_db, sqlite3.connect(str(db_path) + '.startup-backup') as backup_db:
            source_db.backup(backup_db)
    recorder = Recorder(str(db_path), 'simulation' if args.simulate else 'console')
    pairing_window = None
    if args.pairing_window:
        try:
            from pairing_window import PairingWindow
            pairing_window = PairingWindow(token, 'Simulation' if args.simulate else args.ps_ip)
        except Exception as exc:
            server.server_close()
            raise RuntimeError('Pairing window unavailable. Install Python with Tcl/Tk, or launch without --pairing-window for terminal pairing.') from exc

    def receive():
        try:
            if args.simulate:
                start = time.time()
                counter = 0
                while not stop.wait(0.1):
                    elapsed = time.time() - start
                    counter += 1
                    sample = {'packet_id': counter, 'car_id': 0, 'captured_at': time.time(), 'speed': 120 + 80 * math.sin(elapsed / 4),
                              'rpm': 5500 + 2000 * math.sin(elapsed / 4), 'gear': 4, 'fuel': max(0, 60 - elapsed / 100),
                              'throttle': max(0, 80 * math.sin(elapsed / 4)), 'brake': max(0, -80 * math.sin(elapsed / 4)),
                              'lap': int(elapsed // 20) + 1, 'last_lap_ms': 20000 if elapsed >= 20 else None,
                              'best_lap_ms': 20000 if elapsed >= 20 else None, 'tyres': [82, 84, 80, 81],
                              'paused': False, 'loading': False, 'on_track': True}
                    with lock:
                        recorder.accept(sample)
            else:
                from granturismo import Feed
                with Feed(args.ps_ip) as feed:
                    while not stop.is_set():
                        packet = feed.get_latest(timeout=1)
                        if packet is not None:
                            with lock:
                                recorder.accept(normalize(packet))
                        stop.wait(0.1)
        except Exception as exc:
            errors['receiver'] = f'Receiver stopped: {type(exc).__name__}. Check the console address and UDP port 33740.'
            print(errors['receiver'], flush=True)

    def upload():
        while not stop.wait(5):
            with lock:
                status, sessions = recorder.status(), recorder.sessions()
            try:
                cloud.sync(status, sessions)
                errors['cloud'] = None
            except Exception as exc:
                errors['cloud'] = f'Cloud sync failed ({type(exc).__name__}); recordings remain on this PC.'

    def lifecycle():
        while not stop.wait(1):
            with lock:
                recorder.tick()

    print(f'GT Paddock companion: http://127.0.0.1:{args.port}', flush=True)
    if pairing_window:
        print('Pairing code is available in the GT Paddock Companion window.', flush=True)
    else:
        print(f'Pairing code: {token}', flush=True)
    print('SIMULATION DATA' if args.simulate else f'Waiting for GT7 on {args.ps_ip}', flush=True)
    receiver_thread = threading.Thread(target=receive, daemon=True)
    lifecycle_thread = threading.Thread(target=lifecycle, daemon=True)
    receiver_thread.start()
    lifecycle_thread.start()
    if cloud:
        threading.Thread(target=upload, daemon=True).start()
    server_thread = None
    try:
        if pairing_window:
            server_thread = threading.Thread(target=server.serve_forever, daemon=True)
            server_thread.start()
            pairing_window.run()
        else:
            server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        receiver_thread.join(timeout=1)
        lifecycle_thread.join(timeout=1)
        if server_thread:
            server.shutdown()
            server_thread.join(timeout=5)
            try:
                pairing_window.destroy()
            except Exception:
                pass
        with lock:
            recorder.finish('companion_shutdown')
        server.server_close()
        if not receiver_thread.is_alive() and not lifecycle_thread.is_alive():
            recorder.db.close()


if __name__ == '__main__':
    main()
