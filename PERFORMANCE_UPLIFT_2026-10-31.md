# Full Weasel media and startup uplift — 2026-10-31

Baseline: `bdd5c94a7486e2a3955c3a27af1179da035fb100` on `main`.

This source-level change implements the Museum P4, P5 and P10 handoff while
preserving gameplay, offline-bundled assets, music behavior and original media.

## Changes

- The title gate preloads only title-critical art. Runtime gameplay images are
  predicted during the How To / Ready screens, and packaged-only source sheets
  are no longer requested by the game.
- Background probing begins after title interaction, requests metadata before
  playback, and loads later round videos when selected.
- All 44 governed shipped PNG images have smaller lossless WebP derivatives.
  Original files remain under `assets_raw/` and `assets_backgrounds/`.
- All nine background loops use H.264 CRF 23, `yuv420p` and front-loaded
  `moov` metadata (`faststart`). Originals remain unchanged.
- `npm run optimize-media` reproduces derivatives when ImageMagick and FFmpeg
  are installed. `npm test` verifies manifest provenance, WebP structure,
  smaller derivatives and faststart placement.
- `npm run build:embed` creates a portable `dist-embed/` for the Museum with a
  relative base, file-local manifest support, no root PWA worker or remote font
  request, and Escape-to-parent lifecycle signaling. The command verifies these
  invariants before succeeding.

## Matched cloud evidence

System Chromium 154, 1280×720, local Vite, service workers blocked:

- Title-ready requests: 48 → 2.
- Title-ready encoded asset bytes: 81,855,674 → 4,712,496.
- Title-ready wall time: 2,633 ms → 934 ms in one matched run per build. This
  timing is noisy and is not a device-performance claim.
- Complete `public/assets` bytes: 134,037,830 → 91,233,340.
- Selected image bytes: 77,690,047 PNG → 48,870,160 lossless WebP.
- Selected video bytes: 40,465,851 → 26,474,903.

All 44 image derivatives decode with zero changed pixels against their sources.
The nine videos preserve 832×1504 dimensions and start time; measured SSIM is
0.981099–0.988459. Six-second loop durations differ by at most one 24 fps frame.

Browser smoke traversed Title → How To → Ready → Interstitial → live Round 1
with zero broken images or page errors, a playing muted looping background,
and no packaged-only image requests. The environment could not reach optional
Google Fonts, so the local fallback font rendered during this cloud check.

Human audiovisual acceptance and representative mobile/device measurements
remain required. Roll back with `git revert <upstream uplift commit>`.
