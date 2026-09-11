# Pairing Flow: First Friction Priority

## User Flow

Open `Start GT Paddock Companion.cmd` in the project folder. The dedicated GT Paddock Companion window shows the PlayStation address and a masked pairing code. Select Copy code, then Open GT Paddock (local app must already be running), paste into Live telemetry and Connect. Show code is available for manual entry and hides again after 30 seconds. Minimize the companion while driving; closing it requires confirmation because it stops recording.

This is a local-PC flow. The browser cannot launch arbitrary local programs. Existing installations still require the project launcher, configured Python environment with Tcl/Tk, and a running web app; no packaged installer or automatic server start is claimed. The companion must be restarted via the launcher to activate this change. Do not stop an active drive without consent. If an older companion already owns port 4181, stop it first when safe; the launcher does not kill it.

## Security Boundaries

- Pairing remains an explicit user action, not automatic browser trust.
- Default credentials are random per launch and authorize access to local recordings, not PSN. The existing GT7_PAIRING_TOKEN override remains for controlled development; do not configure it for normal use.
- GUI mode does not print the code in startup logs. Terminal-only mode is still available and prints it as before. Existing logs are not automatically deleted.
- No credentials are embedded in URLs, QR codes, process arguments, browser storage or recording files by this flow. Open GT Paddock navigates to a fixed local URL without secrets.
- Existing loopback binding, Host/Origin checks and Authorization header protection remain unchanged. No unauthenticated token endpoint is introduced.
- Copy is deliberate. After 45 seconds, or window shutdown, cleanup clears only clipboard contents still matching the copied code. It cannot erase clipboard history, cloud sync or copies made by other software. Shared PCs, malicious local processes and same-origin script compromise are outside this protection.
- Browser code entry is masked, explicit reveal expires after 20 seconds, and successful connection hides it. A 401 clears the rejected code and returns to editable pairing instead of polling a locked form indefinitely.

Not implemented: remembered credentials, permanent trust, pairing via a secret URL, automatic clipboard reading, or weaker network permissions. A later approved device-trust design would need explicit consent, per-device credentials, expiry and revocation.

## Verification

Use isolated tests for clipboard ownership, reveal timers and window controls without copying a real credential. Browser tests cover help, masked entry, invalid-code recovery and retry. Existing recorder tests remain regression coverage. A real desktop launcher and console drive must still be exercised by the user after a safe companion restart.

References: [Python Tkinter](https://docs.python.org/3/library/tkinter.html), [OWASP HTML5 security guidance](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).
