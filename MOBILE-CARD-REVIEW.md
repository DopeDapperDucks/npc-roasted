# Mobile card viewing and saving

Tracking: https://github.com/DopeDapperDucks/npc-roasted/issues/11
Branch: feature/mobile-card-save. This change is local; it has not been published or deployed.

Mobile visitors reported being unable to view or download the card. The previous code awaited fonts and images, then clicked a temporary data-URL download link. Mobile browser download restrictions and the absence of a full-card preview left no usable fallback. The precise failing device/in-app browser has not yet been identified; this is a compatibility fix, not a claim of reproducing that exact user's failure.

The PNG is now prepared after a successful roast, before the save gesture. View card jumps to a real image preview; Download PNG is a persistent blob URL link; Open full-size card opens the image from a direct tap. Supported devices also offer native file sharing using an already-created PNG File. Sharing cancellation leaves the card available, and blocked sharing explains the download/long-press fallback. In-app browsers receive Safari/Chrome guidance. Failed encoding can be retried without another roast request. Old object URLs are revoked and obsolete async exports ignored. Mobile users are scrolled to the completed report. Older canvas implementations without roundRect fall back to rectangles.

## Verification

Ran the final production build in a short-lived, nonpersistent Vercel sandbox with no exposed ports, project secrets, live provider calls or production quota data. API responses were intercepted in the browser with deterministic sample artwork and ratings.

- npm run build passed; standalone TypeScript check passed.
- All 13 existing Node tests passed.
- iPhone 13 WebKit, Pixel 7 Chromium and desktop Chromium: rendered 1200 × 1600 card; no horizontal overflow; downloaded PNG decoded using Sharp with correct dimensions/name; full-size tab opened; regeneration replaced the card and revoked the previous URL; no page errors.
- Simulated native share success, cancellation and denial; the share call had active user activation and a nonempty PNG file.
- Forced PNG encoding failure recovered via Retry card. Missing native share and missing roundRect both retained working download/preview.
- Rebuilt final source and reran all nine browser scenarios successfully. One intervening rerun failed because the prior server process retained its port and served obsolete chunks after the rebuild; terminated that child and restarted the final build before the passing rerun.
- git diff --check passed. Changed files reviewed for credentials; no new secrets/configuration/API/server changes. Only .env.example is tracked.
- npm installation reported three dependency advisories. The existing project has no lockfile; npm audit could not enumerate them (ENOLOCK). Dependency remediation is separate, not claimed completed here.

Real iPhone/Android OS Save Image behavior and X/Discord in-app browsers remain to be tested on physical devices. Browser emulation and mocked native share do not establish those OS/browser behaviors. No paid live roast was generated during these tests.

## Design review (self-review using team advisor checklist)

Read Brand, Art, Design, Taste, Voice & Copy and Asset Index; reviewed the rendered phone screenshot. Kept existing charcoal/white palette, original assets, uncropped character artwork, Sigmar/Inter/mono roles and 44px touch targets. New image fits the report width and preserves 3:4 ratio. Save instructions use plain text and only mention native sharing when it is supported. No brand redraw or new visual assets. Approved for review; physical-device check remains before release.

Screenshot: /Users/Pat/npc-roasted-mobile-review-v02.webp (cropped phone screenshot, deterministic sample data).

## Repeating browser checks

Use an isolated environment: install existing app dependencies, then temporarily install @playwright/test without modifying package.json, install Chromium/WebKit and their system dependencies, build/start the app on localhost, and run `node tests/mobile-card.browser.mjs`. TEST_ORIGIN can override http://127.0.0.1:3000. Browser tooling is test-only and is not added to the app's runtime dependencies.

## Release

Existing upstream repository is public. Do not push this new code there until Boston reports SenzuGod's scoped Discord approval. Local history is a reconstructed snapshot, not upstream Git history: apply only this change onto actual upstream main and use a PR with Closes #11; never replace upstream history. No collaborator invitation was sent. Earlier release exceptions do not automatically approve this version.
