# Downloaded source media

Downloaded November 25, 2026 at the user's request. The initial five original PNG files are stored in `playbook-story/`, without conversion. All five are 1080 x 1350; total size is approximately 7.4 MB. The score-filtered batch below adds the remaining source media in per-post folders.

Source: [GTA6_playbook story infographic gallery](https://www.reddit.com/r/GTA6_playbook/comments/1y54cyw/gta_6_complete_100_story_guide_all_5_chapters/). Posted by u/Colty_00; artwork credited to Eric Smash. These images contain story spoilers and unverified community claims.

| Local file | Original asset |
|---|---|
| [d6l0z0d4mq3i1.png](playbook-story/d6l0z0d4mq3i1.png) | https://i.redd.it/d6l0z0d4mq3i1.png |
| [5nxhb345mq3i1.png](playbook-story/5nxhb345mq3i1.png) | https://i.redd.it/5nxhb345mq3i1.png |
| [rouc3h16mq3i1.png](playbook-story/rouc3h16mq3i1.png) | https://i.redd.it/rouc3h16mq3i1.png |
| [yeikybv6mq3i1.png](playbook-story/yeikybv6mq3i1.png) | https://i.redd.it/yeikybv6mq3i1.png |
| [pjwj0zo7mq3i1.png](playbook-story/pjwj0zo7mq3i1.png) | https://i.redd.it/pjwj0zo7mq3i1.png |

These downloads are attached to the native app through [the community media registry](../../src/community-media.ts). Brian's Chapter 1 contact guide shows the three downloaded Chapter 1 slides; the vehicle-ownership guide shows the two downloaded Chapter 2 slides. Both guides remain spoiler-gated. Public redistribution permission has not been established; this integration is for the requested local development use.

## Posts scoring at least 50

The user selected guides and useful gameplay references, excluding memes and general discussion. The top/all feed was scanned into overlapping snapshots because Reddit virtualizes older rows. The [review record](playbook-review.json) contains 77 unique observed posts, including 58 at or above 50, with import or exclusion decisions. These are displayed scores captured on November 25, not permanent like counts.

The batch adds 16 reference entries from qualifying posts, with 71 source images/posters and three playable videos. It includes all 15 story slides, rare vehicles, a key-cloner guide, bag capacity, Key Lento, stat-boost leads, companion calls, Oomph hairstyles, mystery locations, cheats and a yard-sale find. The bank clip has a still-image fallback because its exposed playback source was a browser blob URL.

All batch references are community/reported and spoiler-gated. From Home search, enable Spoilers and search for a subject; or use Library's Guides/All mode. They are not added to the named-subject Encyclopedia index or treated as verified income recommendations.

Originals are retained. Native galleries use JPEGs limited to 1600 pixels and separate 360-pixel thumbnails. Videos retain their downloaded MP4 streams. The generated [media registry](../../src/playbook-media.generated.ts) connects these assets to the catalog, so the imports appear in the app rather than only on disk.

The [curated input](playbook-imports.json) contains original summaries and source-observed media URLs. Run `node scripts/import-playbook.mjs --download` from the repository root to fetch missing assets and regenerate the catalog, browser mirror and media registry; omit `--download` to rebuild from local originals. Temporary signed video URLs may expire; a failed video download falls back to its poster. Canonical Reddit post links remain the attribution sources.

All three new MP4s were inspected with AVFoundation and contain video and audio tracks. Runtime playback and image viewing use the existing native player/gallery; individual game claims have not been independently reproduced.

## Location maps

Home's Locations opens a Map/List browser with nine cropped source maps: eight Key Lento references and one Pfister 88 Comet lead. Category tabs and search narrow the map references; the filter icon opens region, reported chapter access, saved-guide and spoiler options. Bookmarks save the source guide, including all its maps. Unknown chapter access is not treated as confirmed availability.

Markers are part of the original images, not coordinate-backed interactive pins. Fullscreen viewing uses the existing native gallery and iOS zoom. Source guides retain their credits and spoiler protection. Run `npm run maps` to rebuild crops and the registry from local originals; `npm run maps:check` checks generated assets and is included in `npm run check`.

## Cargo-van video and thumbnail

Source: [cargo-van demonstration](https://www.reddit.com/r/GTA6_playbook/comments/1y4xziz/how_to_sit_in_the_back_of_a_cargo_van_when_there/), posted by u/Daddy_Shr00mz and credited to Cyber_Cycosis.

- [Video with audio](cargo-van/video.mp4): 32.9-second MP4, downloaded from the source exposed by the shared page's video player. macOS AVFoundation confirmed one video track and one audio track. Reddit media ID: `m19ter2spo3i1`.
- [Thumbnail](cargo-van/thumbnail.jpg): 640 x 358 JPEG, downloaded from the player's poster URL and visually checked. This is a still preview, not another video.

The direct command-line metadata requests remained blocked, but inspecting the shared browser page exposed working media URLs. No browser cookies or account credentials were exported. The temporary signed video URL is not retained as a permanent source citation.

In the native app, search for **cargo van** from Home, open **Ride in a cargo van's rear compartment**, and press the thumbnail's Play button. The bundled video opens in a native player with playback, seeking and fullscreen controls. It does not autoplay on opening the guide; closing the viewer releases the player, and backgrounding pauses playback. No Reddit connection is needed in an installed build; Expo Go development still needs Metro to deliver uncached bundled assets.

The detail thumbnail and actual video frame were verified in the iPhone simulator. Physical-device seeking, fullscreen transitions and background/resume behavior still need interactive testing.

The earlier ten missing story slides are now downloaded and included in the full story image-set entry.