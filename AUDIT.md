# Player workflow review — 2026-11-25

Reviewed native App.tsx, SQLite persistence, remote sync, bundled catalog and browser-preview tests at 5a275cc.

## Changes
- Added saved-guide retrieval and multi-term search; reset category and saved filters on home shortcuts.
- Serialized asynchronous writes and profile refreshes; keep unfinished note drafts separate in memory when switching profiles and recover an invalid saved active profile on launch.
- Added error handling for mutations, modal accessibility labels and checkbox semantics.
- Reject malformed or unsourced remote guides, invalid HTTPS URLs and duplicate checklist IDs; isolate catalog replacement in an exclusive SQLite transaction.
- Expanded source-backed Chapter 2/3 money guidance, story map navigation, and vehicle candidates. Distinguish in-game ratings from measured speed; external walkthrough links may contain spoilers.

## Validation boundaries
Baseline catalog tests passed in the local environment. The existing browser smoke test was blocked by local Chromium policy for localhost. Native runtime, device screenshots, offline restart and remote API integration require physical device/simulator testing. CI must be checked after this commit. The HTML preview is not the native app, and screenshots are not evidence of native behavior.

## Release gates
1. Native device smoke checks on both platforms and airplane mode.
2. Confirm every source, unlock requirement and vehicle location; expand actionable guides and map coordinates from reliable sources.
3. Test remote sync with malformed JSON, duplicated IDs, timeouts and an empty catalog; verify progress/notes survive.
4. Add repeatable native integration and accessibility checks, large catalog performance, and error recovery.

Follow-up: added quick search, incremental result loading, external-source spoiler warnings, and SQL-backed regression tests. Draft notes remain in memory only until saved; they do not survive an app restart.
