# iPhone GPS, Compass retry and fixed navigation

Date: 2026-10-15. Repository: `Abdulaziz-Shafae/Dal`.

Base: `fix/system-messages-feedback-audit`, **`998407dce1bab22887ffd5e10578af184ba9619e`**.
Branch: [fix/ios-geolocation-permission-retry](https://github.com/Abdulaziz-Shafae/Dal/tree/fix/ios-geolocation-permission-retry).
Implementation commit: recorded after verification.

The single requested branch is isolated in `Dal-ios-retry`. Issues #1–#10 are inherited. No Backend, database, authentication/CSRF, routing endpoint, sharing setting, Railway configuration, deployment or merge into main was changed. Other worktrees and private QA files are untouched.

## Confirmed code defects

1. The GPS resume branch classified an absent, unsupported or rejected `navigator.permissions.query()` as `denied`. `useGroupLocations` then revoked consent and the disabled GPS hook retained that error. Unknown permission is not evidence of a user denying it.
2. `NavigationPermissionDialog` kept `locationRequested` / `sensorRequested` and per-visit attempt refs after failure. A single failed attempt disabled activation for the rest of that visit.
3. A retained denial could overlap a new consent attempt; results lacked attempt/scope identifiers. Old asynchronous permission snapshots could also interfere with a newer native request.
4. The navigation page's GPS activation button called `sensor.enable()` as well as `nav.start()`, unnecessarily coupling GPS and Compass permissions.
5. Compass retry set `waiting` and called `setEnabled(true)` when `enabled` was already true. Its listener effect depended only on `enabled` and `active`; retry therefore did not restart the five-second reading timer. The UI could remain waiting indefinitely after a retry even though no reading arrived.
6. Repeated synchronous sensor activation failures could leave the dialog's click guard set when the visible error status did not change. The guard now also releases when the activation promise completes; a dedicated real-component unit test verifies repeated retries.

The exact cause of missing sensor data on the physical iPhone is not established without its runtime readings/settings. The code defects that prevented useful retries are reproduced and fixed locally; no synthetic heading is substituted.

## GPS lifecycle and retry behavior

- Initial navigation remains **idle**, without a geolocation request or an inferred denial.
- Only a new explicit activation counter or an actively confirmed `granted` permission can start a watch. Re-rendering does not create another request. Unknown, `prompt`, failed or unsupported permission queries pause consent and request manual activation; they are not labeled denied.
- A continued authorized watch keeps delivering location updates. Automatic background/foreground/reconnect resumption requires a confirmed current grant. On browsers unable to verify permission, manual resumption is deliberately required to avoid a new automatic prompt.
- Native error code 1 is **denied**, 3 is **timeout**, 2 is **temporarily unavailable**, and unexpected failures are **error**. Unsupported/insecure contexts have `supported=false` and no useless retry button.
- A new attempt clears the previous point/error. Scope and attempt metadata stop a previous denial or delayed permission response from cancelling a valid retry. Old native callbacks are discarded after cleanup.
- An activation interrupted while the watch is ineligible is consumed, not queued for a later foreground/reconnect event. A new tap is required unless a current grant can be confirmed.
- The native request uses a 20-second acquisition timeout. A 25-second application fallback clears a watch that never produces its timeout callback. Watches are cleared before retry; overlapping taps are rejected. Neither timeout nor retry overrides OS permission settings.
- The same `locationFeedback()` state mapping is used in the dialog and page controls: idle activation, disabled loading, enabled retry after failure, supported-context checks and sharing-settings guards. The page's ready-state Stop GPS action remains available.
- Denial guidance in AR/EN/FR explains that blocked permission must first be allowed in Safari/device settings. A retry does not claim it can override a permanent denial.
- Existing authorization snapshots, group/account scope, sharing schedules/leases, coordinate freshness, route invalidation and privacy guards remain in force. No sharing mode is enabled by the fix.

## Compass lifecycle

- `DeviceOrientationEvent.requestPermission(true)` still executes directly from the trusted click, serialized while pending. The standard's optional absolute flag requests the permissions needed for north-referenced data. See [Device Orientation and Motion](https://www.w3.org/TR/orientation-event/).
- Explicit denial is distinguished from unexpected activation errors. A granted permission and an absent usable reading are separate states.
- Each manual reading retry increments an attempt generation, reattaches/cleans listeners and rearms the five-second timeout. It reuses an existing native grant, rather than opening duplicate native permission requests.
- Both `deviceorientation` and `deviceorientationabsolute` remain supported. `headingFromEvent()` was inspected and left unchanged: valid iOS `webkitCompassHeading` with acceptable accuracy, or an absolute alpha, is used with the existing screen-orientation correction. Relative alpha, invalid headings and invalid accuracy do not invent north.
- No sensor activation is triggered by GPS activation. GPS/Map remain usable without an orientation reading. The existing north-relative fallback remains available.
- A genuine unresolved native permission promise remains pending and cannot safely be force-retried as a second native prompt. Once permission resolves, absent readings are bounded by the reading timer and retry becomes available again.

The [Geolocation specification](https://www.w3.org/TR/geolocation/) distinguishes permission denial, position unavailability and acquisition timeout, including the possibility of OS-level denial despite a browser-level grant. The UI does not promise to bypass either layer.

## Confirmed physical bottom-navigation finding

The user's physical-iPhone scrolling report is treated as a real positioning defect, not a full-page screenshot artifact.

Inspected `style.css`, `design-refinements.css`, `main.jsx`, `Dialog.jsx` and the rendered ancestors: `.app`, `#root`, `body`, `html`. In the local browser baseline, none has a transform, filter, perspective or containment rule creating a different fixed containing block. The bar is a sibling of `.workspace`; Leaflet's transformed map panes are not its ancestors. Dialog scroll locking is cleaned up on dismissal.

The old bar used `position:fixed; bottom:0`. The change retains fixed positioning and inline edges, but browsers supporting dynamic viewport units now use:

```css
.signed-in .bottom-nav {
  top: calc(100dvh - var(--bottom-nav-height));
  bottom: auto;
}
```

This anchors its vertical position to dynamic viewport height instead of the legacy bottom reference as Safari toolbars change. Older browsers retain the existing bottom anchor. Its height still includes `env(safe-area-inset-bottom)`; existing main/footer padding reserves the same height plus content clearance. All five tabs, RTL/LTR, colors, focus behavior and chat-keyboard navigation behavior remain intact. No production scroll/resize JavaScript or sticky replacement was added.

This targets the viewport-reference failure described in [WebKit bug 312149](https://bugs.webkit.org/show_bug.cgi?id=312149). That report supports the choice of correction; it does **not** establish the exact Safari version or internal cause on the user's phone. Dynamic viewport units are described in [WebKit's Safari 15.4 documentation](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/).

The mobile dial measured 300px before and 260px after at 390×844. Compact landscape uses 220px; desktop retains its existing size. Margins and the distance label are reduced only in those mobile/short-height cases. The original dial artwork and calculations are unchanged.

## Verification

- **172 frontend tests PASS**, zero failed/skipped. Fifteen added tests cover unsupported/failed permission queries, idle, actual denial, timeout fallback, unavailable/unexpected failures, retry, permission changes, stale responses, scope isolation, interrupted activation, repeated synchronous activation errors, overlapping taps, native permission serialization, repeated no-reading timeout, iOS and absolute readings, orientation correction, page lifecycle and independent permissions.
- **Frontend build PASS**, 1,697 modules; CSS 73.85kB, JS 530.34kB. The existing Vite chunk-over-500kB advisory remains; code splitting is outside this fix.
- Existing location expiry/privacy, continuous walking, stale-coordinate, sharing schedule, authentication/CSRF, notification destination and translation tests remain green.
- The targeted real-browser regression uses Chrome and Playwright WebKit, all AR/EN/FR, at **390×844, 430×932, 844×390 and 1280×720**. It exercises initial idle, denied → retry → timeout → retry → ready, pending/denied/granted/no-reading Compass, repeated sensor retry and valid iOS heading rotation. It checks watcher/prompt counts and GPS/Compass independence.
- Long Map and Compass pages are scrolled down and up after permission dialogs close. Position assertions compare the fixed bar's bottom against the visual viewport edge, verify all five tabs, inspect ancestors and horizontal overflow, reach the final content control, resize the viewport smaller/larger, simulate orientation changes and test a larger reserved navigation height. The larger-height test checks the spacing contract; it does not emulate an actual iPhone safe-area value.
- The broad regression renders 57 page/state entries per language/viewport/engine, including all 14 existing application views, forms, roles, dialogs, chat composer, empty/error/loading and AI/walking presentation.
- **All final browser runs PASS:** 336 targeted checks per engine (**672**, 24 configurations) plus 513 broad page/layout entries per engine (**1,026**, 18 configurations), totaling **1,698 final entries**. The [browser matrix](IOS_PERMISSION_RETRY_BROWSER_MATRIX.csv) also includes 52 baseline position entries. Final runs had no uncaught page errors or unexpected API/remote requests. Synthetic fixtures intercept all API and map-tile requests. No production credentials, accounts, native-device permissions, Railway, ORS or OpenAI requests are used.
- After the last dialog guard correction, an additional **168 iPhone-size smoke entries PASS** across both engines and AR/EN/FR, alongside the final 172-test suite and build. These are explicitly identified as `final-smoke` in the matrix rather than counted as additional unique viewport coverage.

One broad WebKit run encountered an old-document polling request being cancelled during the test's synthetic account reload. The harness now settles and briefly pauses old-document polling before reload, then resumes the clock immediately in the new document. No application error is filtered out. Mobile WebKit lacks Playwright wheel input, so its tests perform real document scrolling with `scrollBy`; Chrome uses wheel input. These tests do not reproduce Safari's native momentum/toolbar animation.

## Real screenshots

Native 390×844 Chrome viewport screenshots, same synthetic group/member and scroll sequence. **Before/after refers to the navigation CSS and Compass sizing change**, not the GPS implementation baseline. Baseline automation also kept the bar pinned; it does not reproduce or disprove the user's confirmed physical Safari defect.

| Scroll state | Before CSS change | After CSS change |
| --- | --- | --- |
| Compass, scrolling down | [Before](screenshots/ios-retry-before-compass-scroll-down.png) | [After](screenshots/ios-retry-after-compass-scroll-down.png) |
| Compass, scrolling up | [Before](screenshots/ios-retry-before-compass-scroll-up.png) | [After](screenshots/ios-retry-after-compass-scroll-up.png) |
| Map, scrolling down | [Before](screenshots/ios-retry-before-map-scroll-down.png) | [After](screenshots/ios-retry-after-map-scroll-down.png) |
| Map, scrolling up | [Before](screenshots/ios-retry-before-map-scroll-up.png) | [After](screenshots/ios-retry-after-map-scroll-up.png) |

Additional captures: [GPS failure with usable retry](screenshots/ios-retry-after-gps-retry.png), [Compass reading timeout with usable retry](screenshots/ios-retry-after-compass-reading-timeout.png). Images are genuine, unretouched browser captures. No mockup or fabricated physical-device screenshot is included.

## Files changed

- `frontend/src/hooks/useGeolocation.js`
- `frontend/src/hooks/useGroupLocations.js`
- `frontend/src/hooks/useDeviceOrientation.js`
- `frontend/src/utils/navigationPermissions.js`
- `frontend/src/components/navigation/NavigationPermissionDialog.jsx`
- `frontend/src/components/navigation/GroupNavigation.jsx`
- `frontend/src/translations.js`
- `frontend/src/design-refinements.css`
- `frontend/tests/ios-permission-retry.test.mjs`
- `frontend/tests/ios-permission-retry-browser.mjs`
- `frontend/tests/navigation-hooks.test.mjs`
- `frontend/tests/navigation-permissions.test.mjs`
- `frontend/tests/system-feedback-browser.mjs` — updated the GPS retry button selector
- `frontend/tests/responsive-layout-browser.mjs` — stabilized synthetic account reload
- This report, `docs/IOS_PERMISSION_RETRY_BROWSER_MATRIX.csv` and ten linked `docs/screenshots/ios-retry-*.png` files

`main.jsx` and `style.css` were inspected but did not require changes. No dependency changes or private QA files are included. Temporary logs and intermediate browser output remain local outside Git.

## Limits and physical-iPhone retest

**No physical iPhone test was performed.** Desktop WebKit cannot prove Safari's native GPS/sensor permission UI, real magnetometer availability/accuracy, OS-level settings, safe areas, rubber-banding or collapsing browser-toolbars behavior. The CSS correction and automated position assertions require confirmation on the affected phone. This report does not claim that the physical Safari defect is proven resolved.

After a separately approved deployment, test on the affected iPhone: initial permission dialog without a premature denial; allow/deny GPS and retry after changing settings; GPS timeout recovery; Compass allow/deny and repeated no-reading retry; verify rotation only with real heading data. On long Map/Compass pages, scroll both ways with toolbars expanded/collapsed, close permission dialogs, rotate the phone, and confirm the last buttons can scroll above the bar. Record iOS/Safari versions and any remaining drift. Permanent OS denial still requires Settings; an app cannot override it.
