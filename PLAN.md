# PLAN — iVice

## Original request / baseline
Create an offline-first, spoiler-aware GTA VI mobile play guide inspired by the usefulness of Gunther's Library. Use the ViceFiles midnight/neon aesthetic, Expo + TypeScript, personal checklists, offline search, source citations, Brian Heder as one Fandom reference and optional ViceFiles curated sync. Name the app **iVice** and store it at `Azayzel/iVice`, with commits attributed only to the repository account.

## Expanded scope (Nov 25, 2026)
Add actionable **money earning recommendations**, **story progression**, **best cars/aircraft/speedboats/off-road advice**; every guide must identify its source/evidence and avoid unsubstantiated speed/payout claims. Publish a **coming-soon GitHub Pages** site and guide hub, show screen previews in README, and automate browser screenshots/snapshot regression checks.

## MVP execution
- [x] Expo React Native TypeScript offline reference app, multi-profile SQLite progress, private notes, favorites and spoiler controls
- [x] 35 curated starter entries including 13 money, story and vehicle guides; original summaries and evidence links
- [x] Sourced recommendations and stage-specific checklists; story spoiler gating
- [x] Original neon UI with quick guide categories
- [x] Read-only curated API sync contract, schema validation and local-data isolation
- [x] `docs/` coming-soon website, guide hub and browser interactive preview
- [x] Browser-captured screenshots from passing CI added to README; authored SVG design previews retained
- [x] Browser screenshot / visual smoke automation and GitHub Pages workflows (CI green)
- [x] CI catalog checks and browser snapshots verified
- [ ] Validate Expo builds on iOS and Android devices
- [ ] One-time GitHub Pages setting (workflow token cannot create site); confirm publicly accessible URL
- [ ] Optional ViceFiles publisher API and source verification pipeline