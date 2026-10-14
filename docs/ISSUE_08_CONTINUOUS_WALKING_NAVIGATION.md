# Issue #8 — Continuous walking navigation

Date: 2026-10-14. Local implementation and synthetic browser verification only.

Base: `fix/location-sharing-lifecycle`, commit `618f4b0cdeabe9cd56a49f70499253e461b9bda6`.
Branch: [fix/continuous-walking-navigation](https://github.com/Abdulaziz-Shafae/Dal/tree/fix/continuous-walking-navigation).
Implementation commit: recorded after creating the implementation commit.

## Root cause

`useWalkingRoute` replaced a successful result with `LOADING` and excluded it whenever `routeNeedsUpdate()` became true. `LiveMap` draws walking geometry only for `READY`, so both conditions removed the line during recalculation. Offline mode also unmounted the map, losing its rendered tiles, geometry and camera state.

## Implementation

- Successful geometry and its receipt timestamp are separate from request status. Pending refreshes keep the same polyline and display **Updating route...**. A validated successful response replaces geometry, distance and duration together.
- Existing 25-metre origin/destination movement and 30-second successful-route age thresholds remain. There is an 800-ms debounce, at least 10 seconds between request starts, no overlapping requests, and a 30-second automatic backoff after temporary failure. Manual retry uses Start navigation and still respects the request-start limit.
- Generation guards and the current authorization/destination context reject delayed responses after Stop, destination/group/account changes, revocation, expiration, disconnect or revalidation. Successful responses are checked against current visibility and fresh locations again before acceptance.
- Temporary provider failures, network/server failures, HTTP 429 and generic HTTP 400 retain an authorized previous route as outdated. Explicit `LOCATION_UNAVAILABLE`, HTTP 401/403/404/410, and the existing Backend's specific HTTP 400 membership/group/user/meeting-point access errors clear geometry and stop guidance. Raw error responses are not displayed.
- Stop clears geometry and the navigation intent; reconnect never restarts an explicitly stopped route. Nearest-member selection, manual selection, meeting-point selection and existing heading/bearing calculations remain in use.

## Offline and reconnect

The mounted Leaflet map is retained through disconnects. Previously rendered tiles can remain; uncached tiles are not assumed to be available. A cached route is subdued/dashed, labeled **Last calculated route**, and shows the required localized connection warning. Its distance and duration are explicitly described as belonging to the last calculation, not a live ETA. Active guidance is false while the route is outdated or offline.

Tile failures hide the map through a DOM wrapper, without destroying Leaflet. The existing coordinates/information fallback remains, with cached route information and warning in the walking card. Its controls stay in normal flow below the floating group header, so Retry remains usable. Restoring the map invalidates its size without resetting the camera.

Reconnect reuses Issue #7's access/settings/member/group/visibility refresh. Geometry is hidden during permission revalidation, retained only in component memory. Once authorization and destination visibility pass, it can be shown as an outdated reference while waiting for fresh browser GPS and the new route. Cached account coordinates cannot replace a fresh GPS reading. A successful new calculation restores the current-route status. Invalid authorization or stale locations clear geometry and stop guidance.

Disconnect also immediately marks an in-flight group snapshot offline. A late snapshot cannot falsely restore a connected state. Route dispatch checks actual browser connectivity as well as the navigation connection state.

## Privacy and freshness

- Server-authoritative `visibleUntil` remains mandatory for member destinations. Known SCHEDULED and WHILE_USING deadlines purge geometry at expiration, including offline. ALWAYS last-known visibility is not confused with route freshness.
- New walking requests require own GPS and member locations no older than 30 seconds. Existing fixed meeting points do not require member timestamps.
- The selected member must still belong to the current group. Missing/unshared/invalid locations, replaced or removed meeting points, sharing revocation and authorization-period changes invalidate routes.
- User/group context changes, logout, GPS consent withdrawal and Stop clear the route. No private route geometry is persisted in localStorage or IndexedDB.
- `NavigationAssistanceService` was reviewed: it checks current membership, authorized location DTOs and 30-second freshness before routing, and repeats these checks after provider/cache work. **No Backend changes were required.** The Issue #7 migration is unchanged.

## Files changed

| File | Purpose |
| --- | --- |
| `frontend/src/hooks/useWalkingRoute.js` | Separate geometry/request state; safe retention, refresh, retry and async guards |
| `frontend/src/hooks/useGroupLocations.js` | Expose current route authorization context; immediate pending-snapshot disconnect handling |
| `frontend/src/components/navigation/GroupNavigation.jsx` | Fresh GPS routing inputs; localized current/updating/outdated/error/expiration states |
| `frontend/src/components/navigation/LiveMap.jsx` | Retain Leaflet; subdued cached geometry; hidden-wrapper tile fallback and sizing recovery |
| `frontend/src/design-refinements.css` | Scoped route status styling and fallback control clearance |
| `frontend/src/translations.js` | Arabic, English and French route status/warning/timestamp translations |
| `frontend/tests/continuous-walking.test.mjs` | Deterministic fake-clock route lifecycle and failure tests |
| `frontend/tests/final-features.test.mjs` | Update previous offline-clear expectation to safe outdated retention |
| `frontend/tests/location-lifecycle.test.mjs` | Pending group snapshot disconnect regression |
| `frontend/tests/nearest-member.test.mjs` | Real GroupNavigation integration: cached own coordinates cannot initiate walking |
| `frontend/tests/continuous-walking-browser.mjs` | Portable local-only Chrome/WebKit synthetic browser verification |
| `docs/screenshots/issue-08-*.png` | Four actual browser screenshots |
| `docs/ISSUE_08_CONTINUOUS_WALKING_NAVIGATION.md` | This report |

No Backend, database, migration, API, Authentication, CSRF, HttpSession, Railway, OpenAI or ORS service configuration changes. Existing unrelated ORS QA script edits and private/local QA files are excluded from the commit.

## Verification

| Check | Result |
| --- | --- |
| Full `npm test` | **150 PASS**, zero failures/skips |
| `npm run build` | **PASS**, 1,697 modules; existing >500-kB bundle advisory remains |
| `git diff --check` | **PASS** |
| Actual Chrome, AR/EN/FR × 390×844 and 1280×720 | **6/6 PASS** |
| WebKit, AR/EN/FR × 390×844 and 1280×720 | **6/6 PASS** |
| Exact-base BEFORE behavior, Chrome, EN at both sizes | **2/2 PASS**: refresh removes geometry |

Automated tests cover initial calculation, pending geometry, both movement thresholds, elapsed-time refresh, jitter, response replacement, temporary failure/backoff/retry, offline request suppression/outdated status, reconnect authorization/GPS gates, Stop, destination/group/logout invalidation, SCHEDULED/WHILE_USING expiration, manual revocation, stale own/member input, fixed meeting points, replaced meetings, delayed responses, non-overlap, access error classification and all three translations. Time advances use fake timers, not 30-second real waits.

Browser assertions cover a held second request with the previous path visible, dashed offline geometry, unavailable-tile fallback and clickable Retry, the same retained map DOM across recovery, replacement with a successful new route, Stop, remote revocation and its message, nearest-member and meeting-point Compass actions without implicit ORS requests, RTL/LTR, absence of horizontal overflow, and absence of unexpected application console/page errors. Intentional simulated connection/tile failures are excluded from network-error noise.

The browser runner uses isolated synthetic accounts, coordinates and intercepted local API responses. It rejects non-local application URLs. Only public OpenStreetMap display tiles are permitted externally. **Production API/paid ORS calls: zero.**

Reproduce after starting the local frontend on port 5179:

```sh
node frontend/tests/continuous-walking-browser.mjs after chromium
node frontend/tests/continuous-walking-browser.mjs after webkit
```

Playwright/browser executables must be installed. Optional `DAL_QA_MODULES`, `DAL_QA_CHROME`, `PLAYWRIGHT_BROWSERS_PATH`, `DAL_QA_BASE_URL` and `DAL_QA_OUTPUT` select local dependencies/server/output; no device-specific paths or credentials are embedded. `--screenshots` saves screenshots. `before chromium --screenshots` must target the unchanged base checkout's local server.

## Real screenshots

All four use the same synthetic group/member positions, English UI and a 390×844 Chrome viewport. They are native full-page captures; natural page height varies with status content. The fixed bottom navigation remains present in those captures. BEFORE was captured from an isolated checkout of the exact base commit. No pixels were generated or edited.

- [BEFORE — route disappears while refresh is pending](screenshots/issue-08-before-route-refresh.png)
- [AFTER — retained polyline and Updating route...](screenshots/issue-08-after-route-refresh.png)
- [OFFLINE — dashed last route and explicit outdated warning](screenshots/issue-08-after-offline-route.png)
- [RECONNECTED — newly calculated route](screenshots/issue-08-after-reconnected-route.png)

## Limitations

- An offline client cannot detect unknown remote revocations immediately. Known deadlines and local revocations remain enforced; reconnect revalidates and purges inaccessible geometry before any new route.
- Tiles that were never loaded cannot be displayed offline. No tile downloads, service worker or offline mapping system was added.
- Route timestamps identify the client's last successful response; Backend cache responses do not expose the provider's original calculation timestamp.
- Browser tests use synthetic GPS and intercepted routing responses. They do not establish physical GPS/compass performance, actual ORS availability, pedestrian access or Expo indoor coverage. Windows WebKit is not a physical iPhone Safari test.
- The existing Vite bundle-size advisory remains; unrelated bundle restructuring was intentionally outside this issue.

No main merge, production data changes or Railway deployment/configuration changes were performed.
