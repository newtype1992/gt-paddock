# Driving Review Milestone

## Workflow

1. Start the local web app, then double-click `Start GT Paddock Companion.cmd`. This launches the installed companion against 192.168.2.20 and shows its pairing code in a terminal. Keep the terminal open. The launcher refuses to start a second listener on port 4181 and does not install startup tasks or change firewall policy.
2. Pair in Live telemetry and drive. Recording status and recent packet age appear below the connection controls.
3. Sessions are saved continuously. An on-track pause retains the current session without samples; off-track/loading packets finalize it immediately. More than three seconds without packets flags signal loss, and ten seconds finalizes an interrupted session. A lap reset or car change starts a new session. A process restart marks new-format unfinished recordings interrupted without deleting their samples.
4. Open Sessions and confirm track/layout/settings manually. Saving in This PC mode stores annotations in SQLite; full-session backups include them.
5. Open Lap analysis. The reference defaults to the best completed lap in that session. Compare it against another lap, select a channel and inspect the shared distance cursor. The review focus identifies a distance window with the greatest observed time loss; it does not infer driver fault or prescribe a braking point.

## Distance Limitations

Distance is estimated by trapezoidal integration of speed. It is not a GPS racing line or a known track-map coordinate. Nearly complete laps, endpoints within 0.25 seconds, no internal gaps over one second, and travelled lengths within 3% are required. Otherwise the UI falls back to elapsed time with an explanation. Tiny unobserved boundary intervals are extended using the nearest speed sample. Channel/time readouts interpolate between neighbouring distance samples; gear uses the previous discrete value.

Comparisons currently use two laps within one session. Cross-session best-lap selection, position-based track matching, full cloud recordings and automatic track/settings detection remain future work.

## Backup and Persistence

Before startup recovery the companion writes `gt7.sqlite.startup-backup` using SQLite's backup API. This is a single overwritten recovery snapshot, not versioned or off-device backup. Existing legacy sessions remain unchanged. Analysis/raw-array export is capped at 36,000 samples; the Sessions full-backup action is not. See [portable backups](session-backups.md).

The running receiver was updated while the console was off-track. The original 1,875 samples and two lap summaries were verified intact afterward. Real-recording analysis estimated lap lengths of 4,308 m and 4,332 m; that agreement does not establish the track's identity.

## Verification

Unit tests cover pause continuity, off-track finalization, signal loss, restart recovery, distance integration, interpolation, incomplete/gapped data and mismatched lengths. Browser tests cover alignment controls and the cursor, alongside connection continuity, session review and responsive layout. These tests do not replace another real driving session to validate lifecycle transitions with the console.
