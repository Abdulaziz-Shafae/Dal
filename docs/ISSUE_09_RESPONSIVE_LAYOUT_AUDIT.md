# Issue #9 — Responsive layout and page centering audit

Date: 2026-10-15. Repository: `Abdulaziz-Shafae/Dal`.

Base: `fix/continuous-walking-navigation`, commit `97829d74b604f948e72e046af99d4ed31f03ad69`.
Branch: [fix/full-responsive-layout-audit](https://github.com/Abdulaziz-Shafae/Dal/tree/fix/full-responsive-layout-audit).
Implementation commit: [7734c987c4e07e78c6d2113df358c989c48106f3](https://github.com/Abdulaziz-Shafae/Dal/commit/7734c987c4e07e78c6d2113df358c989c48106f3).

Work was performed in a separate Git worktree (`Dal-issue-09`). The original checkout and Issue #10's branch/uncommitted files were not changed. No merge/cherry-pick from Issue #10, main merge, Backend/database/Auth/CSRF/production-setting change or Railway deployment was performed.

## Actual page/component inventory

`main.jsx` has **14 top-level view values**: home, auth, forgot, reset, create, join, groups, group, map, compass, meeting, chat, notifications and settings. There is no separate dashboard route: Groups is the authenticated group overview; signed-in Home remains the actual landing page.

All these views were rendered in both engines, all three languages and all nine requested viewport sizes. The audit contains **57 page/state entries per configuration**, rather than treating every control or state combination as a separate page.

| View / section | States actually rendered and checked |
| --- | --- |
| Home | Signed-in and guest; hero, tools, public Compass/meeting illustrations, CTA, FAQ, expanded FAQ and footer |
| Authentication | Login and registration forms |
| Password recovery | Forgot password; reset form with synthetic token; reset without a token |
| Create / join | Group creation, expanded join-mode options and join-by-code form |
| Groups / dashboard | Populated groups and pending requests; empty, error and held loading responses |
| Group details | Owner, admin and member layouts; QR/share card, member rows, sharing controls and management forms; long-name stress case |
| Map | Location permission dialog, fresh simulated GPS, member selection, walking-route result, Reunion result and expanded details |
| Compass | Sensor permission dialog, existing north-reference fallback, nearest-member selection and meeting-point selection |
| Meeting point | Existing point, actual Leaflet map-click draft selection, manager form, candidate input, AI result/details and delete confirmation |
| Chat | Group and private conversations, 25-message scrolling panes, no selected private member, empty/error/loading group conversation, composer, focus and reduced-height keyboard simulation |
| Notifications | Populated, empty, error and loading layouts |
| Account / sharing settings | Account form, sharing mode/interval/scheduling controls and sharing confirmation |
| Shared dialogs | Main menu, group-close confirmation, sharing confirmation, meeting-delete confirmation, location and sensor permission panels |
| Shared navigation | Workspace header, all five bottom-navigation items, ordinary viewport scrolling and final visible controls on long pages |

Inspected components: `main.jsx`, `Dialog.jsx`, `GroupChat.jsx`, `NotificationBadge.jsx`, `GroupNavigation.jsx`, `LiveMap.jsx`, `LiveCompass.jsx`, `MeetingPointPicker.jsx`, `MeetingSuggestions.jsx`, `ReunionAssistant.jsx`, `NavigationPermissionDialog.jsx`, `ConnectionStatus.jsx`, and their rules in both stylesheets. Component markup and business logic were left unchanged.

## Findings and exact fixes

1. **Capped group panels were pushed to one side on tablets.** The 761–1100px rule replaced `.panel`'s automatic margins with 24px margins. Group details retain an intentional 650px maximum width, so they no longer filled that space or centered. At 820px the measured margins were **24 / 146px**, and at 1024px **24 / 350px** in LTR; RTL reversed the imbalance. The tablet rule now supplies `width:calc(100% - 48px)` and `margin-inline:auto`, allowing each existing maximum width to cap and center the panel. The corresponding after margins are **85 / 85px** and **187 / 187px**.
2. **The workspace logo was offset by 28px.** A flex header with `space-between` placed its center item between unequal back-button and action groups. A symmetric three-column grid (`minmax(0,1fr) auto minmax(0,1fr)`) now anchors the logo to the viewport center while preserving logical start/end alignment for controls. Header heights, stickiness, colors, icons and labels are unchanged. The after checks measured zero logo offset across relevant views in AR/EN/FR.
3. **Footer language controls extended outside narrow tablet containers.** Their unwrapped flex row exceeded the final footer column at 768, 820 and 834px. Allowing `.footer-grid .languages` to wrap keeps controls inside the existing column, without changing the footer grid, text, font or colors.
4. **French group-chat Send text was clipped.** `Envoyer` could not fit the fixed 48px circular button; the real BEFORE capture shows the truncation. Text-only composer buttons now use intrinsic width, a 48px minimum and inline padding with the same 24px corner radius. Private-chat icon-only Send buttons retain their original circle. No message text, bubble styles or sending logic changed.
5. **Functional map/meeting surfaces inherited the 500px handset cap on larger screens.** Above 760px, Map and Meeting now use `min(1040px, 100% - 48px)`. This provides usable tablet/desktop map width without scaling or stretching map geometry. Compass intentionally retains its existing compact width and dial; auth forms, group details and chat retain their readable existing caps. Mobile widths are preserved.

These changes are **12 added CSS lines and one replaced line** across two stylesheets. No arbitrary offsets were added to center pages, and no message-only selectors or translations were edited.

## Fixed bottom navigation: finding versus screenshot artifact

The existing fixed bar is correctly anchored to the bottom of the **visible viewport**. Its position midway through a full-page stitched screenshot is not evidence that it moved into the middle of the actual screen. This audit uses ordinary viewport screenshots and actual document scrolling for that check.

- All five items fit and remain within the bar at the requested normal viewport sizes.
- The bar's bottom matched `innerHeight` within one pixel during normal views and scrolling.
- Existing workspace padding reserves the bar height plus 24px and retains safe-area handling.
- **2,214 after checks** scrolled the last genuinely visible enabled control into view and confirmed it could clear the bar. Contents of closed `<details>` panels were excluded from that visibility calculation.
- All **54 group-composer position checks** passed; the input did not overlap navigation.
- Existing chat focus intentionally hides bottom navigation and restores it after blur. Reduced-height viewport simulations verified input accessibility while focused. This existing behavior was preserved, not presented as proof of native iPad keyboard handling.

## Responsive test matrix

| CSS viewport | Chrome AR / EN / FR | WebKit AR / EN / FR |
| --- | --- | --- |
| 390×844 | PASS / PASS / PASS | PASS / PASS / PASS |
| 768×1024 | PASS / PASS / PASS | PASS / PASS / PASS |
| 820×1180 | PASS / PASS / PASS | PASS / PASS / PASS |
| 834×1194 | PASS / PASS / PASS | PASS / PASS / PASS |
| 1024×768 | PASS / PASS / PASS | PASS / PASS / PASS |
| 1180×820 | PASS / PASS / PASS | PASS / PASS / PASS |
| 1194×834 | PASS / PASS / PASS | PASS / PASS / PASS |
| 1280×720 | PASS / PASS / PASS | PASS / PASS / PASS |
| 1440×900 | PASS / PASS / PASS | PASS / PASS / PASS |

**54 browser/language/viewport configurations; 3,078 post-fix audit rows; zero post-fix layout failures.** Chrome and WebKit each produced 1,539 rows. Public two-column/asymmetric compositions were kept; centering assertions apply to the intended containing surfaces, not every child.

[Complete measured before/after matrix](ISSUE_09_LAYOUT_MATRIX.csv) records each engine, page/state, language, viewport, left/right margins, widths, margin imbalance, available header measurements, overflow, clipping, navigation checks, control reachability and after result. Blank values mean not applicable or not collected by that baseline probe; they were not inferred. Composer entries have their own overlap measurement. `after_render_height` distinguishes the supplementary reduced-height keyboard cases from the original viewport.

The baseline WebKit fixture initially retained an earlier loading request when more than one fetch was waiting. The fixture was corrected to release **all** held requests and settle document navigation. Only affected/remaining baseline configurations were rerun; accepted baseline rows were retained. The final full post-fix runs completed without uncaught page errors. Intentional synthetic 503 responses exercised existing error layouts, not a production outage.

## Tests and build

| Check | Result |
| --- | --- |
| `npm test` | **150 PASS**, zero failures/skips |
| `npm run build` | **PASS**, 1,697 modules; CSS 73.02kB, JS 524.80kB |
| `git diff --check` | **PASS** |
| Chrome responsive regression runner | **1,539 rows PASS** |
| WebKit responsive regression runner | **1,539 rows PASS** |

The existing static-server tests require `dist`, so in a fresh worktree the build was run before the complete test suite. The pre-existing >500kB Vite chunk advisory remains; bundle restructuring is outside this issue.

Automated browser regressions live in `frontend/tests/responsive-layout-browser.mjs`. After installing frontend dependencies and starting the local Vite server on port 5189:

```sh
node frontend/tests/responsive-layout-browser.mjs after chromium
node frontend/tests/responsive-layout-browser.mjs after webkit
```

Playwright and the relevant browser binaries must be available. `DAL_QA_MODULES` can select an existing Playwright installation; `DAL_QA_BASE_URL` permits only localhost/127.0.0.1; `DAL_QA_OUTPUT` selects local logs. `PLAYWRIGHT_BROWSERS_PATH` selects installed WebKit binaries. No device-specific paths or credentials are embedded. The runner measures real rendered geometry and fails on unexpected app/API paths, uncaught page errors, unbalanced containers, clipped controls, text overflow, bar displacement or inaccessible final controls.

## Genuine viewport screenshots

These are **32 native Chrome viewport PNGs**, totaling about **4.65MiB**, not full-page stitched images or generated mockups. PNG dimensions were verified against their filenames. BEFORE was captured before CSS edits at the exact base commit. AFTER uses the implemented CSS. Both use the same synthetic account/group/member locations and the stated language/viewport. Fresh-location/message timestamps naturally vary between captures.

| Page | Portrait 820×1180 BEFORE / AFTER | Landscape 1024×768 BEFORE / AFTER |
| --- | --- | --- |
| Home | [Before](screenshots/issue-09-before-home-820x1180.png) / [After](screenshots/issue-09-after-home-820x1180.png) | [Before](screenshots/issue-09-before-home-1024x768.png) / [After](screenshots/issue-09-after-home-1024x768.png) |
| Groups | [Before](screenshots/issue-09-before-groups-820x1180.png) / [After](screenshots/issue-09-after-groups-820x1180.png) | [Before](screenshots/issue-09-before-groups-1024x768.png) / [After](screenshots/issue-09-after-groups-1024x768.png) |
| Map | [Before](screenshots/issue-09-before-map-820x1180.png) / [After](screenshots/issue-09-after-map-820x1180.png) | [Before](screenshots/issue-09-before-map-1024x768.png) / [After](screenshots/issue-09-after-map-1024x768.png) |
| Compass | [Before](screenshots/issue-09-before-compass-820x1180.png) / [After](screenshots/issue-09-after-compass-820x1180.png) | [Before](screenshots/issue-09-before-compass-1024x768.png) / [After](screenshots/issue-09-after-compass-1024x768.png) |
| Group chat | [Before](screenshots/issue-09-before-chat-group-820x1180.png) / [After](screenshots/issue-09-after-chat-group-820x1180.png) | [Before](screenshots/issue-09-before-chat-group-1024x768.png) / [After](screenshots/issue-09-after-chat-group-1024x768.png) |
| Group details — centering defect | [Before](screenshots/issue-09-before-group-owner-820x1180.png) / [After](screenshots/issue-09-after-group-owner-820x1180.png) | [Before](screenshots/issue-09-before-group-owner-1024x768.png) / [After](screenshots/issue-09-after-group-owner-1024x768.png) |
| Footer | [Before](screenshots/issue-09-before-footer-820x1180.png) / [After](screenshots/issue-09-after-footer-820x1180.png) | [Before](screenshots/issue-09-before-footer-1024x768.png) / [After](screenshots/issue-09-after-footer-1024x768.png) |

- French Send-label defect at 1024×768: [Before](screenshots/issue-09-before-chat-group-fr-1024x768.png) / [After](screenshots/issue-09-after-chat-group-fr-1024x768.png).
- Ordinary viewport scrolling, fixed navigation at 820×1180: [Before](screenshots/issue-09-before-bottom-navigation-scroll.png) / [After](screenshots/issue-09-after-bottom-navigation-scroll.png).

## Files changed

- `frontend/src/style.css` — tablet container sizing and automatic logical margins.
- `frontend/src/design-refinements.css` — symmetric header, wrapped footer controls, intrinsic text Send button and larger map/meeting surfaces.
- `frontend/tests/responsive-layout-browser.mjs` — reproducible real-browser layout regression audit using synthetic data.
- `docs/ISSUE_09_LAYOUT_MATRIX.csv` — 3,078 before/after comparison rows.
- `docs/ISSUE_09_RESPONSIVE_LAYOUT_AUDIT.md` — inventory, findings, validation and evidence.
- `docs/screenshots/issue-09-*.png` — the 32 linked genuine captures.

No changes to `main.jsx`, component markup, translations, message wording/bubbles, sensor-support feedback, GPS/Compass/routing logic, OpenAI, ORS, Backend or dependency manifests. Temporary scripts, raw logs, dependency/build folders and unrelated/private QA files are excluded.

## Remaining limitations

- Tests used real installed Chrome and Windows Playwright WebKit, not physical iPads/iPhones. Retina scaling, actual iPadOS Safari chrome/toolbars, native keyboards/date pickers, rotation transitions and nonzero hardware safe-area insets still need physical-device confirmation.
- All account/group/navigation/AI/chat/API responses and GPS positions were intercepted synthetic fixtures. Map display tiles were neutral local fixtures, so screenshots verify the actual Leaflet UI/layout but not real map data or provider availability. **No production API, paid ORS/OpenAI call or real account/group mutation was made.**
- Existing chat focus hides the bar while editing, as noted above; native keyboard behavior is not proven by resizing a desktop viewport.
- The audit covers every existing top-level page and the 57 listed representative major states, not every possible data/permission/message-length combination. Unsupported-device message content/capability feedback remains Issue #10's separate scope.
- The existing bundle-size advisory remains. No unresolved layout failure was observed in the required post-fix matrix.
