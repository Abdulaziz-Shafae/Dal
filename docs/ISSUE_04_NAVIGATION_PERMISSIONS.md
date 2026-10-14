# Issue #4 — Navigation permission popup

Base: `fix/localized-illustrations` at `dfc7fd78d113be722cecda24971d9a257f816f0b`.
Branch: `fix/navigation-permission-popup`. Issues #1, #2, #3 and #3B remain in its history.

## Root cause and implementation

The navigation hooks were activated exclusively from the existing manual controls. Entering Map or Compass had no entry-time UI to identify and explain missing navigation features.

`NavigationPermissionDialog` reuses `Dialog.jsx`, `LanguageContext` and the current translation catalog. `GroupNavigation` mounts it with the page as its key, so each new Map/Compass entry checks requirements while dismissal remains effective during the same visit. The popup also closes after all required readings become ready and stays closed if a reading later becomes unavailable. Already-enabled, previously consented GPS resuming on Map does not flash a new popup.

| Entry state | Popup |
| --- | --- |
| Map, GPS inactive | Location requirement only |
| Map, GPS ready | None |
| Compass, GPS and sensor inactive | Both requirements |
| Compass, GPS ready only | Sensor requirement only |
| Compass, sensor ready only | Location requirement only |
| Compass, both ready | None |

GPS and sensor have separate explicit enable actions. The sensor request runs directly from its button’s trusted click, before awaiting browser permission. Opening, language switching, closing, Escape, and Not now do not start GPS, the sensor or sharing. Existing manual activation controls remain available.

The popup displays loading/waiting, denial and unavailable guidance. Each feature has at most one popup-triggered attempt per visit; users can return after changing browser settings or use the manual controls. Unsupported sensor activation is disabled. Pending orientation requests are serialized in the existing hook, and a granted permission is reused after reading timeout without asking again.

The location hook exposes its existing sharing-state checks for display; its consent, access, scheduling and location-publication rules are unchanged. Disabled global/group sharing or an inactive schedule blocks the popup’s location action and links to the existing account/group settings. The popup never changes these settings.

AR/EN/FR copy updates immediately. The existing language selector is reused inside the popup without remounting its buttons, preserving keyboard focus. Direction follows the language context. The responsive popup scrolls within the viewport and its backdrop covers the header and bottom navigation.

## Files changed

- `frontend/src/main.jsx` — supplies the existing language selector as a stable element tree.
- `frontend/src/components/navigation/GroupNavigation.jsx` — mounts the page-scoped popup.
- New `frontend/src/components/navigation/NavigationPermissionDialog.jsx` — popup, actions and feedback.
- New `frontend/src/utils/navigationPermissions.js` — feature-readiness checks.
- `frontend/src/hooks/useGroupLocations.js` — exposes read-only sharing readiness/availability.
- `frontend/src/hooks/useDeviceOrientation.js` — pending-request guard, requesting feedback and grant reuse.
- `frontend/src/components/navigation/LiveCompass.jsx` — disables its manual permission button while a request is pending.
- `frontend/src/translations.js` — complete AR/EN/FR popup messages.
- `frontend/src/design-refinements.css` — scoped popup styling and backdrop stacking.
- New `frontend/tests/navigation-permissions.test.mjs` — readiness matrix, consent safeguards, dismissal, settings links, translations, pending requests and timeout/grant reuse.
- This report and the four screenshots below.

`Dialog.jsx`, `useGeolocation.js`, existing navigation calculations, APIs, illustration assets, Backend, database and Railway configuration are unchanged. Earlier ORS scripts, private QA files and temporary browser fixtures are not included.

## Verification

- `npm test`: **81 PASS**, 0 failures, 0 skipped.
- `npm run build`: **PASS**, with Vite’s warning that the main minified JS chunk is approximately 508 KB, above its 500 KB advisory threshold. No build configuration or unrelated bundling changes were made.
- `git diff --check`: **PASS**.
- Real local Chrome: **162 PASS**; real local WebKit: **162 PASS**. AR/EN/FR at **390×844** and **1280×720**.
- Additional mobile checks in both engines verify a positive trusted-click/user-activation record for the simulated sensor request, retained focus after language changes, and backdrop coverage of the header.
- Browser checks cover all six entry combinations, location grant/loading/denial, sensor permission pending/grant/waiting/denial/unsupported, one attempt per visit, same-visit dismissal, page re-entry, explicit GPS-only/sensor-only actions, and no sharing-settings writes.
- Bottom navigation, group shortcuts and notification entry work; notification selection, read status and browser Back remain correct.
- No unexpected application console errors or horizontal overflow in checked states. No ORS/OpenAI calls, production requests or actual user data were used.

## Real BEFORE/AFTER screenshots

Matching Chrome **390×844**, Arabic, synthetic QA group, GPS and sensor inactive. BEFORE captures were taken before code changes; AFTER captures show the real custom popup.

| Page | Before | After |
| --- | --- | --- |
| Map | [Before](screenshots/issue-04-before-map.png) | [After](screenshots/issue-04-after-map.png) |
| Compass | [Before](screenshots/issue-04-before-compass.png) | [After](screenshots/issue-04-after-compass.png) |

Desktop and other language states were checked locally; only the four requested screenshots are committed.

## Limitations

Native permissions, GPS positions and orientation readings were simulated inside real browsers. This validates frontend flow and click timing, **not physical sensor accuracy or real iPhone Safari native dialogs**. Physical devices over HTTPS still require manual verification. Browser/device settings determine permission recovery; the popup does not bypass them. A missing sensor reading times out using the existing five-second hook behavior.

No merge into `main`, deployment, Backend/database changes or Railway configuration changes are performed.
