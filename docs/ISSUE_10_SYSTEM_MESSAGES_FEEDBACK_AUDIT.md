# Issue #10 — System messages and feedback audit

Date: 2026-10-15. Repository: `Abdulaziz-Shafae/Dal`.

Base: `fix/full-responsive-layout-audit`, **`98190c2cb2014a113a7bf2a3331be0e3ecb5b7b0`**.
Branch: [fix/system-messages-feedback-audit](https://github.com/Abdulaziz-Shafae/Dal/tree/fix/system-messages-feedback-audit).
Implementation commit: [5ce64884c3013732fe30e76441ca34042d8f3363](https://github.com/Abdulaziz-Shafae/Dal/commit/5ce64884c3013732fe30e76441ca34042d8f3363).

Work is isolated in `Dal-issue-10`. Issues #1–#9 are inherited from the exact base. The original checkout's private ORS/QA work and the Issue #9 worktree are untouched. No Backend, database, authentication/CSRF, API endpoint, routing/authorization calculation, Railway configuration, deployment, or merge into main was changed.

## Inventory and review

Reviewed all 27 frontend JavaScript/JSX source files and both stylesheets. The [message inventory](ISSUE_10_MESSAGE_INVENTORY.csv) records **406 referenced UI/message keys**, their English/French translations and source references. It includes labels that provide feedback context, not only alerts. The complete catalog has **511 keys**; the existing translation tests validate all three languages and interpolation placeholders. Landing `texts` and FAQs have separate coverage in those tests. Unreferenced historical catalog entries were preserved.

| Area / actual screens | Messages and feedback reviewed | Outcome |
| --- | --- | --- |
| Home, menu, footer | Account requirements, language controls, offline guidance, global pause confirmation | Existing localization/direction preserved |
| Login / register | Required/email/password validation, credential errors, busy state, session expiry | Known errors translated; unknown API errors masked; authentication unchanged |
| Forgot / reset password | Conditional email acknowledgement, missing/expired reset link, password requirements/mismatch, completion | Existing safe wording and disabled missing-token submission preserved |
| Create / join | Group-name/code validation, direct join versus approval request, duplicate/invalid/expired-code failures | Success remains conditional on awaited API completion |
| Groups overview | Loading, empty, failed load/retry, pending join requests, active/paused/closed badges | Existing state distinctions preserved |
| Group details — owner/admin/member | Membership/role actions, ownership/remove/leave/close confirmations, sharing status and QR/copy acknowledgement | Replaced unconditional “Your group is ready!” with neutral “Group details”; corrected sharing feedback |
| Account/settings | Save acknowledgement, global pause/resume, schedules, history-delete confirmation | Sharing permission is no longer presented as proof of active GPS transmission |
| Group/private Chat | Loading, empty/no recipient, failed refresh, offline send guards, unread count and authored content | Added explicit status semantics to group loading/empty messages; send/read/retry behavior preserved |
| Notifications | Loading/empty/error/retry, unread state and unavailable/forbidden destinations | Existing exact-destination checks and read behavior preserved |
| Map and GPS | Consent, denied/unsupported/timeout/low accuracy, upload failure, map tile fallback, connected/offline/last received | Added status semantics to global offline and map fallback messages |
| Compass | API absent, idle, native permission pending/denied, waiting, no usable reading, valid heading, GPS separately absent | Shared state-specific localized feedback; no unsupported activation button |
| Meeting point / AI | Permission/selection/unsaved draft, save/delete, no result, explanation source, recommendation and safety warning | Actual API recommendation/warning/details retained; no AI processing changes |
| Location lifecycle | Recent versus last-known, scheduled expiry, WHILE_USING lease expiry, paused or revoked access | Existing fail-closed visibility logic and localized warnings preserved |
| Walking | Initial calculation, ready, refreshing, old geometry, provider failure, unavailable, offline and reconnect | Existing cached-route warning and non-live distance/duration wording preserved |
| Shared feedback / dialogs | Success/status, errors/alerts, busy, confirm/cancel, dismissal/focus, RTL/LTR wrapping | Manual toast dismissal; denial styling; Escape works after disabled control loses focus |

Inspected shared components: `Dialog`, `GroupChat`, `NotificationBadge`, `GroupNavigation`, `LiveMap`, `LiveCompass`, `NavigationPermissionDialog`, `ConnectionStatus`, `MeetingPointPicker`, `MeetingSuggestions`, `ReunionAssistant`; all hooks, services and utilities under `src`, including `api.js`, `i18n.js`, `LanguageContext.jsx` and `translations.js`.

## Confirmed issues and changes

1. **Capability versus readings:** the old message combined an absent orientation API with an API producing no usable heading. The hook now exposes API/context support; `orientationFeedback()` shares the presentation mapping between Compass and the permission dialog. The existing five-second reading timeout, sensor event handling, heading/bearing calculations and native permission flow are unchanged.
2. **Useless activation:** the dialog previously rendered a disabled sensor activation button on unsupported browsers, while Compass offered reactivation. Both now omit sensor activation when the API/context is absent. This is feature detection, not a desktop/mobile assumption.
3. **Unclear permission feedback:** pending, waiting, denied and no-reading states have distinct messages. A denied permission includes browser/device-settings recovery guidance; absence/no reading is informational rather than an urgent error. The arrow's north-relative fallback is explained. No automatic native permission request was added.
4. **Misleading status wording:** existing group details always announced readiness. The heading is now neutral. Sharing labels reuse `globalSharingAllowed()` for presentation and account for pause/schedule; group labels also respect group state. Allowed sharing explicitly still requires GPS and a connection. No permissions or schedule calculation was changed.
5. **Dismissal/accessibility:** success toasts keep their existing timer and gain a localized 44px dismissal button and atomic status announcement. Global offline/map fallback and group-chat loading/empty feedback receive status semantics. Sensor-denial feedback has a restrained existing-palette error treatment.
6. **Keyboard defect found in the real baseline browser:** after a clicked permission button became disabled, focus could move to the document and Escape no longer reached the dialog listener. Escape dismissal now listens on the document while the dialog is mounted, respects the existing busy guard, and cleans up on close. Focus trapping/restoration and body-scroll locking remain intact.

Six new catalog keys have Arabic, English and French copy. Existing language persistence, RTL/LTR, design tokens and Issue #9 widths/navigation rules are preserved. Unknown API errors continue to pass through the existing safe generic translator; technical payloads, stack traces and credentials are not rendered. User-authored content and dynamic AI explanations are preserved rather than rewritten.

## Compass behavior

| Actual condition | Feedback / behavior |
| --- | --- |
| API absent or insecure context | Informational unsupported-browser/context explanation; no sensor activation; north-relative arrow if GPS and destination are available |
| API present, not enabled | Manual activation offered; north-relative explanation |
| Native permission pending | Waiting-for-decision message; activation disabled; no duplicate request |
| Permission denied | Localized settings/retry guidance and denial styling; manual retry available outside the dismissed visit dialog |
| Granted, waiting for usable reading | Waiting message; no claim that a reading is available |
| No usable reading after existing timeout | Explicit no-reading explanation; does not infer whether physical hardware exists; manual reactivation available |
| Valid heading | Existing rotation/bearing behavior; fallback explanation removed |
| GPS unavailable, valid heading | Sensor can remain ready, but distance/destination arrow is unavailable; GPS guidance is independent |
| GPS ready, orientation absent | Direct distance and north-relative destination arrow remain available; maps continue working |

## Verification

- `npm test`: **157 PASS, 0 fail, 0 skipped**, including seven added tests. Tests cover AR/EN/FR sensor messages, capability detection, unchanged north-relative versus heading-relative arrow, independent GPS availability, safe unknown-error fallback, and Escape after a disabled permission control loses focus.
- `npm run build`: **PASS**, 1,697 modules; CSS 73.41 kB and JS 527.33 kB. The existing Vite warning about a chunk over 500 kB remains; bundle splitting is outside this feedback-only task.
- Translation tests cover all 511 catalog entries, placeholder parity, source-key coverage, language switching and direction. Existing privacy/lifecycle, walking refresh/cache/revocation, permission serialization/grant reuse, notification navigation, chat/read/retry and API tests pass.
- Browser matrix: **PASS in all 18 configurations** — Chrome and Playwright WebKit × AR/EN/FR × 390×844, 820×1180, 1280×720. Final runs contain **1,404 checked page/feedback entries**: 513 broad-layout + 189 targeted-feedback entries per engine. See the [complete browser matrix](ISSUE_10_BROWSER_MATRIX.csv). No unexpected API paths/remote hosts or uncaught page errors were observed; synthetic 503 responses in error scenarios are intentional.
- The existing broad browser audit renders **57 page/state entries per configuration**, including all 14 top-level views: home, auth, forgot, reset, create, join, groups, group, map, compass, meeting, chat, notifications, settings. It verifies centering, header/bottom navigation, control wrapping, scroll reachability and chat composer positioning. Its new optional viewport/screenshot flags allow reuse without replacing Issue #9 screenshots.
- The targeted audit renders **21 feedback states per configuration**: confirmation, unsupported permission/Compass, denied, pending, no reading, sensor-ready/GPS-missing, walking ready, unsupported-with-GPS, GPS-denied-with-heading, offline walking, nearest selection, success, privacy confirmation, paused sharing, outside-schedule sharing, allowed-sharing qualification, loading, error, empty and network recovery. It checks actual localized text, roles, RTL/LTR, no horizontal overflow, button availability, manual dismissal, Escape, preserved grant, route warning and recovery.
- All account/group/member/GPS/sensor/API data are synthetic browser fixtures. OSM tile requests are fulfilled with a neutral local image while real Leaflet renders the UI. Unexpected remote requests are blocked. No production account, Railway/ORS/OpenAI request or paid-service test was performed.

## Genuine screenshots

All comparison pairs are native **1280×720 Chrome viewport captures**, English, using the same synthetic fixture and feedback state. Before captures were taken from the unchanged base before implementation. No image was generated, composited or retouched. Loading, generic network error, confirmation and offline-route pairs deliberately demonstrate preserved behavior rather than a redesign. Timestamps naturally differ between runs.

| State | Before | After |
| --- | --- | --- |
| Unsupported desktop Compass | [Before](screenshots/issue-10-before-unsupported-compass.png) | [After](screenshots/issue-10-after-unsupported-compass.png) |
| Unsupported permission panel | [Before](screenshots/issue-10-before-unsupported-permission.png) | [After](screenshots/issue-10-after-unsupported-permission.png) |
| Sensor permission denied | [Before](screenshots/issue-10-before-sensor-denied.png) | [After](screenshots/issue-10-after-sensor-denied.png) |
| No usable sensor reading | [Before](screenshots/issue-10-before-sensor-no-reading.png) | [After](screenshots/issue-10-after-sensor-no-reading.png) |
| Loading groups | [Before](screenshots/issue-10-before-loading.png) | [After](screenshots/issue-10-after-loading.png) |
| Network/service error | [Before](screenshots/issue-10-before-error.png) | [After](screenshots/issue-10-after-error.png) |
| Successful operation | [Before](screenshots/issue-10-before-success.png) | [After](screenshots/issue-10-after-success.png) |
| Confirmation | [Before](screenshots/issue-10-before-confirmation.png) | [After](screenshots/issue-10-after-confirmation.png) |
| Offline walking warning | [Before](screenshots/issue-10-before-offline-walking.png) | [After](screenshots/issue-10-after-offline-walking.png) |

Additional localized captures:

- Arabic, 390×844: [unsupported](screenshots/issue-10-after-unsupported-permission-ar-390x844.png), [denied](screenshots/issue-10-after-sensor-denied-ar-390x844.png), [no reading](screenshots/issue-10-after-sensor-no-reading-ar-390x844.png).
- French, 820×1180: [unsupported](screenshots/issue-10-after-unsupported-permission-fr-820x1180.png), [denied](screenshots/issue-10-after-sensor-denied-fr-820x1180.png), [no reading](screenshots/issue-10-after-sensor-no-reading-fr-820x1180.png).

## Changed files

Production presentation/capability files:

- `frontend/src/Dialog.jsx`
- `frontend/src/main.jsx`
- `frontend/src/translations.js`
- `frontend/src/design-refinements.css`
- `frontend/src/hooks/useDeviceOrientation.js`
- `frontend/src/utils/navigationPermissions.js`
- `frontend/src/components/GroupChat.jsx`
- `frontend/src/components/navigation/LiveCompass.jsx`
- `frontend/src/components/navigation/LiveMap.jsx`
- `frontend/src/components/navigation/NavigationPermissionDialog.jsx`

Tests/evidence:

- `frontend/tests/navigation-permissions.test.mjs`
- `frontend/tests/system-feedback.test.mjs`
- `frontend/tests/system-feedback-browser.mjs`
- `frontend/tests/responsive-layout-browser.mjs` — optional audit viewport/screenshot controls only
- This report, `docs/ISSUE_10_MESSAGE_INVENTORY.csv`, and `docs/ISSUE_10_BROWSER_MATRIX.csv`
- The 24 explicitly linked `docs/screenshots/issue-10-*.png` images

Temporary generator scripts, detailed local logs, build output, credentials and earlier QA files are excluded from Git.

## Reproducing browser checks locally

Start the local frontend on port 5190 with a non-production proxy target. The browser scripts intercept synthetic API requests and reject a non-local base URL. With Playwright/Chrome/WebKit installed, run from the repository root:

```text
node frontend/tests/system-feedback-browser.mjs after chromium
node frontend/tests/system-feedback-browser.mjs after webkit
```

The broader `responsive-layout-browser.mjs` accepts `DAL_QA_BASE_URL=http://localhost:5190`, `DAL_QA_VIEWPORTS=[[390,844],[820,1180],[1280,720]]`, and `DAL_QA_SCREENSHOTS=false`. This preserves earlier screenshots. Set `DAL_QA_MODULES` only if Playwright is supplied by an external local runtime; `PLAYWRIGHT_BROWSERS_PATH` may identify its browser installation. No credentials are required.

## Limits

These are real browser UI tests with simulated device/API inputs, not tests on physical sensors or iPhone Safari. WebKit on Windows does not prove iOS native permission prompts or real sensor quality. A physical-phone check is still needed for those behaviors. No screen-reader audio session or production integration test was performed; accessibility verification covers markup, keyboard behavior and layout. Browser-native validation UI can differ by platform.

This audit verifies the catalog, referenced application messages and enumerated UI states. It does not claim to enumerate every possible future Backend/AI response or OS permission sheet. Dynamic authored/AI content remains unchanged. Existing polling/retry timing, cached-coordinate visibility, scheduled/lease deadlines and routing authorization are preserved and covered by the existing automated tests.
