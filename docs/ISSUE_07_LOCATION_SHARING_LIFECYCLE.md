# Issue #7 — Location sharing lifecycle

## Minimal design (before implementation)

The current Frontend uses a universal five-minute cache cutoff and conflates permission, freshness and connectivity. Backend retains coordinates in MySQL but does not enforce WHILE_USING inactivity; pause/resume and new schedules can expose an earlier period's row. Walking routes currently allow five-minute-old member destinations.

- MySQL remains authoritative; no browser location persistence or offline synchronization is added. In-memory snapshots are scoped to the authenticated account/group and restored only from authorized API reads.
- Add nullable server activity timestamps to location rows and nullable authorization boundaries to global settings and group memberships. Legacy rows without activity metadata are hidden until a fresh authorized measurement arrives; no historical data is deleted or backfilled as live.
- SCHEDULED retains the last authorized coordinates until its absolute UTC end. ALWAYS retains them while permissions remain valid. WHILE_USING expires after a 90-second server-time lease, renewed through the existing authenticated/CSRF-protected location update workflow every 30 seconds while navigation remains active, including stationary GPS readings without changing their measurement timestamp.
- Global/group pause, resume, new schedule/mode and group-status transitions advance authorization boundaries. Rows must belong to the current authorized period; membership and group permissions are checked on every read.
- Extend location responses with explicit nullable `visibleUntil` (null only for unbounded authorized visibility). Frontend fails closed on missing/invalid metadata, expires cached rows locally, preserves meeting points separately, and revalidates immediately on reconnect.
- Freshness remains 30 seconds for member navigation. Both Frontend and Backend reject new routes to stale member destinations; fixed meeting points do not need member timestamps.

Offline devices cannot learn about a remote manual revocation immediately. They enforce known deadlines, label snapshots as cached/last known, and purge unauthorized rows on reconnect. No browser-close detection or background GPS tracking is claimed.



## Implemented authorization and lease rules

| Mode | Visibility while authorized | Freshness and expiration |
| --- | --- | --- |
| SCHEDULED | Latest accepted measurement from the current absolute interval | Retained even for hours without updates; hidden at the exact UTC end |
| WHILE_USING | Latest accepted measurement while authenticated activity renews its lease | Server activity time + 90 seconds; no successful browser-close event needed |
| ALWAYS | Latest accepted measurement in the current authorization period | No time-based visibility deadline; permissions and membership still checked on every read |

The server checks global authorization, member/group pause or closure, schedule bounds, membership, measurement/receipt authorization boundaries and lease expiry. Ineligible responses have null coordinates, accuracy and recorded timestamp and `sharingEnabled=false`. Authorization change boundaries are strict, including equal clock ticks; schedule start is inclusive and end exclusive. New periods require a new measurement after approval, rather than relabeling an older row. Joining/rejoining a group cannot make a pre-membership measurement visible. Timed pause expiry also requires a measurement after the pause boundary.

Activity uses `activity_at`, captured from the server clock when the update enters the service, before locking/processing. Delayed processing cannot turn an old request into new activity, and activity timestamps do not regress. A stationary heartbeat must exactly match the latest stored measurement's timestamp, coordinates and accuracy and still belong to the current global period. Older/mismatched payloads do not renew activity. New measurements must pass the existing account-creation/future-time/finite-coordinate validation and be no more than 30 seconds old. A sample outside the current period cannot replace the last authorized fix. A heartbeat preserves `recordedAt` and does not create a fake GPS measurement. The authenticated session and existing CSRF-protected update endpoint are reused; no heartbeat endpoint is introduced.

The Frontend uploads a bounded stationary heartbeat every 30 seconds even when the selected measurement interval is longer. A lease can therefore survive two missed heartbeat opportunities, but expires no later than 90 seconds after the last accepted activity. A valid session alone or reading locations does not renew the lease. The lease is per user/latest measurement, not a browser/device-close detector.

## Response contract and cache invalidation

The existing location DTO gains only `visibleUntil` (explicit null for unbounded authorized visibility; an ISO UTC deadline otherwise). Explicit null is always serialized, even under NON_NULL serialization settings. It does not expose the other member's sharing mode, schedule start, pause settings or internal activity/boundary fields. Existing fields/endpoints remain. Old clients can ignore the new fields; the new Frontend intentionally hides coordinates from an older Backend response that lacks valid metadata.

Authorized rows are held only in memory, scoped to authenticated user/group. No GPS/group coordinates are stored in localStorage or IndexedDB. Online browser restarts retrieve authorized last-known data from Backend/MySQL; offline browser restarts do not restore private snapshots without authentication/membership verification. Coordinate freshness (30 seconds), server-authorized visibility and connection status are separate checks.

Local timers enforce known deadlines and physically remove expired rows, including immediately on foreground recovery before a suspended interval fires. Fixed meeting points remain independent of member expiry. Account/group change, logout, successful local revocation and authorization failures clear applicable data and reset publisher state. A local owner stop or new schedule removes the owner's prior-period row while retaining other still-authorized members; group pause/closure clears all affected member rows. Reconnection clears the offline rows before revalidation. A scoped authorization revision prevents delayed pre-revocation read/upload responses from restoring rows/settings, stopping a newly authorized navigation session or affecting another account/group.

Reconnect may restart GPS only when navigation consent and current sharing permissions still permit it and the browser confirms an existing geolocation grant. No grant is requested automatically. If the Permissions API is unavailable or the grant is absent, explicit navigation activation is required. Navigation/sharing settings are not automatically enabled.

## Display and navigation safety

AR/EN/FR Map labels, offline cards, member cards and Compass show Recent location or Last known location, the actual localized recorded date/time (Riyadh timezone) and visible cached/stale warnings. Recent means a measurement at most 30 seconds old, not a claim of continuous Live tracking or an open browser. Offline data is labeled cached even when recently recorded. Expiry is explained next to offline information; expired markers/destinations are removed. The selected nearest member still requires fresh, visible, authorized data.

Both Frontend and Backend block new walking requests when a member target is older than 30 seconds or no longer visible. The Backend rechecks authorization and freshness after provider/cache use. The Frontend cancels deferred calculations, invalidates in-flight results and clears route history on loss of eligibility. Fixed meeting destinations keep their existing timestamp-independent logic, provided the user's GPS is fresh. Compass direction to an authorized old member remains available with the existing explicit may-have-moved warning. ORS endpoint, timeout, logging, keys, Authentication, HttpSession, CSRF and controllers are unchanged.

## Schema and owner-controlled deployment considerations

Three additive nullable columns: `user_locations.activity_at DATETIME(6)`, `location_sharing_settings.locations_valid_from DATETIME(6)`, and `group_members.locations_valid_from DATETIME(6)`. No table, scheduler or worker is added. Historical data remains intact. Legacy rows with null activity metadata are **not displayed until a fresh authorized measurement is posted**; there is no backfill that invents recent presence. Stationary heartbeats cannot upgrade a legacy/revoked-period row.

The existing `spring.jpa.hibernate.ddl-auto=update` configuration is unchanged. Preferred path: after the owner backs up/reviews a staging schema and deploys Backend, Hibernate adds the missing nullable fields. Do not also execute the optional SQL automatically. The SQL file is outside startup resources; no Flyway/Liquibase runner is present. Alternative: with Backend stopped, an authorized operator can inspect the selected MySQL schema and run the optional additive, column-existence-guarded script, then let Hibernate recognize those fields. MySQL DDL implicitly commits; do not assume transactional rollback or remove historical data. Review existing column types/defaults before either path.

Deploy Backend/schema first, validate the new location response, then the Frontend. Existing locations may temporarily disappear until fresh updates establish the new metadata. The agent performed **no production migration, database modification, deployment, Railway access or configuration change**.

## Verification

| Verification | Result |
| --- | --- |
| Backend `mvnw.cmd package`, without skipping non-optional tests | PASS: 79 passed, 0 failures/errors; 1 existing optional MySQL test skipped (80 total); package succeeded |
| Frontend `npm test` | PASS: 111 tests, 0 failures, 0 skipped |
| Frontend `npm run build` | PASS; existing >500 kB chunk advisory (approximately 518.5 kB JavaScript) |
| `git diff --check` | PASS |
| Chrome, 390×844 / 1280×720, AR/EN/FR | PASS: 6 contexts, all lifecycle assertions passed |
| WebKit, same viewports/languages | PASS: 6 contexts, all lifecycle assertions passed |

Controlled Backend clocks verify inclusive schedule start/exclusive end, 18:00/21:59 retention, offset conversion, reconnect and new periods, stationary renewal, exact lease expiry, older/forged input rejection, global/member/group pause/resume/closure, same-tick boundaries, legacy metadata, outsider rejection, stale routing before/during a provider request and fixed meeting routes. Frontend tests verify visibility metadata, exact offline expiry, ALWAYS remote-revocation limitations/revalidation, logout/scope isolation, delayed snapshots, heartbeats without changed measurement timestamps, grant-aware reconnect and pending-route invalidation. Existing functionality tests are retained; temporal fixtures now use a controllable clock to age valid measurements instead of backdating them before account/group creation.

The isolated schema test boots a unique in-memory H2 database, preserves a synthetic historical row, recreates the three missing columns using Hibernate update, and verifies that the legacy row remains stored but suppressed. This is **not** proof of production MySQL migration compatibility. The existing optional MySQL QA test remains opt-in and was not run; staging MySQL validation is still recommended before owner deployment.

Browser clocks/network were simulated, with all application APIs intercepted using synthetic group data. Screens demonstrate retained scheduled data after the former five-minute cutoff, visibility at 21:59, disappearance after 22:00, ALWAYS retention a day later and WHILE_USING disappearance at its 90-second deadline. Fixed meeting information remains. No horizontal overflow or application page errors were observed; expected failed resource loads during deliberately simulated offline periods were excluded. Each sharing-mode scene uses an independently authorized synthetic source snapshot, not a client conversion of an earlier sharing period. No production, paid ORS or AI requests were made.

## Genuine screenshots

All required captures are real Chrome screenshots at 390×844, Arabic, with the same synthetic group data and focused offline-list scroll anchor. Before was captured from the unmodified base commit in an isolated local checkout. The clearly labeled Synthetic QA banner is a **test-only DOM annotation**, showing controlled Riyadh/UTC time and connectivity; it is not part of shipped UI or an image mockup.

- [Before: five-minute cache incorrectly lost](screenshots/issue-07-before-cache-expiry.png)
- [Scheduled offline: last update 18:00 retained](screenshots/issue-07-after-scheduled-offline.png)
- [Scheduled expired: coordinates absent after 22:00](screenshots/issue-07-after-scheduled-expired.png)
- [ALWAYS: last-known location a day later](screenshots/issue-07-after-always-last-known.png)
- [WHILE_USING: expired activity, fixed meeting retained](screenshots/issue-07-after-while-using-expired.png)

## Privacy and remaining limitations

- An offline observer cannot learn about a remote manual revocation immediately. Known deadlines are enforced locally; authorized ALWAYS snapshots may remain visible until reconnect, then revalidation removes revoked data. No instant offline revocation is claimed.
- No persistent browser snapshot was added. Offline restarts intentionally cannot expose private coordinates before account/group verification.
- No background GPS or genuine browser-close detection exists. Visibility ends according to authorization/lease rules, not a successful unload event. Heartbeat renewal requires the latest authorized measurement; a new sharing period/device measurement may require a fresh fix.
- Physical mobile GPS/sensor behavior, native iPhone permissions, suspended-browser timers and power management still require device testing. WebKit verification used the Windows engine. Device clock skew/timer suspension can delay local offline UI updates; Backend read authorization is still enforced by the server clock.
- Migration validation used isolated H2/JPA, not production or staging MySQL. The owner should validate the nullable DDL/permissions on staging before deploying. Legacy-location unavailability is an intentional fail-closed rollout behavior.
- Client GPS authenticity is not cryptographically attested. Existing validation plus server-controlled lease timing prevents a client timestamp from defining presence expiry, but cannot prove a submitted coordinate's physical origin.
- No merge to main, deployment or production data/settings change. Earlier private QA files and ORS script edits remain outside this issue.

## Files changed

- `backend/migrations/20261014_location_sharing_lifecycle.sql`
- `backend/src/main/java/com/example/dal/DtoOut/UserLocationDtoOut.java`
- `backend/src/main/java/com/example/dal/Model/GroupMember.java`
- `backend/src/main/java/com/example/dal/Model/LocationSharingSettings.java`
- `backend/src/main/java/com/example/dal/Model/UserLocation.java`
- `backend/src/main/java/com/example/dal/Service/GroupService.java`
- `backend/src/main/java/com/example/dal/Service/LocationSharingSettingsService.java`
- `backend/src/main/java/com/example/dal/Service/NavigationAssistanceService.java`
- `backend/src/main/java/com/example/dal/Service/UserLocationService.java`
- `backend/src/test/java/com/example/dal/FinalFeaturesWorkflowTests.java`
- `backend/src/test/java/com/example/dal/LocationLifecycleSchemaTests.java`
- `backend/src/test/java/com/example/dal/Service/LocationLifecycleTests.java`
- `backend/src/test/java/com/example/dal/Service/NavigationPermissionTests.java`
- `backend/src/test/java/com/example/dal/ServiceWorkflowTests.java`
- `docs/ISSUE_07_LOCATION_SHARING_LIFECYCLE.md`
- `docs/screenshots/issue-07-after-always-last-known.png`
- `docs/screenshots/issue-07-after-scheduled-expired.png`
- `docs/screenshots/issue-07-after-scheduled-offline.png`
- `docs/screenshots/issue-07-after-while-using-expired.png`
- `docs/screenshots/issue-07-before-cache-expiry.png`
- `frontend/src/components/navigation/GroupNavigation.jsx`
- `frontend/src/components/navigation/LiveCompass.jsx`
- `frontend/src/components/navigation/LiveMap.jsx`
- `frontend/src/hooks/useGeolocation.js`
- `frontend/src/hooks/useGroupLocations.js`
- `frontend/src/hooks/useWalkingRoute.js`
- `frontend/src/services/locationService.js`
- `frontend/src/translations.js`
- `frontend/src/utils/navigationCalculations.js`
- `frontend/src/utils/nearestGroupMember.js`
- `frontend/tests/final-features.test.mjs`
- `frontend/tests/location-lifecycle.test.mjs`
- `frontend/tests/navigation-hooks.test.mjs`
- `frontend/tests/navigation.test.mjs`
- `frontend/tests/nearest-member.test.mjs`
- `frontend/tests/translations.test.mjs`

## GitHub

Base: `fix/bottom-navigation-meeting-guidance` at `0360ea4669c3da31cf163bcd62c03f96d8c3905a`.

Branch: [fix/location-sharing-lifecycle](https://github.com/Abdulaziz-Shafae/Dal/tree/fix/location-sharing-lifecycle).

Implementation commit (source, tests, migration plan and screenshots): [`ade365b0e73f123e86d9f7632eb38d547d1b3e4e`](https://github.com/Abdulaziz-Shafae/Dal/commit/ade365b0e73f123e86d9f7632eb38d547d1b3e4e). This follow-up documentation commit records that immutable implementation SHA.
