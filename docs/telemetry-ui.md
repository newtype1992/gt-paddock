# Telemetry Dashboard Redesign

Implemented directly from the user's black-and-blue dashboard request; no Figma artifact was supplied. The existing app workflows and backend contracts remain unchanged. `night.css` applies the shared dark theme after the original layout styles.

- Radial speed and RPM instruments use labeled display scales, not inferred vehicle redlines.
- Powertrain and driver-input traces have independent units, 30/60/120-second windows, and a chart-only freeze control. Recording continues while charts are frozen.
- The trace buffer contains up to 120 seconds of frontend-polled samples; it is not the full-resolution local recording. Gaps of three seconds or more are not connected by a line.
- Tyre temperatures are positioned by wheel and colored against a 60-130 C reference scale, not a calculated safe operating range.
- Lap bars show completed elapsed lap times and delta to the best lap in the selected session. No sector or track data is inferred.
- Missing live readings display dashes. Existing saved sessions and the verified car image are retained.

Verified through browser workflows and desktop/mobile screenshots. Custom livery upload remains out of scope as requested.
