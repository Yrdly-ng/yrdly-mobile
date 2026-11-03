# YRDLY — Closer Than You Think

The user approved all seven sound-enabled edits and authorized final full-resolution exports without review labels. Full-resolution rendering, media checks and encoded-frame visual inspection are complete. See `output/DELIVERY.md` for the completed verification and delivery record.

## Where to start

- `output/index.html`: final local playback gallery, generated from the final MP4s.
- `output/`: seven final MP4s, encoded-frame contact sheets, checksums and QA reports.
- `delivery/yrdly-final-videos.zip`: finished films and delivery notes.
- `delivery/yrdly-editable-project.zip`: portable source/assets/storyboards/previews/finals package.
- `previews/sound-review/index.html`: the approved seven-edit review set.
- `storyboard/approval-log.md`: approval history, including label removal and sound approval.

Final names: `yrdly-launch-main-36s.mp4`, `yrdly-launch-social-15s.mp4`, `yrdly-launch-short-8s.mp4`, `yrdly-events-teaser-6s.mp4`, `yrdly-marketplace-teaser-6s.mp4`, `yrdly-businesses-teaser-6s.mp4`, `yrdly-communities-teaser-6s.mp4`.

Main: 1920 × 1080, 36 seconds. Vertical: 1080 × 1920, 15/8/6 seconds. All are 60 FPS, H.264 MP4 with stereo AAC audio. The vertical editions have dedicated layouts, not crops of the landscape film.

## Editable creative source

- `src/compositions/Campaign.tsx`: approved main/social scenes, overlap timing and shape transitions.
- `src/compositions/ShortEdits.tsx`: attention edit and four feature teasers.
- `src/scenes/`: individual scenes; `FeatureSpot.tsx` and `CompactBrand.tsx` compose the short edits.
- `src/components/Elements.tsx`: type, original brand logo, source UI cards and phone treatment.
- `src/animations/motion.ts`: frame-driven easing; no real-time timers.
- `src/theme/`: local app fonts and campaign palette.
- `scripts/campaign-plans.mjs`: durations, filenames, review frames and audio accent times.
- `scripts/compose-audio.mjs`: original deterministic instrument/effects synthesis.
- `assets/audio/`: mastered WAVs, separate music/effects stems, premasters and editable event scores.
- `assets/campaign/content.json`: authored names, copy, prices and scenario data.
- `storyboard/creative-treatment.md`, `storyboard/storyboard.md`, `storyboard/short-edits-and-sound.md`: creative treatment and timing plans.
- `storyboard/styleframes/`: original static studies with editable HTML source.

## Provenance

The logo, fonts, navigation icons, selected JSX and styles come from the mobile app. Original card components were rendered through React Native Web; screen wrappers are reconstructed. These are not native iOS simulator/device captures. No production backend, account or private user data was used. Native iOS runtime appearance remains unverified.

Five photographic assets were generated for this campaign with the user's authorization. People/scenes and names, dates, prices, ratings, attendance/member figures are illustrative authored scenarios, not live YRDLY records or real endorsements. No records were inserted into production. The user approved the content and explicitly requested removal of the review labels; provenance is retained here, in `assets/campaign/PROVENANCE.md`, and in `assets/asset-manifest.json`.

The score and effects were composed/synthesized for this campaign without third-party music or samples. The user approved the sound-enabled edits. Stems and scores are preserved; `assets/audio/PROVENANCE.json` records provenance. The mix targets −16 LUFS with a −1.5 dBTP ceiling. Actual encoded loudness/peaks and alignment checks are recorded in `output/media-verification.json`.

The end-card CTA is the YRDLY website. It does not claim native app-store availability. `output/cta-verification.json` records the destination check.

## Reproduction

This is an isolated pnpm workspace with pinned Remotion 4.0.535 dependencies. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm studio
node scripts/render-campaign.mjs final
node scripts/qa-campaign.mjs --final
node scripts/review-campaign.mjs --final
node scripts/playback-campaign.mjs --final
```

Append a Remotion ID to render a single film: `node scripts/render-campaign.mjs final YrdlyShort8`. Use `video` instead of `final` for 720p sound-review copies; `stills` produces review frames. The renderer uses native-resolution Remotion PNGs and FFmpeg H.264 encoding (CRF 17 / slow for finals). No preview upscaling or FPS reduction is used.

The original machine runs macOS 12. Remotion's bundled FFmpeg requires newer macOS APIs, so the pipeline uses the existing compatible FFmpeg 6.1.1 installation. Set `FFMPEG_PATH` and `FFPROBE_PATH` to compatible executables on another computer. Chrome's executable path is set in `remotion.config.ts` and the render scripts; adapt it if moving platforms. `scripts/media-tools.mjs` otherwise falls back to the original workspace's sibling tool installation. Rendering the included assets needs no mobile checkout or private credentials.

Frame capture concurrency is intentionally **1**. Earlier parallel Chrome captures produced tiled frames despite valid encoding; sequential capture fixed them. Do not increase concurrency without repeating the regression checks. `previews/diagnostics/diagnosis.md` retains the diagnosis and before/after evidence. Every final encoded frame is scanned by `scripts/analyze-temporal.mjs`; metadata alone is insufficient.

To reproduce the audio, run `node scripts/compose-audio.mjs`, then `node scripts/qa-campaign.mjs --audio-only`. The score uses deterministic synthesis and fixed seeds. Frame capture disables browser audio; FFmpeg muxes the same master WAV used by Remotion Studio.

To re-extract source UI, the original mobile checkout is additionally required. Set `YRDLY_MOBILE_ROOT`, run `node scripts/render-components.cjs --campaign`, start `node scripts/serve.mjs`, then run `node scripts/capture-review.mjs campaign`. The static harness executes no app services. Refresh provenance/contact sheets with `node scripts/campaign-assets.mjs` and `node scripts/register-audio.mjs`.

After media checks, browser playback and manual encoded-frame review are recorded, run `node scripts/write-delivery.mjs` and `python3 scripts/package-delivery.py`. The packager verifies report coverage, MP4 hashes and archive integrity. It excludes dependencies, caches, environment files, private device data and Git internals.

## Isolation and history

Production work lives on `yrdly-launch-video`, based on mobile commit `21d040d`. The original working-copy changes are preserved. No production app functionality, API/authentication configuration, database schema or deployment setting was changed. Nothing is pushed, merged, published or deployed.

The user's preferred capture target was iOS. Source inspection confirmed the Codemagic unsigned IPA → Sideloadly workflow; no usable device capture was obtained. The user accepted source reconstruction. Zero native screenshots/recordings are claimed.

Original static studies and v1/v2 MP4s are retained for history. Those old drafts may show earlier placeholders/review labels and the v1 capture defect. They are not the final deliverables. The final gallery and filenames above identify the approved delivery.
