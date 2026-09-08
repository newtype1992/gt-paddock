# Session Backup Integration

Mode: lightweight local-first integration. Scope: React session library, authenticated loopback HTTP, SQLite, private JSON backup files. Deployment, scheduled backup, account-statistics providers and new cloud-storage work are deferred.

## Contract

- GET `/backup?session=ID`: version 1 `gt-paddock-session` object with session, annotation and all samples. Rejects active sessions and oversized backups (64 MiB / 200,000 samples), never truncates.
- POST `/import`: accepts that object, validates driving channels, car/source, timestamps, sample count and annotations. One SQLite transaction writes the session, samples and annotations. Duplicate ID: 409; invalid data: 400; oversized request: 413.
- POST `/annotations`: `{id, annotation}` stores validated manual details for an existing session. Session-list responses include persisted annotations.
- All endpoints require the existing bearer pairing code, allowlisted Origin and loopback Host. Writes require JSON content type, bounded body size and a read timeout. No credentials belong in backups.

The previous `/export` raw-array endpoint remains unchanged for lap analysis. Legacy exports without versioned full-session data are deliberately rejected, as they may have truncated samples. Session IDs are retained on import, and no overwrite mode is provided.

## Persistence

The annotations table is added on startup without rewriting existing recordings. Browser-only annotations remain fallback data until explicitly saved to the companion; exports also include that fallback. Cloud-mode UI edits remain browser-only. If companion cloud sync is enabled, existing summary upload behavior can include saved annotation fields; raw samples still remain local.

For recordings beyond portable limits, stop the companion before copying the SQLite database and any WAL/SHM sidecars together. Keep off-device copies private. The startup backup alone is not a backup history.

## Verification

`python -m unittest discover -s companion -p test_*.py` covers round-trip samples/details, restart persistence, duplicate preservation, malformed input rollback, full export past 36,000 samples, active-session rejection, and a real temporary HTTP server with authentication/origin rejection and import/export.

`npm test` covers browser import from an empty library, bad JSON, details surviving a reload/reconnect, downloaded JSON contents, duplicate messaging, and mobile overflow alongside existing driving workflows. Browser tests mock the companion; HTTP/SQLite tests exercise the actual backend separately. `npm run build` verifies production bundling.

Next validation: a full real-console drive through pause, exit, disconnect and restart, followed by exporting a private backup and restoring it into a separate companion data directory. No automated test writes to personal recordings.
