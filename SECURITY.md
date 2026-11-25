# Security & Privacy

**Current trust model:** Offline content and local player progress are trusted device-local data; remote guides are untrusted until curated, validated and sourced. The app does not request logins, camera, microphone, location or cloud access to track checklists.

- Never fetch or execute HTML/JavaScript from untrusted wiki pages. External links are opened through OS Linking after HTTPS check.
- No scraping or hotlinking copyrighted wiki/game media. Include only original text and citations, respecting content owners' terms.
- Restrict remote sync to configured HTTPS endpoints (localhost emulator excepted); validate schemas, limits, source URLs and remote identifier prefix. Do not let remote guide objects replace bundled official content or local progress.
- `EXPO_PUBLIC_*` variables are **public**. Never place bearer credentials, private API tokens or Cloudflare keys there.
- Profile/note contents are in normal SQLite, not encrypted application secrets. Do not store passwords, tokens or other secrets there. Protect backups appropriately.
- Future auth: short-lived in-memory access JWT, rotating server-side opaque refresh sessions via native secure storage, careful replay/CSRF handling for web clients.
- A secure editorial API must validate submissions, enforce contributor privileges and rate limits, moderate media, preserve revision/audit history and support content takedown.
- Sync can currently be requested manually only. No background tracking, analytics SDK or remote telemetry in MVP.

## Content quality for money / story / vehicle guides
- Any "best" label is an editorial recommendation scoped to the task, not a universal verified performance claim.
- Differentiate original Rockstar summaries from source-linked reports and unverified advice. Retain date, provenance and confidence when an eventual CMS publishes updates.
- Avoid presenting player-reported payouts, stats or unlocks as guaranteed; reject tips with no provenance.
- Spoiler markers are applied at entry granularity; do not leak spoiler-only titles through home recommendations or search while disabled.
- Client-side reading of third-party sources is a user-initiated external browser action; never scrape text or hotlink external images into private sessions.

## Web preview and Pages
- Static pages serve only original SVG/CSS visuals and compact bundled guide text; they have no login, tokens, tracking or signup backend.
- The browser preview uses localStorage for *demo-only* checkboxes, while native notes and checklists use SQLite. Never treat the preview as a secure account-backed sync surface.
- HTML DOM inserts guide text escaped before interpolation; external links use HTTPS and `rel="noreferrer noopener"`.
- GitHub Pages builds use pinned major versions of official GitHub Actions; periodically review and pin to full SHAs for release hardening.
