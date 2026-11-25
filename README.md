# iVice

**An offline-first GTA VI pocket guide built to sit beside your controller.** Native Expo / React Native / TypeScript for iOS and Android, inspired by the *utility* of Gunther's Library but with an original neon, midnight-purple visual language.

> **Project status:** functional source-code MVP, not an App Store release. The iVice preview and coming-soon website are independently deployable GitHub Pages files. The native app has not yet been validated on physical devices.

[Coming-soon website](https://azayzel.github.io/iVice/) · [Interactive mobile UI preview](https://azayzel.github.io/iVice/preview.html) · [Guide hub](https://azayzel.github.io/iVice/wiki.html) · [PLAN](PLAN.md) · [Decisions](DECISIONS.md) · [Security](SECURITY.md)

## Screen gallery

These are **real screenshots captured by Playwright in GitHub Actions** from the interactive iVice *browser preview*. They are not iOS Simulator or Android device screenshots; those still need a native release build. The original SVG design studies are also preserved in `docs/screenshots/`.

| Home & quick guides | Money recommendations | Source-linked guide |
|---|---|---|
| ![iVice browser preview home screenshot](docs/screenshots/home-mobile.webp) | ![Money routes browser screenshot](docs/screenshots/library-money-mobile.webp) | ![Money guide browser screenshot](docs/screenshots/money-guide-mobile.webp) |

[See the full-size coming-soon page screenshot](docs/screenshots/landing-desktop.webp) · [Passing browser screenshot workflow](https://github.com/Azayzel/iVice/actions/runs/45679198900)

## What the guide does

- **Make money:** source-linked route recommendations: early car sales after the Moses introduction, managing pocket cash, robberies, and later vault jobs. Each includes unlock stage, prerequisites, risks and per-profile checklists.
- **Story:** five-chapter tracker, optional-mission sweeps and chapter-transition alerts, with spoilers hidden by default.
- **Best vehicles:** comparisons for cars and getaways, airplanes/helicopters, speedboats and off-road vehicles. Rankings distinguish demonstrated in-game facts from launch-week reporting; no fabricated top speeds.
- **Wikipedia-style library:** character and region references with links to original sources (including Brian Heder on Rockstar and Fandom), search, categories and bookmarks.
- **Collectibles & discoveries:** private checklists, notes, completion counts and multiple playthroughs; no sign-in or internet connection is needed to use the bundled material.
- **ViceFiles integration:** opt-in manual sync of *moderator-approved* guide entries via a read-only API contract. It never posts user notes to the server.

### What counts as a recommendation?

`official` denotes a summary based on Rockstar's public material. `community`/`reported` means iVice links to independently published walkthroughs or launch-week research, but has *not* personally measured the result. `template` is a user checklist, **not a game fact**. All articles have original descriptions and link to third-party material rather than copying it. Content status can be corrected as better evidence arrives.

## Quick start

Requirements: Node 22.13+, npm, iOS simulator on macOS or Android emulator/compatible Expo Go (Expo SDK 58).

```bash
npm install
npm run test
npm run typecheck
npm start
```

The app opens locally with a bundled catalog and an on-device SQLite database. Check `npx expo install --check` if dependency ranges change. No server or account is required for its base functionality.

### Development website preview

The docs folder is a standalone static site; you can open `docs/index.html` or serve the directory:

```bash
python -m http.server 8080 --directory docs
# http://localhost:8080
```

`docs/preview.html` is a small **interactive browser demo** featuring the same guide categories, clickable article details, source links and checklist behavior. It uses browser localStorage for sample checkboxes rather than the native app's SQLite implementation. The browser demo and the Expo app are distinct front ends using the same curated content model.

## Tests & screenshots

```bash
npm run test                 # Content schema, provenance, category and ID checks
npm run typecheck            # TypeScript (requires npm install)
python -m pip install playwright pillow
python -m playwright install chromium
python scripts/visual_snapshots.py       # Visual UI smoke checks + real browser screenshots
python scripts/visual_snapshots.py --verify  # Compare against previously generated baselines
```

The last command writes four PNG snapshots (mobile home, mobile money catalog, mobile money guide, desktop landing) to `docs/screenshots/`. `--verify` compares the pixels against those files, allowing a small cross-platform antialiasing tolerance. On CI, the workflow uploads **browser-snapshot-artifacts** for each run; see GitHub Actions. To update a browser baseline intentionally, run the script without `--verify` and review the image diff before committing.

The local browser in the authoring environment has administrator navigation blocking, so those browser capture checks could not be run here. **Do not confuse the SVG previews above with screenshots captured from the running Expo app.**

## GitHub Pages and guide hub

`docs/index.html` is the responsive prelaunch landing page, `docs/preview.html` is the interactive app preview, and `docs/wiki.html` is the coming-soon guide hub. A Pages deployment workflow is provided in `.github/workflows/pages.yml`.

**One-time repository setting:** Go to **Settings → Pages → Build and deployment → Source: GitHub Actions** (if not already selected). The workflow deploys `docs/` on pushes to `main`. Until Pages is enabled and the deployment succeeds, the links above may not resolve.

GitHub's separately hosted repository **Wiki** is not the same as GitHub Pages. This starter supplies a branded coming-soon *guide hub* at `/wiki.html`; editing the actual `Azayzel/iVice/wiki` Git repository is a separate step and has not been performed.

## Optional guide sync

Set `EXPO_PUBLIC_API_URL=https://your-api.example` in a local `.env`; no keys are required. In Settings, tap **Sync curated guides**. The app requests `GET /api/guides` and validates the payload before replacing a remote-only snapshot. This is a **client contract only**; the ViceFiles backend needs the matching read-only endpoint. Only moderator-approved content should be published; don't turn unreviewed Reddit scrape results into verified recommendations.

Expected payload:

```json
{"entries":[{"id":"vf-guide-example","title":"Example","category":"Money","summary":"Original curated summary","body":"Original explanation and evidence","region":"Vice City","sourceType":"community","sourceUrl":"https://example.com/evidence","sourceLabel":"Evidence","spoiler":false,"tags":["money"],"steps":[{"id":"review","label":"Review the evidence"}],"sources":[{"label":"Evidence","url":"https://example.com/evidence"}],"confidence":"reported","stage":"Chapter 2+"}]}
```

## Editorial and licensing

iVice is an **unofficial fan-made companion**, not affiliated with Rockstar Games, Take-Two, or Fandom. No copyrighted artwork, map screenshots, gameplay videos, or Fandom article text are bundled. Before publishing on app stores, assess trademark, third-party content licenses, terms for use, privacy policy and moderation obligations.

This is an open-source starter; choose a LICENSE before accepting outside contributions. See [TODO](TODO.md) for the planned map, cloud sync, verified player-submitted guides, native snapshots and platform QA.
### Native flow hardening

Saved guides now have a dedicated Library filter and home shortcut. Search matches multiple terms across the guide body, title, tags, region and vehicle class. Profile changes, note mutations, checklist updates and sync are serialized to prevent cross-playthrough writes; unfinished note drafts are retained separately in memory for each playthrough while the app stays open. Preview screenshots depict the separate HTML prototype; they are not native runtime validation. Content recommendations are source-linked launch reports, not play-tested rankings.

The home screen offers one-tap search, results load in batches of 30, and spoiler protection warns before opening third-party guide sources. The `scripts/persistence.test.mjs` suite executes the actual persistence SQL against Node's SQLite engine and checks remote payload validation. It does not replace Expo device tests.

## Play session dashboard

Choose a chapter (or leave it unset) and optionally an in-game region. Each playthrough independently remembers chapter, region, last opened guide and checklist state in SQLite. The home screen recommends eligible, unfinished money and story guides, optional activities, vehicle research picks and matching regional references. Unconfirmed vehicle unlocks are explicitly marked; region matches are not GPS or collectible coordinates. No account or location permissions required.

**Spoilers:** default off. Known later-chapter entries and explicitly spoiler-tagged entries are hidden. The home and Library controls reveal all guides if desired; this never upgrades future entries into current-chapter recommendations. External references may reveal plot details. Editorial classification is required for every new guide.

**Appearance:** Jason (muted charcoal/green), Lucia (plum), Classic Vice (neon). Original utility-style palettes, compact launcher and guide cards, not copied in-game assets.

The native UI now differs from older browser preview screenshots; see the preview as a design reference, not native device evidence.