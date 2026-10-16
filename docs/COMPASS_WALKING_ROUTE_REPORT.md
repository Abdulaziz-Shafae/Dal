# DAL — Walking Route Compass

## Scope and baseline

- Branch: `feat/compass-walking-route-mode`.
- Started from freshly fetched `origin/main`, commit `d3f637b6df53828e9012366fded2f7208ebf82d7`.
- The baseline's production build and 172 frontend tests passed before integration.
- Only frontend Compass integration, its translations/styles, tests, and this evidence were changed. No Backend, database, API contract, Railway configuration, deployment, or main-branch changes were made. Other worktrees and their uncommitted changes were preserved.

## Implementation

The Compass offers **Walking route / Direct direction** through the existing segmented-control styling and AR/EN/FR translation system. A valid current route selects walking mode by default unless the user explicitly chose direct mode. Once walking is shown or selected, losing a route pauses guidance with an explanation; it does not silently switch to direct mode.

`GroupNavigation` still owns exactly one `useWalkingRoute` instance for Map and Compass. The new hook consumes its existing result. It never fetches, starts GPS, changes sharing, enables orientation sensors, or calls a provider. Switching modes makes no route requests. With no route, users can use the existing **Start navigation** control to calculate one.

### Waypoints and distance

1. Backend/Leaflet coordinates are **[latitude, longitude]**, already converted from ORS GeoJSON. They are not reversed again.
2. Memoize validated points and cumulative geographic segment lengths.
3. Project the current live GPS fix onto appropriate route segments. On the first fix, select the closest position along the route, favoring earlier progress at ambiguous crossings.
4. Subsequent fixes search a bounded forward window (30–80 metres, based on movement and accuracy), with a small backwards search allowance. Committed progress never decreases; changes below 3 metres do not advance it. This limits noise and jumps to adjacent return legs.
5. Aim at a point 12–25 metres ahead, capped at the next vertex. Within 6 metres of that vertex, anticipate the next segment. The final destination is used only on the final segment. Existing device heading and north-relative fallback rotate the arrow as before.
6. Show **approximate remaining walking distance** from the route's geometric arc length minus committed progress. This is explicitly approximate and distinct from the existing straight-line distance; it is not an exact survey measurement or an ETA.

Guidance pauses beyond 35 metres from the eligible route corridor, with unknown/invalid GPS accuracy or accuracy worse than 50 metres, and during recalculation. These are conservative prototype heuristics, not a substitute for a pedestrian navigation engine.

### Safety and regressions

Active walking guidance requires a recent live GPS fix, current member location when applicable, valid sharing metadata, group authorization, matching group/destination/authorization route key, a successful positive-distance/positive-duration route, and a route younger than 30 seconds. Offline, outdated, failed, malformed, mismatched, or updating geometry cannot provide a walking arrow or remaining distance.

Backend access rejection also suppresses direct bearing/distance until an authorized destination is available. Sensor denial continues to provide the existing clearly labelled north-relative fallback; it never invents a device heading. Arrival remains manually confirmed. Existing member/meeting selection, nearest-member controls, notifications, sensor retry, GPS retry, and sharing expiry remain in their original handlers.

The following production files are unchanged from main: `useWalkingRoute.js`, `useGeolocation.js`, `useGroupLocations.js`, `useDeviceOrientation.js`, `NavigationPermissionDialog.jsx`, `navigationPermissions.js`, `navigationCalculations.js`, `LiveMap.jsx`, `main.jsx`, and `style.css`. Added CSS selectors apply only inside `.dal-live-compass`; fixed bottom navigation rules are unchanged.

## Files changed

- `frontend/src/components/navigation/GroupNavigation.jsx` — connect the existing shared route state to the Compass hook.
- `frontend/src/components/navigation/LiveCompass.jsx` — selector, route arrow/distance, localized paused-state feedback; preserve direct and sensor behavior.
- `frontend/src/hooks/useWalkingCompass.js` — presentation mode, scope/progress lifecycle, current-route and privacy gates.
- `frontend/src/utils/walkingCompass.js` — pure geometry, projection, progress and waypoint calculations.
- `frontend/src/translations.js` — AR keys and EN/FR equivalents.
- `frontend/src/design-refinements.css` — three scoped responsive Compass-selector/feedback rules.
- `frontend/tests/walking-compass.test.mjs` — 29 targeted tests.
- `frontend/tests/walking-compass-browser.mjs` — portable local-only Playwright harness; no credentials or fixed machine paths.
- `frontend/tests/nearest-member.test.mjs` — scope three existing pressed-button selectors to member controls and supply explicit authorization metadata in the synthetic fixture. Assertions were preserved.
- `docs/screenshots/compass-walking-route/*.png` — real running-application screenshots.
- This report and `docs/COMPASS_WALKING_ROUTE_BROWSER_RESULTS.json` — final verification evidence.

## Verification

| Check | Final result |
|---|---|
| `npm test` | **201 PASS, 0 FAIL, 0 skipped** (172 existing + 29 targeted) |
| `npm run build` | **PASS**, 1,699 modules; CSS 74.72 kB, JS 539.07 kB |
| Targeted Chrome Compass matrix | **9 contexts / 378 checks PASS** |
| Targeted WebKit Compass matrix | **9 contexts / 378 checks PASS** |
| Unchanged main comparison | **6 contexts / 96 checks PASS** across both engines |
| Existing broad responsive regression | **513 Chrome + 513 WebKit audit rows PASS** |
| Final mobile harness smoke after test cleanup | **42 Chrome + 42 WebKit checks PASS** |
| `git diff --check` | **PASS** |
| Screenshot links | **10 genuine PNGs, all report links verified** |

After matrices cover **AR/EN/FR × 390×844, 768×1024, 1280×720 × Chrome/WebKit**. Baseline comparison covers English at the same three sizes in both engines. The targeted checks exercise route progression, small GPS jitter, mode switching, one shared route request, recalculation with no stale arrow, offline pausing, unavailable routes, member/meeting destination changes, stale/revoked sharing, simulated iOS sensor denial/grant/no-reading/retry, GPS denial/retry, no automatic prompts, and fixed five-tab navigation while scrolling after dialogs close. Broad regressions exercise Map, groups, meeting editing, AI panels, chat, notifications, settings and navigation. No application page errors, unexpected requests, or overflow were reported; the existing WebKit viewport notice is listed under limitations.

Machine-readable results: [COMPASS_WALKING_ROUTE_BROWSER_RESULTS.json](COMPASS_WALKING_ROUTE_BROWSER_RESULTS.json). Node.js **v24.21.0**; tests use installed Chrome and desktop WebKit via Playwright.

All account, group, GPS, route and iOS permission/sensor data in browser verification is synthetic. The harness blocks non-local requests and serves neutral map tiles. These tests prove local UI integration, not live ORS availability or physical iPhone sensor behavior.

Reproduction: install the existing frontend lockfile, run the local Vite server, set `DAL_QA_BASE_URL` to its localhost URL, then run `node tests/walking-compass-browser.mjs after chromium` and `... after webkit`. Playwright may be resolved via `DAL_QA_MODULES`; installed WebKit binaries may be selected via `PLAYWRIGHT_BROWSERS_PATH`. Optional `DAL_QA_VIEWPORTS`, `DAL_QA_LANGUAGES`, and `DAL_QA_OUTPUT` control the matrix and local output. No credentials are required.

## Genuine screenshots and comparison

Same synthetic group, initial GPS, member destination and viewport are used before/after. The baseline is an unchanged build exported from the pinned main commit, served separately. Initial direct bearing points toward the member; walking bearing initially points east along the L-shaped path, then north after the corner.

| State | iPhone-sized 390 × 844 | Desktop 1280 × 720 |
|---|---|---|
| Main baseline, direct only | [Before](screenshots/compass-walking-route/before-direct-390.png) | [Before](screenshots/compass-walking-route/before-direct-1280.png) |
| Direct mode after integration | [Direct](screenshots/compass-walking-route/direct-390.png) | [Direct](screenshots/compass-walking-route/direct-1280.png) |
| Walking mode, valid calculated route | [Walking](screenshots/compass-walking-route/walking-route-390.png) | [Walking](screenshots/compass-walking-route/walking-route-1280.png) |
| After waypoint progression | [Progress](screenshots/compass-walking-route/waypoint-progress-390.png) | [Progress](screenshots/compass-walking-route/waypoint-progress-1280.png) |
| Route unavailable, no walking arrow | [Unavailable](screenshots/compass-walking-route/unavailable-390.png) | [Unavailable](screenshots/compass-walking-route/unavailable-1280.png) |

Screenshots are unedited Playwright captures of the actual running UI. The iPhone-sized viewport is simulated, not a physical device. Content is scrollable; screenshot framing does not imply all controls fit in one viewport. Scroll assertions verify the five fixed navigation tabs and the last controls remain accessible.

## Limitations and risks

- No physical iPhone was tested. Desktop WebKit cannot prove Safari hardware sensors, native OS permissions, GPS drift, safe-area rendering on a real notch, or dynamic Safari toolbars. Field testing remains necessary.
- No real ORS/OpenAI/production API calls were made. Existing external-map indoor coverage and closure warnings remain applicable. Walking routes do not establish access to Expo's internal paths, floors, or restricted areas.
- Tight loops, parallel walkways and inaccurate GPS can be ambiguous; the bounded progress policy pauses rather than intentionally jumping to a distant segment. Existing movement/time refresh logic handles recalculation.
- A pre-existing desktop WebKit console notice says the `interactive-widget` viewport hint is unsupported and ignored. It is recorded separately by the harness and also observed on unchanged main; unrelated viewport configuration was not modified.
- Vite retains the pre-existing advisory about a JavaScript chunk exceeding 500 kB. No unrelated bundling changes were made.

## Publication

Final feature implementation Commit SHA: **[`d6986394f7f5ecb8df80f102d85d2babc462dbd8`](https://github.com/Abdulaziz-Shafae/Dal/commit/d6986394f7f5ecb8df80f102d85d2babc462dbd8)**. This report and the machine-readable results are committed afterward so they can reference the actual feature SHA. The final branch HEAD (including the report commit) is supplied in the delivery message; obtain it locally with `git rev-parse feat/compass-walking-route-mode`.

Branch: [feat/compass-walking-route-mode](https://github.com/Abdulaziz-Shafae/Dal/tree/feat/compass-walking-route-mode).

No merge into main or deployment was performed. `origin/main` was verified at the unchanged baseline SHA before publication. No approval to merge or deploy is implied by publication of this branch.
