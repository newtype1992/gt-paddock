# GT7 Companion

Uses the MIT-licensed [granturismo decoder](https://github.com/chrshdl/granturismo) at the exact commit in requirements.txt. Receives GT7's unofficial UDP telemetry from a PlayStation on the same LAN. No PSN credentials are used.

## Run on Windows

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r companion\requirements.txt
.\.venv\Scripts\python.exe companion\main.py --ps-ip 192.168.2.20
```

Open GT Paddock's **Live telemetry** view, select **This PC**, enter the pairing code printed in the terminal, and select **Connect**. Enter a driving session in GT7. UDP 33739 is used for outbound heartbeats and UDP 33740 for incoming telemetry. Only allow the receiver through the local private-network firewall if required. No router port forwarding is needed.

The HTTP listener binds only to 127.0.0.1:4181. It requires the pairing code in the Authorization header, an allowed Origin, and a loopback Host. A new random code is generated each launch. To allow a hosted GT Paddock frontend, add `--origin https://YOUR-APP.vercel.app`. Browser local-network permission may also be required. The cloud route avoids browser-to-localhost access.

## Cloud Upload

Create and confirm a GT Paddock app account first (this is separate from Supabase CLI login).

```powershell
$env:GT7_SUPABASE_URL='https://zvemvophntoiluhdmwss.supabase.co'
$env:GT7_SUPABASE_PUBLISHABLE_KEY='PUBLIC_KEY_FROM_APP_ENV'
.\.venv\Scripts\python.exe companion\main.py --ps-ip 192.168.2.20 --cloud
```

The companion prompts locally for the GT Paddock email and password. It keeps its access and refresh tokens in memory, refreshes them before expiry, and writes under the authenticated user's RLS policies. It never needs a Supabase service-role key. Keep the terminal running. A restart requires signing in again.

Cloud upload occurs every five seconds and sends the latest packet and up to 50 recent session summaries. SQLite retains sampled telemetry locally at roughly 10Hz. An unavailable cloud does not stop local recording; summaries retry on the next upload. Raw samples are exported locally, not uploaded automatically. This initial version assumes one active companion per app account.

## Recording Semantics

- Simulation requires explicit `--simulate` and uses `simulation.sqlite`, separate from `gt7.sqlite`.
- A new session starts on car change, lap-counter reset, or more than ten seconds without active data.
- Paused/loading/off-track packets update status but are not recorded as driving samples.
- A lap time is recorded only for an observed consecutive lap-counter transition with a valid last-lap time. Joining a lap midway does not imply a full lap of sampled data.
- Stale data is marked after three seconds. Disconnected telemetry never falls back to sample racing data.
- Car IDs are game identifiers, not the manually entered garage numbers. No track name or owned-car collection is inferred.
- Session export currently returns up to 36,000 samples (one hour at 10Hz). Full recordings remain in SQLite. Recordings are not automatically deleted; monitor disk space.

## Account Statistics

`api/gt7-profile.js` integrates the documented [GT GridStats API](https://gt-gridstats.com/api-docs). The deployment needs a server-only `GRIDSTATS_API_TOKEN`. Do not prefix it with VITE_. Calls require a valid GT Paddock session, use a fixed provider hostname, and store returned statistics with provider provenance and timestamps. Numeric fields absent from provider responses remain unavailable, not zero. The profile link alone is not PSN OAuth or proof of account ownership. The provider adapter is fixture-tested; live profile sync requires provider access.

## Tests

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s companion -p "test_*.py"
node --test tests/gt7.test.js
npm test
```
