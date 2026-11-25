# DECISIONS — iVice

- **Standalone mobile companion:** no webview dependency; native Expo SDK 58, React Native, TypeScript, SQLite on-device and zero login for the core experience. Separate interactive *static* browser preview for marketing and accessible documentation.
- **Backend:** the MongoDB / Express / JWT system stays in ViceFiles; iVice only reads editor-approved guide content over optional HTTPS. Private player data is not uploaded or synchronized without new opt-in design.
- **Content confidence:** separate official references, source-linked launch-week player reports and checklist templates. Conflicting speed rankings are not silently turned into definitive facts.
- **Play-first IA:** quick categories for Money, Story, Vehicles and Collections; stage prerequisites, risks, checklists and spoiler gating; other library subjects remain searchable.
- **Evidence and attribution:** external PowerPyx, PC Gamer, GTA Base, Rockstar and Fandom links; editorially written snippets only, no redistribution of third-party maps, videos or artwork.
- **Snapshot honesty:** three original SVG screen mockups in README. Playwright smoke test captures actual browser preview screenshots in GitHub Actions; actual Expo simulator screenshots and pixel regressions are part of the release QA gate.
- **Prelaunch:** `docs/index.html` and `docs/wiki.html` for GitHub Pages; avoid falsely claiming changes to GitHub's separate wiki repository. Pages source setting may need manual initialization.
- **Commit provenance:** publish with authenticated user's connected GitHub identity; no automated AI/Copilot co-authors or misleading commit trailers.
