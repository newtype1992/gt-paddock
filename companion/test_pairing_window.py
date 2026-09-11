import tkinter as tk
import unittest
from unittest.mock import Mock
from unittest.mock import patch
import contextlib
import io
import http.client
import socket
import tempfile
import main
from pairing_window import PairingWindow, clear_owned_clipboard, APP_URL


class PairingTests(unittest.TestCase):
    def test_clear_only_our_credential(self):
        root = Mock()
        root.clipboard_get.return_value = 'test-token'
        clear_owned_clipboard(root, 'test-token')
        root.clipboard_clear.assert_called_once()
        root.reset_mock()
        root.clipboard_get.return_value = 'unrelated clipboard content'
        clear_owned_clipboard(root, 'test-token')
        root.clipboard_clear.assert_not_called()
        root.clipboard_get.side_effect = tk.TclError('empty')
        clear_owned_clipboard(root, 'test-token')

    def window(self):
        window = PairingWindow.__new__(PairingWindow)
        window.root = Mock()
        window.token = 'test-token'
        window.feedback = Mock()
        window.copy_timer = None
        window.reveal_timer = None
        window.entry = Mock()
        window.reveal = Mock()
        return window

    def test_copy_is_explicit_and_cleanup_is_scheduled(self):
        window = self.window()
        window.copy()
        window.root.clipboard_append.assert_called_once_with('test-token')
        window.root.after.assert_called_once_with(45000, window.clear_clipboard)
        window.copy()
        window.root.after_cancel.assert_called_once()

    def test_reveal_rehides_and_navigation_has_no_secret(self):
        window = self.window()
        window.entry.cget.return_value = '*'
        window.toggle()
        window.root.after.assert_called_once_with(30000, window.hide)
        window.hide()
        window.entry.configure.assert_called_with(show='*')
        self.assertEqual(APP_URL, 'http://127.0.0.1:4178/#Live%20telemetry')

    def test_clipboard_failure_is_recoverable(self):
        window = self.window()
        window.root.clipboard_clear.side_effect = tk.TclError('denied')
        window.copy()
        self.assertIn('Show code', window.feedback.set.call_args.args[0])

    def test_window_mode_keeps_http_authorized_and_code_out_of_logs(self):
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        test = self
        class FakeWindow:
            def __init__(self, token, console):
                self.token = token
            def run(self):
                for headers, expected in [
                    ({'Origin':'https://untrusted.example'},403),
                    ({'Origin':'http://127.0.0.1:4178'},401),
                    ({'Origin':'http://127.0.0.1:4178','Authorization':'Bearer '+self.token},200),
                ]:
                    client = http.client.HTTPConnection('127.0.0.1',port,timeout=3)
                    try:
                        client.request('GET','/status',headers=headers)
                        response = client.getresponse()
                        test.assertEqual(response.status,expected)
                        test.assertNotIn(self.token,response.read().decode())
                    finally:
                        client.close()
            def destroy(self):
                pass
        output = io.StringIO()
        with tempfile.TemporaryDirectory() as directory, patch('pairing_window.PairingWindow',FakeWindow), \
             patch.dict('os.environ',{'GT7_PAIRING_TOKEN':'synthetic-auth-test'}), \
             patch('sys.argv',['companion','--simulate','--pairing-window','--port',str(port),'--data-dir',directory]), \
             contextlib.redirect_stdout(output):
            main.main()
        self.assertNotIn('synthetic-auth-test',output.getvalue())
        self.assertIn('Companion window',output.getvalue())


if __name__ == '__main__':
    unittest.main()
