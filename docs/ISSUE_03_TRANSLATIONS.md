# Issue #3 — DAL language translations

Base: `fix/notification-navigation` at `7b7a60a987852b92d81f09b7c9be211721b95542`.
Branch: `fix/language-translations`. Issues #1 and #2 remain in its history.

## Cause and implementation

The existing AR/EN/FR dictionaries covered the landing page. Authenticated screens, shared controls, validation feedback and system messages mostly used Arabic literals. Workspace, dialogs and bottom navigation forced RTL independently of the selected language. The group QR heading also explicitly used the Arabic landing dictionary.

The existing dictionaries and FAQ copy now live in `frontend/src/translations.js`, alongside 464 application messages with English and French translations. Arabic message keys retain the original copy. A small React context shares the existing language selection; no i18n library or additional translation service was introduced.

Labels, placeholders, accessibility names, dialogs, notifications, connection/GPS statuses, walking route feedback, known backend error messages and fixed AI recommendations/warnings use the shared translator. Stored known messages are rendered in the current language. Template substitutions preserve member/group names. User-authored messages are preserved. Unknown errors receive a localized generic message; raw backend details are not displayed.

Language switching updates visible content, page metadata and direction immediately. The existing localStorage preference survives navigation and reload. AR uses RTL; EN/FR use LTR, including dialogs and Leaflet labels. Map compass bearings and geographic coordinates retain their existing behavior.

Layout changes are limited to direction-aware controls, wrapping navigation labels, allowing translated text-only send buttons to fit, and containing the rotated compass SVG within its existing dial.

## Scope inspected

All existing frontend pages and source components were inspected:

- `main.jsx`: Home, header, main menu, bottom navigation, footer/FAQ, login/register, password recovery/reset, group creation/joining/list/detail/admin/requests, private chat, notifications, settings, confirmations, toasts and validation.
- `Dialog.jsx`, `components/GroupChat.jsx`, `components/NotificationBadge.jsx`.
- `components/navigation/GroupNavigation.jsx`, `LiveMap.jsx`, `LiveCompass.jsx`, `MeetingPointPicker.jsx`, `MeetingSuggestions.jsx`, `ReunionAssistant.jsx`, `ConnectionStatus.jsx`.
- `api.js`, `utils.js`, `utils/notificationNavigation.js`, `utils/navigationCalculations.js`.
- `hooks/useWalkingRoute.js`, `useGroupLocations.js`, `useGeolocation.js`, `useDeviceOrientation.js`, `services/locationService.js`.
- Existing stylesheet direction and responsive rules, HTML metadata, and all nine original image assets.

API, hooks and notification-routing logic are preserved; their known display messages are localized at the presentation layer.

## Image audit and remaining limitations

| Asset/content | Result |
| --- | --- |
| `compass-art.png` | Arabic original preserved; matching EN/FR vector variants use N/E/S/W and N/E/S/O. |
| `hero-phone.png`, `map-art.png`, `meeting-art.png` | Embedded Arabic remains. Editable text layers are unavailable; reliably translating these detailed raster compositions while preserving their original design requires localized source artwork. No masking or CSS hiding was used. |
| `logo-white.png` | DAL branding preserved, including Arabic brand lettering. |
| `hero.webp`, `expo-aerial.webp`, `design-group-cover.png`, `design-hero-mobile.png` | No user-interface text requiring localization was found. |
| Free-form AI explanations | Known fixed recommendations, warnings and fallback explanations translate. Arbitrary generated explanations remain in their original language, without dropping safety content or changing meaning; their paragraphs use automatic text direction. No backend/OpenAI change or translation API was added. |
| Names, group codes, authored chat messages | Preserved as authored; language selection does not rewrite user data. |
| OpenStreetMap tile labels and provider/product names | External map labels keep the map provider’s language; proper names and licensing identifiers remain intact. |

This is verified coverage of application labels and known messages, **not a claim of complete localization of embedded raster artwork, arbitrary AI output, or external map tile text**.

## Validation

- `npm test`: **62 PASS**, 0 failures, 0 skipped.
- `npm run build`: **PASS**.
- `git diff --check`: **PASS**.
- Automated tests cover all literal translation calls in React sources, Arabic JSX text/attributes, catalog completeness/interpolation, landing dictionary/FAQ parity, known message translation, original authored content, localized location age, live App language switching, persistence across views/remounts, and RTL/LTR.
- Real local Chrome and WebKit browser verification uses AR/EN/FR at **390×844** and **1280×720**, with synthetic API/account/location fixtures. No production account, Railway, OpenAI or ORS request is used.
- Checked Home, menu, footer, compass artwork, groups/detail, map, denied GPS, offline status, simulated sensor heading, walking READY card, AI panels/details, meeting selection/candidates, group/private chat, composer above bottom navigation, settings/confirmation, notification destination/read status/back, refresh persistence, login/error/register, create/join, and recovery/reset views.
- Browser matrix: **210 PASS in Chrome + 210 PASS in WebKit**; no unexpected application errors or horizontal overflow in the checked states.
- Local mocked route and AI responses verify frontend rendering only, not external-service availability. WebKit on Windows is not a physical iPhone Safari test.
- Existing WebKit warning about unsupported `interactive-widget` viewport metadata is excluded from application-error checks. The deliberate invalid-login 400 response is expected.

## Real screenshots

The required pairs are real Chrome viewport captures of the same signed-in Home state at 390×844, before editing and after the fix. All test data is synthetic.

| Language | Before | After |
| --- | --- | --- |
| English | [Before](screenshots/issue-03-before-en.png) | [After](screenshots/issue-03-after-en.png) |
| French | [Before](screenshots/issue-03-before-fr.png) | [After](screenshots/issue-03-after-fr.png) |

Additional captures: [EN menu](screenshots/issue-03-menu-en.png), [FR menu](screenshots/issue-03-menu-fr.png), [EN footer](screenshots/issue-03-footer-en.png), [FR footer](screenshots/issue-03-footer-fr.png), [EN compass artwork](screenshots/issue-03-compass-en.png), [FR compass artwork](screenshots/issue-03-compass-fr.png).

## Files changed

- `frontend/src/main.jsx`, `Dialog.jsx`, `design-refinements.css`, `utils/navigationCalculations.js`.
- `frontend/src/components/GroupChat.jsx`, `NotificationBadge.jsx` and the seven navigation components listed above.
- New: `frontend/src/LanguageContext.jsx`, `i18n.js`, `translations.js`.
- New: `frontend/tests/language-switching.test.mjs`, `translations.test.mjs`.
- New: `frontend/public/assets/compass-art-en.svg`, `compass-art-fr.svg`.
- This report and the ten `docs/screenshots/issue-03-*.png` captures linked above.

No backend, database, Railway configuration, production test script, credentials, temporary files or earlier private QA reports are included. No merge to `main` or deployment is performed.
