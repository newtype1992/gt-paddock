import copy
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
import urllib.error
from core import Recorder
from test_core import sample


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = str(Path(self.folder.name) / 'source.sqlite')
        self.recorder = Recorder(self.path)
        self.recorder.accept(sample())
        self.recorder.accept(sample(2, 2))
        self.recorder.finish('left_track')
        self.id = self.recorder.sessions()[0]['id']
        self.recorder.save_annotation(self.id, {'track': 'Test circuit', 'notes': 'Keep this note', 'fuelMultiplier': 3})

    def tearDown(self):
        self.recorder.db.close()
        self.folder.cleanup()

    def test_round_trip_persists_details_and_samples(self):
        bundle = self.recorder.bundle(self.id)
        destination = Recorder(str(Path(self.folder.name) / 'restored.sqlite'))
        try:
            destination.import_bundle(json.loads(json.dumps(bundle)))
            self.assertEqual(destination.history(self.id), self.recorder.history(self.id))
            self.assertEqual(destination.sessions()[0]['annotation']['notes'], 'Keep this note')
            with self.assertRaises(FileExistsError):
                destination.import_bundle(bundle)
            self.assertEqual(len(destination.history(self.id)), 2)
        finally:
            destination.db.close()
        self.recorder.db.close()
        self.recorder = Recorder(self.path)
        self.assertEqual(self.recorder.sessions()[0]['annotation']['track'], 'Test circuit')

    def test_invalid_import_is_atomic(self):
        for change in ('count', 'offtrack', 'version', 'oversized_note', 'channel'):
            bundle = copy.deepcopy(self.recorder.bundle(self.id))
            bundle['session']['id'] = 'invalid-' + change
            if change == 'count': bundle['session']['samples'] = 999
            if change == 'offtrack': bundle['samples'][0]['on_track'] = False
            if change == 'version': bundle['version'] = 99
            if change == 'oversized_note': bundle['annotation']['notes'] = 'x' * 2001
            if change == 'channel': bundle['samples'][0]['rpm'] = 'invalid'
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.recorder.import_bundle(bundle)
        self.assertEqual(len(self.recorder.sessions()), 1)
        self.assertEqual(self.recorder.db.execute('select count(*) from samples').fetchone()[0], 2)

    def test_full_backup_not_analysis_limit(self):
        row = self.recorder.history(self.id)[0]
        with self.recorder.db:
            self.recorder.db.executemany('insert into samples values (?,?,?)',
                ((self.id, row['captured_at'], json.dumps(row)) for _ in range(36000)))
        self.assertEqual(len(self.recorder.history(self.id)), 36000)
        self.assertEqual(len(self.recorder.bundle(self.id)['samples']), 36002)

    def test_active_backup_rejected(self):
        self.recorder.accept(sample(3))
        with self.assertRaises(ValueError): self.recorder.bundle(self.recorder.current['id'])

    def test_write_api_auth_and_round_trip(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        process = subprocess.Popen([sys.executable, str(Path(__file__).with_name('main.py')),
            '--simulate', '--port', str(port), '--data-dir', self.folder.name],
            env={**os.environ, 'GT7_PAIRING_TOKEN': 'archive-test-token'}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        def request(path, body=None, token='archive-test-token', origin='http://127.0.0.1:4178'):
            req = urllib.request.Request(f'http://127.0.0.1:{port}' + path,
                data=None if body is None else json.dumps(body).encode(),
                headers={'Origin': origin, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
            with urllib.request.urlopen(req, timeout=5) as response:
                return json.load(response)
        try:
            for _ in range(50):
                try:
                    request('/status')
                    break
                except urllib.error.URLError: time.sleep(0.1)
            bundle = self.recorder.bundle(self.id)
            bundle['session']['source'] = 'simulation'
            for token, origin, code in [('bad', 'http://127.0.0.1:4178', 401), ('archive-test-token', 'https://untrusted.example', 403)]:
                with self.assertRaises(urllib.error.HTTPError) as error:
                    request('/import', bundle, token, origin)
                self.assertEqual(error.exception.code, code)
            request('/import', bundle)
            request('/annotations', {'id': self.id, 'annotation': {'notes': 'Durable via HTTP'}})
            restored = request('/backup?session=' + self.id)
            self.assertEqual(restored['annotation']['notes'], 'Durable via HTTP')
            self.assertEqual(len(restored['samples']), 2)
            with self.assertRaises(urllib.error.HTTPError) as error:
                request('/import', bundle)
            self.assertEqual(error.exception.code, 409)
        finally:
            process.terminate()
            process.wait(timeout=10)
