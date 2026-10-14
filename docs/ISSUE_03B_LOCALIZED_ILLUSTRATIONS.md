# Issue #3B — Localized DAL illustrations

Base: `fix/language-translations` at `b6f03223b89d0445775f0ea5b4abd127c437f061`.
Branch: `fix/localized-illustrations`. Issues #1, #2 and the existing Issue #3 implementation are preserved.

## Root cause and fix

Home always loaded `hero-phone.png`, `map-art.png` and `meeting-art.png`, whose Arabic labels are rasterized into their pixels. Changing React translations could not change those labels.

Each illustration now has a self-contained English and French SVG variant. The SVG retains the original raster artwork, reconstructs the affected text surfaces, badges and initials, and typesets localized labels using the existing DAL Thmanyah fonts. Controls, shadows, composition, DAL logo, colors and image dimensions are retained. Example member names are transliterated consistently; group codes and example distance/time values are unchanged.

The text reconstruction is inside the actual SVG asset, not a page-level CSS mask or text overlay. Embedded artwork/fonts make the variants independent of external image/font requests. No AI-generated artwork or fabricated browser screenshot was used.

`illustrationAsset(name, lang)` uses the existing language normalization. Arabic selects the unchanged original PNG; English/French select their SVGs. The existing state/context updates the sources immediately. Language persistence, RTL/LTR, page layout and responsive styling are unchanged.

## Files changed or added

- Modified: `frontend/src/main.jsx` — import and three image-source expressions only.
- Added: `frontend/src/utils/illustrationAssets.js` — shared source selection.
- Added: `frontend/tests/illustration-assets.test.mjs` — selection, fallback, source wiring and self-contained asset checks.
- Added: `frontend/scripts/generate-localized-illustrations.mjs` — portable deterministic regeneration from the original images/fonts. Run `node frontend/scripts/generate-localized-illustrations.mjs` from any working directory using its absolute path when outside the repository.
- Added: `frontend/public/assets/hero-phone-en.svg`, `hero-phone-fr.svg`, `map-art-en.svg`, `map-art-fr.svg`, `meeting-art-en.svg`, `meeting-art-fr.svg`.
- Added: this report and the eight screenshots linked below.

The original three PNGs, existing compass variants, stylesheets, translation catalogs, Backend/API/database and Railway configuration are unchanged. Earlier private QA files and ORS test-script changes are excluded.

## Tests

- `npm test`: **67 PASS**, 0 failures, 0 skipped.
- `npm run build`: **PASS**.
- `git diff --check`: **PASS**.
- Chrome: **18/18 illustration checks PASS**; WebKit: **18/18 PASS**. AR/EN/FR at 390×844 and 1280×720.
- Checked successful image decoding, correct sources, preserved natural dimensions and `object-fit`, no horizontal overflow, immediate switching through all three languages, direction and reload persistence.
- All six variants were visually reviewed at native resolution and in the real UI. Labels fit the original boxes; original Arabic lettering remains only in the DAL brand logo. All six assets regenerate byte-for-byte identically.
- Browsers ran the real local frontend. Only the unauthenticated profile check was mocked; no production, provider or authenticated API request was made. The expected 401 profile response and existing WebKit `interactive-widget` warning are excluded from application-error checks.

## Real screenshots

Hero comparisons are identical 1280×720 Home viewports and signed-out states. Map/meeting AFTER captures use 390×844. Additional desktop/mobile and Arabic captures were verified locally; only the requested eight screenshots are committed.

| Illustration | English | French |
| --- | --- | --- |
| Hero BEFORE | [EN](screenshots/issue-03b-before-en-hero.png) | [FR](screenshots/issue-03b-before-fr-hero.png) |
| Hero AFTER | [EN](screenshots/issue-03b-after-en-hero.png) | [FR](screenshots/issue-03b-after-fr-hero.png) |
| Map AFTER | [EN](screenshots/issue-03b-after-en-map.png) | [FR](screenshots/issue-03b-after-fr-map.png) |
| Meeting AFTER | [EN](screenshots/issue-03b-after-en-meeting.png) | [FR](screenshots/issue-03b-after-fr-meeting.png) |

## Limitations

- The phone illustration remains hidden at mobile width, as in the base design. Existing map/meeting cropping and the partially occluded example member at the map controls are preserved.
- Localized glyphs require slightly different fitting from Arabic; these are faithful text-area reconstructions rather than pixel-identical raster edits.
- Self-contained SVGs include the original image and DAL fonts, so they are larger than the original PNGs (approximately 813 KB hero, 447 KB map, 361 KB meeting per locale).
- WebKit verification used its Windows browser engine, not a physical iPhone.
- No untranslated UI labels remain in these three localized illustrations. Arbitrary AI explanations and external map-tile language remain outside Issue #3B.

No merge to `main`, deployment or Railway changes are performed.
