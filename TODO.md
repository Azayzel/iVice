# TODO / Shelved

- Expose `GET /api/guides` in ViceFiles using an editor-approved collection; version payloads and ETags, canonical source attribution, deletion reconciler.
- Catalog pipeline: editorial review, source URL health checks, spoiler metadata, data provenance and correction history.
- Geo-referenced world map, custom map pins, GPS-free navigation and per-region checklist filters.
- Search indexing and category drill-down; selectable spoiler depth per story act.
- Player-authored checklist templates and images stored locally; share/export import.
- Cross-device sync (opt-in, authenticated, encrypted at rest), backend MongoDB models and APIs.
- Native screenshots, videos and adaptive streaming via existing ViceFiles Cloudflare media service, with explicit mobile consent and moderation.
- Accessibility: VoiceOver, Dynamic Type, larger touch areas, external keyboards.
- Device integration/E2E tests and store preparation (review bundle ID ownership, screenshots, trademark/licensing).

## New recommendations and launch work
- Add first-party measurements for cash/hour, vehicle top speed, handling, repeatability and minimum chapter, using reproducible community submission evidence.
- Deep-link story walkthroughs, mission-specific progress and missable alerts with graduated spoiler levels.
- Add curated vehicle data model: car/aircraft/boat class, seats, acquisition, unlock requirements, measured performance, confidence and citations.
- Populate Wiki from reviewed guide documents and add user correction/flag workflow; do not scrape Fandom or Reddit wholesale without proper permission.
- Confirm GitHub Pages Source=GitHub Actions and deploy success; create/enable actual GitHub Wiki independently if desired.
- CI-generated browser previews and goldens; iOS / Android simulator screenshots and visual regression before app-store release.

- Run native device flows (iOS and Android): cold launch offline, save/reopen checklist and notes, switch and delete profiles, bookmark/unbookmark, spoiler protection, and sync failures. Browser-preview checks do not cover native SQLite or React Native interactions.
- Add independently measured vehicle stats, acquisition locations, and verified mission/collectible walkthroughs. Never label estimated top speeds as measured.

- Expand curated unlock prerequisites, mission-specific recommendations, measured money rates, vehicle acquisition and exact collectible coordinates before marketing them as verified. Add native simulator/device regression and accessibility snapshots for all themes and spoiler modes.