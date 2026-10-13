# Dal Web | دال

React + Vite frontend based on the uploaded DAL.pdf and Dal brand identity. The original Thmanyah Sans font family, logo, photos and decorative design illustrations are included. Desktop and mobile layouts follow the reference.

## Run locally

```bash
npm ci
npm run dev
```

Run the Spring Boot backend at localhost:8080. Vite proxies `/api` to that backend. Override `API_PROXY_TARGET` to change its address.

## Railway

Create a frontend service from this directory. The included Dockerfile builds the app and runs `server.mjs` on Railway's `PORT`.

Set the frontend service variable:

```env
BACKEND_URL=https://YOUR-DAL-BACKEND.up.railway.app
```

Keep `VITE_API_BASE_URL` unset. API calls use the same-origin `/api/v1` reverse proxy, including HttpSession cookies and the CSRF header. Set the backend `FRONTEND_ORIGINS` to the real frontend HTTPS origin, `SESSION_COOKIE_SECURE=true`, and `PASSWORD_RESET_URL=https://YOUR-FRONTEND/reset-password`. If the backend uses a cookie Domain attribute, remove it so its session cookie can be set through the frontend origin. No API secret belongs in frontend build variables.

## Implemented integration

Account creation/login/logout/profile and password-reset forms; group creation/joining and approval; QR/link/code sharing; member and owner management; pause/resume for the user, membership and group; meeting-point management; direct messages with pagination and read status; nudges, arrival notifications and notification reads. The frontend uses the approved backend DTOs and its CSRF endpoint. Dates support 12/24-hour preference in Riyadh time.

## Current limits

- The production build and same-origin proxy were tested locally against `https://dal-backend.up.railway.app`, using only the two authorized test accounts and group `TFZJ4`. The frontend changes have not been deployed to Railway in this review. Keep `BACKEND_URL` as a runtime variable; do not bake the backend address or credentials into the client.
- Maps, sensor-based compass and camera guidance are deliberately deferred. Their screens are labelled as design previews. No sample person location or fabricated distance is presented as live tracking.
- Brevo email delivery depends on provider activation and backend configuration.
- Accounts and management forms needed by the approved backend extend the Figma flows; they use the same visual system. Arabic is complete; the landing page supports Arabic, English and French, while operational screens are Arabic.
- Build and 14 automated checks passed. Browser review covered 360, 390, 430, 768 and 1440 CSS-pixel widths, RTL forms, dialogs and loading/error/empty states. Review evidence and the remaining differences from the PDF are in [the review report](review/FRONTEND_REVIEW_AR.md). Exact pixel parity and physical-device keyboard/sensor behavior are not claimed.
- Messages require connectivity; no offline outgoing-message queue or background tracking is implemented.

## Checks

```bash
npm test
npm run build
```

Do not publish the raw source Figma/PDFs as public assets. Only the images, logo, fonts and decorative crops used by the frontend are included.

## Connection troubleshooting

The verified backend origin is `https://dal-backend.up.railway.app`. The older `dal-backend-production.up.railway.app` address returned HTML 404s for the repository endpoints. `/api/v1/security/csrf` exists in the backend and is forwarded unchanged by both proxies.

For local browser QA, include the exact local origin in the backend service's `FRONTEND_ORIGINS`, alongside the deployed frontend origin. This review used `http://127.0.0.1:5176`; a normal Vite run uses a different origin and must be allowed separately. Preserve CSRF, session cookies and origin checks. The local fixture in `tests/manual-api-fixture.mjs` is for controlled UI failures only and is never imported by the production app.
