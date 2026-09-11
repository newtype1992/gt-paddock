# Current User Journey Review

## Scope and Proof Goal

Primary user: a GT7 driver using a PlayStation and a companion PC, optionally a second screen. Optimize the existing product, not the deferred improvement-dashboard proposals. Success is pairing, hearing or reading a measured lap callout, and finding that same recording for review without losing context.

This is a code-based UX review informed by the user's reported pairing confusion, not a usability study or proof of an optimal flow. No conversion metrics or research participants are invented.

## Journey

| Stage | Existing action | Risk | Current response |
| --- | --- | --- | --- |
| Entry | Overview or a direct page link | Engineer can be opened before pairing | Direct Connect companion shortcut from engineer |
| Connect | Launch companion, enter startup code in Live telemetry | Hidden/stopped launcher; unclear code location | Existing visible launcher retained; connection recovery remains in Live telemetry |
| Configure | Choose race/time trial and optional settings | No direct handoff from telemetry | Open race engineer action after status is available |
| Activate | Start engineer, drive and complete a lap | Waiting can be confused with failure | Existing waiting, paused, muted, text-only and connection states retained |
| Core use | Hear/read measured callouts, navigate if needed | Controls could interrupt concentration | Existing Pit Radio, collapsed settings, stop/mute/volume retained |
| Finish | Leave track so recorder finalizes; stop engineer separately | Stopping engineer is not stopping recording | Preserve separate lifecycles; no automatic stop or recorder changes |
| Review | Open saved session | Library opens without selecting the recording | Review saved session selects the exact last-session ID from telemetry or engineer |
| Compare | Analyze laps from session detail | Losing selected session | Existing selected-session handoff retained and covered by regression tests |
| Return | Re-enter engineer or telemetry | Reload requires pairing again | Preserve current memory-only pairing; persistent credentials deferred pending security design |

Optional account path: Settings/account dialog -> sign up/sign in -> private driver profile -> return to driving. Local recording does not require signup. Cloud/provider setup remains separate. There is no payment step in this current flow.

## Highest-Risk Follow-ups

These friction points are the top product priority, in the order below. Friction point 1 is now the active implementation focus; all improvement-dashboard additions remain deferred.

- Pairing discoverability: user has repeatedly needed help finding the startup code. Assess a supported launcher/connection-help treatment without exposing or persisting secrets casually.
  First pass implemented: a local pairing window opened by the launcher, masked code with explicit copy/reveal, timed cleanup, browser help and invalid-code recovery. See pairing-flow.md for security boundaries and activation instructions.
- Engineer configuration density: evaluate defaults and grouping with the current controls before adding presets or saved preferences, which are deferred.
  First pass implemented: essential inputs first; advanced voice/frequency/callout controls collapsed by default. Readiness distinguishes API connection from live driving and available audio. Running summary shows entered plan without opening settings. Starting requires a companion status response but does not require active driving or a voice; text-only and waiting modes remain supported. Defaults, privacy permissions and running locks are retained.
- Returning-user navigation: check engineer visibility when moving between pages; avoid accidental recording or speech resets.
  First pass implemented: sticky mode/status bar outside the engineer page, with shared mute/stop controls and a return action. Stopping restores keyboard focus to the current page heading without navigating or disconnecting the companion.
- Session availability first pass implemented: saved-session shortcuts open the completed status snapshot immediately. Periodic lists merge that snapshot without duplicates and retain its saved annotations when the list has not caught up. Browser coverage verifies review and analysis against a deliberately stale list.
- Mobile and keyboard: verify handoffs, native settings dialog, focus return and no horizontal overflow.

## Verification and Next Review

Automated fixture journey: open engineer disconnected -> connect shortcut -> pair -> open engineer -> configure/start -> saved-session shortcut -> correct session detail -> analysis. Test both telemetry and engineer review actions and keep the existing account, recording, speech and analysis regression suite.

Real-user check remains: run one time trial and one race from a fresh browser, locate the startup code without assistance, verify audible delivery, leave the track and locate the recording. Record points of confusion before another flow iteration. Do not begin any deferred dashboard feature as part of that review.

## FigJam

Diagram generation requested as "GT Paddock Current User Journey". The Figma tool requires a team/organization selection in its widget before it can create the diagram. No diagram URL was returned; this external step remains pending. Save the returned link here after selection rather than inventing a URL.
