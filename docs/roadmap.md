# GT Paddock Roadmap

Mobile/keyboard handoffs first pass implemented: destination focus, skip navigation, mobile menu state and Escape recovery, and 320px connection-page layout. See [navigation QA](navigation-qa.md). Next priority: a real race and time-trial acceptance pass covering pairing, audio, recording, review and comparison; deferred features remain deferred.

Development status and planning reference. Later and deferred items are not implemented features.

## Current Priority: Existing User Journey

Friction point 3 first pass implemented: a sticky running-engineer bar on all other workspace pages shows mode and radio state, with Return, Mute/Unmute and Stop. It shares the existing engineer state and does not alter companion recording. No extra player or background service was introduced.

Friction point 4 first pass implemented: completed status snapshots populate the session library immediately, without waiting for the periodic list refresh. Stale lists cannot hide the latest completed recording or discard its saved annotations. The review-to-analysis browser test uses a deliberately stale list and checks the exact exported session ID. Next flow priority: mobile and keyboard handoffs, including focus, navigation and recovery throughout connect -> configure -> drive -> review -> compare.

Friction point 2 first pass implemented: essential mode/target/race-plan inputs remain visible; frequency, voices, online-voice consent and individual callouts are in a collapsed Advanced settings section. Pre-start readiness separates companion connection, driving data and audio availability. A running-plan summary preserves mode, target, race length/pit lap and frequency outside the settings drawer. Inputs and callout defaults remain unchanged; no presets or saved preferences were added. Real-user validation remains outstanding.

Top priority, in order: (1) pairing discoverability and credential handling, (2) configuration density, (3) running-engineer visibility across navigation, (4) saved-session availability, (5) mobile/keyboard handoffs. Validate each improvement before expanding scope. All previously deferred features remain deferred.

Friction point 1 first pass: dedicated local companion pairing window with masked/revealable code, deliberate copy, timed clipboard cleanup and a credential-free app-opening button. The launcher opens this window; browser pairing help and invalid-code recovery are included. Persistent trust, automatic pairing and credential-bearing links are not implemented. See [pairing security and flow](pairing-flow.md).

Decision: defer all six improvement-dashboard proposals below. Focus on the current connect -> configure -> drive -> review -> compare journey, with clear next actions and recovery paths. No new coaching, metrics, presets, or practice objectives in this pass. See [current journey review](user-journey.md).

## Deferred: Improvement Dashboard Ideas

Circuit-name identification is also deferred. Scope is the circuit name only, with no map, position display, layout details or event settings. Any future recognition may use coordinates internally and must leave ambiguous matches Unknown. No recognition work is authorized in the current flow milestone.

All six are saved for later, with no implementation commitment or scheduled start:

1. Automatic session debrief: best/median pace, first-versus-last comparable laps, target attainment, streaks and review links. Describe measured changes without invented causes.
2. Personal progress by car and track: best and typical pace, consistency and practice history. Require matching car/layout and clearly identify unconfirmed settings or conditions.
3. Focused practice sessions: explicit pace or consistency objectives, focused feedback and results. The proposed Practice and Debrief milestone is deferred too.
4. Smarter, quieter engineer: combine redundant messages, maximum speech length, Pace/Consistency/Minimal presets and remembered preferences. Existing callout behaviour is retained during flow work.
5. Personal reference-lap library: bookmark references for car/layout combinations; later validated position-aligned section comparisons.
6. Data-quality labels and exclusions: complete/partial, continuous/interrupted, confirmed/unknown context, lap-validity provenance, and non-destructive exclusions for analysis.

Resume only after the current journey has been exercised and reviewed with the user.

## Current Milestone: Live Race Engineer

Time-trial previous-lap comparisons and entered-target streaks are implemented with individual toggles. They use consecutive newly observed recorded times only, reset across discontinuities, and apply reduced-frequency rules in Key updates. They do not certify GT7 lap validity or infer why pace changed.

Pit Radio Console implemented: auto-collapsed settings on start, desktop drawer/mobile settings sheet, persistent stop/mute/volume controls, speech-event-driven transmission bars, latest callout and recorded lap summary. Native dialog focus handling and reduced-motion support included. The animation is a playback indicator, not an audio waveform.

Initial implementation completed: Race / Time trial modes, browser speech with text fallback, controls, callout history, completed-lap timing, session-best comparisons, pace spread, conservative fuel-to-finish warnings and manually planned pit-lap reminders. Automated verification covers rules, speech lifecycle, route continuity and responsive layout. Real-console audio validation remains outstanding. No backend schema changes or paid AI services were added.

Additional callouts implemented: three-consecutive-lap pace trends, optional manually entered target-time comparisons, progress against the entered race distance, and a one-lap-ahead planned-pit reminder. Key updates filters trends, target crossings and progress milestones. No track, rivals, driving causes or actual race completion are inferred. See the README for thresholds and controls.

Also implemented: race session-best comparisons, five-consecutive-lap consistency and opt-in connection lost/restored alerts. Connection alerts are off by default and may speak off-track; fresh paused/menu telemetry is not treated as an outage. All stop and mute controls still apply.

Decision: a spoken engineer for both races and time trials, not just a dashboard. It should observe the active drive, deliver concise useful updates and remain quiet when there is nothing actionable.

### First Release Scope

- Explicit Race / Time trial mode selection. Do not infer race type from incomplete telemetry.
- Start engineer, stop, mute, volume, voice selection, message frequency and visible callout history.
- Race: completed-lap timing, pace consistency and fuel-range estimates once reliable consumption data is available. A fuel-to-finish estimate requires a known race distance; pit reminders require user-entered strategy or validated context.
- Time trial: completed-lap delta against current session best and session-best announcements. Selected recorded references and cross-session personal bests remain future work. Pace spread is included in routine callouts where message length permits.
- Driving announcements require fresh active-driving data. Pause/loading/off-track/disconnect cancels queued driving speech. Resume without replaying stale messages. Explicitly enabled connection alerts can report delivery changes outside active driving.
- Prioritize urgent verified information, deduplicate events and apply cooldowns. Prefer short updates at lap completion or low-workload moments; do not promise reliable corner-aware timing before it is validated.
- Initial implementation: deterministic telemetry rules and browser speech synthesis where supported, with a text fallback. No paid AI service or microphone requirement for the first release.

### Data and Safety Boundaries

Confirm decoder semantics, units and recording lifecycle before deriving new metrics. Never invent rival gaps, flags, penalties, tyre wear, race position, track identity or fuel units. Temperature is not tyre wear. No automatic changes to game settings or pit strategy. Fuel estimates need adequate samples, rejection of refuelling discontinuities and clear uncertainty.

Existing stored lap times can support post-lap comparisons. Continuous delta, segment coaching and track-specific advice require validated alignment and reference data; they are later enhancements, not assumed first-release capabilities. Local voice availability varies by browser/OS; disclose any network dependency of the selected voice.

### Acceptance Checks

- Race and time-trial fixture replays produce the intended distinct callouts.
- Lap transitions announce once; repeated packets/polls do not repeat speech.
- Stop/mute/inactive states cancel pending speech immediately.
- Missing/invalid/stale data cannot produce confident fuel or timing advice.
- Real-console drive and time-trial testing confirms useful timing and manageable interruption frequency.

### Later Enhancements

Push-to-talk questions, richer strategy planning, position-aligned live delta, and optional AI explanations grounded in computed metrics. These require separate implementation and validation.

Next step: validate the existing connect-to-review journey and audible delivery in a race and a time trial. New references, richer coaching and the improvement-dashboard proposals remain deferred.

## Deferred: AI Car Build Assist

Personalized tuning for a specific car, track and driving style is retained as a future feature, not discarded.

Proposed sequence: versioned Setup Notebook with parts and event restrictions; baseline telemetry analysis; bounded tuning experiments; before/after comparisons. Require confirmed setup values and adjustable ranges. Distinguish driving technique from setup problems and label inconclusive results. Never claim an optimal setup from a small or inconsistent lap sample.

## Existing Release Prerequisites

Public deployment, production authentication redirects, email delivery verification and Google/Apple provider configuration remain separate from the Race Engineer milestone. See [account onboarding](account-onboarding.md) and [social sign-in setup](social-sign-in.md).
