# GT Paddock

A local-first Gran Turismo 7 driving companion built with React and Vite. The app is prepared for Vercel hosting and optional Supabase authentication and session-summary storage. Hosting is not required for local telemetry.

## Run

See the [screenshots](#screenshots) for a preview of the driving workspace.

```sh
npm ci
npm run dev -- --port 4178
```

Start the [PC companion](companion/README.md), open Live telemetry, and pair using the code printed by the companion. The pairing code is held in memory, not persisted; refreshing the app requires pairing again. Navigation between pages keeps the same connection alive.

## Driver Workspace

- Overview: loaded recording totals, recent sessions, personal bests grouped by car and manually assigned track.
- Live telemetry: instruments, live traces, tyre temperatures and recording status.
- Sessions: search/filter, completed laps, manual track/layout labels, notes and JSON export.
- Lap analysis: two laps from the same session with speed, RPM, throttle, brake and gear overlays.
- Driven cars: automatically derived from recorded sessions, not the owned GT7 garage.
- Settings: companion status, storage information and account sign-in.

The UI loads up to 50 recent session summaries. Totals describe that loaded set, not the user's whole GT7 career. Simulation is excluded from driving totals and driven cars. Timed lap minutes sum completed lap times and do not claim total play time.

In This PC mode, Save session details stores track labels, settings and notes alongside the recording in SQLite. Existing browser-only details remain visible as a fallback; save them once to make them durable. Cloud-mode edits still remain browser-local.

## Recording Backups

After leaving the track, open a session and select **Export recording**. The version 1 JSON backup contains the session, track/settings/notes and all recorded samples, without the analysis endpoint's 36,000-sample cap. Active sessions must finish first. Portable backups are limited to 64 MiB and 200,000 samples; oversized sessions fail explicitly instead of truncating.

To restore, connect This PC, open the Sessions list and choose **Import backup**. Imports are validated and stored atomically. Existing IDs are rejected without overwriting anything; console and simulation recordings stay separate. Legacy raw-array and summary-only exports cannot be restored with this importer. Backups contain your driving data and notes: keep them somewhere private, preferably on another device.

The companion must be restarted after updating to enable these endpoints. See [backup integration and verification](docs/session-backups.md).

## Screenshots

These screenshots use isolated, synthetic demo data, not personal driving records. Track labels are manually entered examples; the car photo is a stock reference image.

### Live Telemetry

![Live telemetry dashboard with speed, RPM, pedal inputs, rolling graphs and tyre temperatures](docs/images/live-telemetry.png)

### Sessions

![Session library with demo laps, track details and session notes](docs/images/sessions.png)

### Lap Analysis

![Synthetic lap comparison with speed overlays, estimated-distance cursor and time delta](docs/images/lap-analysis.png)

To regenerate with the local app running, use `node scripts/readme-screenshots.mjs`. The capture runs in an isolated browser and mocks companion responses without reading recordings.

## Lap Analysis

The recording-to-review milestone is implemented: explicit recorder lifecycle, a Windows companion launcher, startup recovery backup, estimated-distance overlays, a shared cursor and a time-loss review focus. See [workflow and limitations](docs/driving-milestone.md).

Raw samples are retrieved from the local companion's authenticated export endpoint, up to 36,000 samples per session. Cloud mode currently has summaries only and reports that local access is required for analysis.

The observed next-lap boundary and official last-lap duration establish the elapsed-time origin. Partial recordings are labeled, and gaps exceeding one second are not connected. Coverage measures captured short intervals against lap duration. Estimated-distance mode integrates speed and rejects incomplete or mismatched laps; elapsed time remains available. Neither mode claims exact physical track position. Existing recordings do not contain vehicle-position channels.

## Accounts and Private Profiles

Settings offers email/password registration, confirmation resend, sign-in, password-reset emails and sign-out. Confirmation/recovery links return to the app origin; recovery opens a new-password form. Signed-in drivers without a profile are directed to setup. Profiles contain a display name and optional PSN ID/GT7 URL, with owner-only RLS and database-enforced private visibility. The GT7 association is unverified and does not authorize PlayStation access or statistics sync.

Apply all migrations in `supabase/migrations`, including `private_driver_profiles`. Existing provider snapshots in `gt7_profiles` remain separate. No auth signup trigger is needed: a profile is created when the driver submits setup.

Before opening registration to other drivers, configure custom SMTP, deploy the frontend, allowlist its exact authentication redirect origin and test email confirmation/recovery with a real inbox. Supabase's default SMTP is restricted to project-team addresses and is not production email delivery. See [account onboarding verification](docs/account-onboarding.md).

PC recordings remain protected by companion pairing, not cloud account ownership. Use separate OS accounts/data directories on shared PCs; sign-out does not delete local recordings. Cloud profiles and session summaries use account-scoped RLS.

## Backend and Hosting

The configured Supabase project uses both migrations under `supabase/migrations`. Never put a service-role key in frontend variables:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Auth and cloud upload remain optional. The companion uploads using the signed-in user's JWT and owner-scoped RLS. No schema changes were needed for the driver-workspace redesign.

For Vercel: framework Vite, build command `npm run build`, output directory `dist`. Configure the two public environment variables, Supabase redirect URLs, and the companion's allowed frontend origin as appropriate. Live account-statistics sync remains disabled without provider access; its adapter is retained but its page is hidden.

## Verification

```sh
npm run build
npm test
node --test tests/session-model.test.js tests/gt7.test.js tests/gt7-cars.test.js
```

Browser tests cover connection continuity across pages, session-derived views, notes, lap overlays, channel controls and mobile layout. Unit tests cover lap alignment, coverage, missing boundaries, gaps, summary calculations, model resolution and provider fixtures.

## Existing Data and Assets

The original team-operations pages have been retired. Their browser data and Supabase records are untouched. Old browser workflow tests remain under `tests/legacy` as reference, outside the active browser suite.

Car names and image provenance are documented in [car catalog](docs/car-catalog.md). The reference photo does not represent the user's custom livery. No custom-livery upload was added.

This redesign follows the user's approved personal GT7 companion direction. No Figma artifact was supplied; existing black-and-blue UI conventions were retained.
