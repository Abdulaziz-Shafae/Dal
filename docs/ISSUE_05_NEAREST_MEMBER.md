# Issue #5 — Compass: nearest group member

Implemented on `feat/compass-nearest-member`, based on `fix/navigation-permission-popup` (`441a0163f16df31a331946c3f1d85d6db38ec2d3`). Issues #1–#4 are preserved.

## Implementation

The Compass previously supported manual destinations but had no nearest-member action. A localized AR/EN/FR button now uses the already-active live GPS reading and chooses the minimum straight-line geographic distance using the existing Haversine `distanceBetween()` calculation. `validCoordinates()` and `locationAge()` enforce the existing 30-second Compass freshness threshold (exactly 30 seconds remains eligible).

Candidates must have a member ID in the current group's membership list, explicit `sharingEnabled: true`, valid coordinates and a recent timestamp. Self, missing/inaccessible locations, stale/invalid locations, foreign-group records and meeting points are excluded. Server-provided authorized locations and the existing sharing/permission checks remain in place; cached own account coordinates cannot substitute for live GPS.

Selection uses the existing `onSelect()` and member state. The existing Compass bearing, heading and live distance calculations are unchanged. The selected member stays stable when GPS updates; another nearest selection requires another button click. Confirmation shows the member, approximate current direct distance and the existing low-accuracy warning (>50 m). It explicitly describes direct distance, not a walking route.

Inactive GPS shows localized guidance and reopens the existing Issue #4 permission dialog only in response to the button click. It does not activate GPS or sensors, change sharing settings or request native permissions. A stale GPS reading or no eligible members produces guidance without changing selection. If access to the selected location is revoked, the normal unavailable-target state replaces the confirmation and arrow.

Nearest selection stops any existing walking preview before changing the target, so it creates no automatic ORS requests. Existing manual selections and explicit walking controls remain functional.

## Files changed/added

- `frontend/src/components/navigation/GroupNavigation.jsx`: nearest action, existing selection and permission-flow integration.
- `frontend/src/components/navigation/LiveCompass.jsx`: button and localized selection/status feedback.
- `frontend/src/utils/nearestGroupMember.js`: small pure eligibility/distance helper.
- `frontend/src/design-refinements.css`: scoped button and feedback styles.
- `frontend/src/translations.js`: five AR/EN/FR message entries.
- `frontend/tests/nearest-member.test.mjs`: ten automated selection, privacy, GPS, localization and integration tests.
- This report and the three screenshots below.

## Validation

| Check | Result |
| --- | --- |
| `npm test` | PASS: 91 tests, 0 failures, 0 skipped |
| `npm run build` | PASS |
| `git diff --check` | PASS |
| Chrome: 390×844 and 1280×720, AR/EN/FR | PASS: 48 browser checks |
| WebKit: 390×844 and 1280×720, AR/EN/FR | PASS: 48 browser checks |

Real local-browser checks used synthetic group/member APIs and simulated GPS/sensor events. They verified the baseline/manual target, nearest selection (~30 m east instead of ~111 m north), existing arrow/distance, unchanged selection after GPS movement, manual selection, ineligible closer candidates, low-accuracy feedback, no eligible members, inactive-GPS guidance and the existing permission dialog. All tested views fit their viewport without horizontal overflow. No application console/page errors were observed; WebKit's existing `interactive-widget` viewport compatibility warning was excluded from the error assertion.

The request checks confirmed no new walking request from nearest selection, no native activation from that action and no sharing-setting writes. All application API calls were intercepted locally; no production API, ORS or Railway operation was performed. Unit/component tests additionally cover exact freshness boundaries, coincident points, missing timestamps, cached-own-location rejection and revoked destination access. Existing navigation, permission, translation and privacy tests passed.

## Real screenshots

All three screenshots use Chrome at 390×844, Arabic mode, the same synthetic group and initial locations, a north-facing sensor heading and the same Compass scroll anchor. They were captured from the real local application; no mockup images were generated.

- [Before: manually selected far member, no nearest action](screenshots/issue-05-before-compass.png)
- [After: new action, same far member still selected](screenshots/issue-05-after-compass.png)
- [Nearest selected: member name, ~30 m and arrow pointing east](screenshots/issue-05-nearest-selected.png)

## Limitations

- Physical phone GPS/Compass calibration and actual iPhone Safari native permission dialogs still require a device test. WebKit here is the Windows browser engine, with simulated permissions and sensors.
- Direct distance does not establish an accessible or shortest walking route. Low GPS accuracy can affect which member is geometrically nearest.
- The existing Vite >500 kB chunk-size advisory remains (main JavaScript approximately 511.8 kB); the build succeeds.
- No merge to `main`, deployment, Backend/database or Railway configuration change.
