# Issue #6 — Bottom navigation visibility and Compass meeting guidance

Branch: `fix/bottom-navigation-meeting-guidance`, based on `feat/compass-nearest-member` (`60321967b9e2d976354754c127ca354a0193a284`). Issues #1–#5 are preserved.

## Root cause and focused CSS fix

The Compass-specific `.app:has(.dal-navigation--compass) .bottom-nav button` selector had greater specificity than `.bottom-nav button.active`, giving the active Map item a light foreground over its light background. Restricting that rule to `button:not(.active)` restores the dark green active icon/label. Authenticated navigation buttons now explicitly use the existing DAL dark green on light pages; inactive Compass items retain the readable light green on dark green. Layout, navigation handlers, existing safe-area padding and all five items are unchanged. The new outlined meeting button uses the existing Compass light foreground/border treatment.

## Meeting-point guidance

The localized AR/EN/FR button sits beside the nearest-member action in the Compass destination area. It reads `navigation.meeting`, validates coordinates, checks active live GPS using the existing permission requirements, stops the walking preview, clears nearest-member confirmation and selects the existing `meetingSelected` state. It stays on Compass and reuses the existing target, heading, bearing and direct-distance calculations. No walking request or native permission request is issued by selection.

Missing/invalid meeting points show localized messages and preserve the current destination. Inactive GPS reopens the existing Issue #4 dialog with guidance, without activating GPS or changing sharing. Sensor fallback and low-accuracy warnings remain. Meeting points are fixed destinations and need no member-location timestamp; a fixed-point label replaces member age text. Stale own GPS still has a warning. Removal or invalidation of a selected point clears the destination and walking preview and displays a message, rather than silently restoring a previous member.

## Files changed

- `frontend/src/design-refinements.css`: focused foreground specificity/contrast fix and meeting-button outline color.
- `frontend/src/components/navigation/GroupNavigation.jsx`: existing meeting-target selection, validation, permission guidance and removal handling.
- `frontend/src/components/navigation/LiveCompass.jsx`: localized meeting action/status and fixed-point presentation.
- `frontend/src/translations.js`: six AR/EN/FR entries.
- `frontend/tests/nearest-member.test.mjs`: six additional meeting-guidance component/integration tests, including stale own GPS.
- This report and four screenshots below.

## Validation results

| Check | Result |
| --- | --- |
| `npm test` | PASS: 97 tests, 0 failures, 0 skipped |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| Chrome: 390×844 / 1280×720, AR/EN/FR | PASS: 72 real-browser checks |
| WebKit: 390×844 / 1280×720, AR/EN/FR | PASS: 72 real-browser checks |

Browser checks measured computed foreground/background contrast for all five items on Compass, Map, Meeting Point, Chats, Account, Home and Groups: all text ratios were at least 4.5:1. The icons inherit the same foreground, exceeding the essential-icon 3:1 requirement. All five items remained visible and clickable, with no horizontal overflow. Existing safe-area CSS was preserved.

The real local application selected the synthetic fixed meeting point `QA Gate` (~101 m east), kept Compass open, cleared nearest confirmation and updated the arrow/distance. Browser checks also covered nearest selection before meeting selection, selected-point invalidation, invalid/missing point handling while a member remains selected, and inactive-GPS guidance without automatic activation. Native activation counts, walking-request counts and sharing-write checks confirmed no new permission calls, no automatic walking request from the meeting/nearest actions, and no sharing-setting changes. Application API requests were intercepted with synthetic data; no production API or ORS requests were made.

Automated tests additionally cover removed points, no member timestamp, stale own GPS, sensor-unavailable fallback, low accuracy, manual/nearest selection afterward, immediate AR/EN/FR switching and existing privacy/navigation functionality. No application page/console errors were observed in the browser matrix; the existing WebKit `interactive-widget` compatibility warning was excluded from error assertions.

## Genuine screenshots

All screenshots are from Chrome at 390×844 in Arabic, using matching synthetic group data, user location and north-facing sensor heading, with the same Compass scroll anchor. Before shows `QA Far Member` (~111 m north); meeting After shows `QA Gate` (~101 m east). No mockups or generated screenshot images were used.

| Comparison | Before | After |
| --- | --- | --- |
| Bottom navigation, active Map on Compass | [Before](screenshots/issue-06-before-bottom-nav.png) | [After](screenshots/issue-06-after-bottom-nav.png) |
| Compass meeting-point guidance | [Before](screenshots/issue-06-before-compass-meeting.png) | [After](screenshots/issue-06-after-compass-meeting.png) |

## Limitations

Physical iPhone safe-area behavior, native permission dialogs and GPS/Compass calibration still require device testing. WebKit verification used the Windows engine with simulated GPS/sensors. Direct Compass distance is not an accessible walking route. The existing Vite >500 kB chunk advisory remains (JavaScript approximately 514.5 kB); build succeeds. No Backend/database/Railway changes, deployment or merge to `main`.
