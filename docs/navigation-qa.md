# Mobile and Keyboard Journey QA

Scope: existing workspace navigation and connection handoffs. No new product features or backend changes.

## Checklist
- Keyboard skip-navigation action reaches the main heading.
- Page changes and browser Back move focus to the destination heading.
- Mobile menu announces expanded state and the current page.
- Opening the menu focuses the current destination; Escape returns focus to the toggle.
- Selecting the current page closes the menu without leaving focus in hidden content.
- Engineer-to-connection handoff works with keyboard activation.
- Connection page fits 320px, 390px and 760px widths.
- Existing mocked pairing, engineer, session review and lap-comparison journeys remain covered by the full browser suite.

## Fixed Issues
- Medium: navigating left keyboard focus on removed controls or old navigation. Destination headings now receive focus.
- Medium: mobile menu lacked expanded-state semantics and Escape dismissal. Added those behaviors, outside-pointer dismissal, and a 44px toggle target.
- Medium: a 360px body minimum clipped the interface at 320px. Reduced the mobile minimum to 320px.

## Remaining Validation
This is a focused Chromium regression pass, not a full accessibility or public-launch certification. Physical phone testing, screen-reader testing, other browser engines, and a real PS4 drive-to-review run remain outstanding. The companion still runs on the PC; a narrow browser viewport does not establish phone-to-companion connectivity. No recordings or production account data are modified by these tests.

Next priority: validate the complete existing journey with a real race and time trial, including reconnection and audible callout delivery, before adding deferred features.
