import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const rawRoot = path.join(root, "assets_raw");
const backgroundsRoot = path.join(root, "assets_backgrounds");
const musicRoot = path.join(root, "assets_music");
const publicRoot = path.join(root, "public");
const assetsRoot = path.join(publicRoot, "assets");
const reportPath = path.join(root, "ASSET_REPORT.json");
const publicManifestPath = path.join(assetsRoot, "manifest.json");
const icon192Path = path.join(publicRoot, "icons", "icon-192.png");
const icon512Path = path.join(publicRoot, "icons", "icon-512.png");

const spriteDefinitions = [
  {
    role: "dance_base",
    sourceRel: "assets_raw/dance loop/dex_dance_loop_sheet_2x4.png",
    destinationRel: "assets/sprites/dance/dex_dance_loop_sheet_2x4.png",
    reason: "Core 8-frame dance loop used during gameplay and victory.",
  },
  {
    role: "dance_hat",
    sourceRel: "assets_raw/dance loop/dex_dance_hat_sheet_2x4.png",
    destinationRel: "assets/sprites/dance/dex_dance_hat_sheet_2x4.png",
    reason: "Start gate costume preview.",
  },
  {
    role: "dance_sweater",
    sourceRel: "assets_raw/dance loop/dex_dance_sweater_sheet_2x4.png",
    destinationRel: "assets/sprites/dance/dex_dance_sweater_sheet_2x4.png",
    reason: "Phase 2 costume state after hat pop.",
  },
  {
    role: "dance_hat_sweater",
    sourceRel: "assets_raw/dance loop/dex_dance_hat_sweater_sheet_2x4.png",
    destinationRel: "assets/sprites/dance/dex_dance_hat_sweater_sheet_2x4.png",
    reason: "Packaged required variant for wardrobe set completeness.",
  },
  {
    role: "dance_hat_sweater_bowtie",
    sourceRel: "assets_raw/dance loop/dex_dance_hat_sweater_bowtie_sheet_2x4.png",
    destinationRel: "assets/sprites/dance/dex_dance_hat_sweater_bowtie_sheet_2x4.png",
    reason: "Phase 1 full birthday outfit base sheet.",
  },
  {
    role: "dance_frame_01",
    sourceRel: "assets_raw/dance loop/dex_dance_loop_01.png",
    destinationRel: "assets/sprites/dance/frames/dex_dance_loop_01.png",
    reason: "Single-frame dance loop animation frame 1.",
  },
  {
    role: "dance_frame_02",
    sourceRel: "assets_raw/dance loop/dex_dance_loop_02.png",
    destinationRel: "assets/sprites/dance/frames/dex_dance_loop_02.png",
    reason: "Single-frame dance loop animation frame 2.",
  },
  {
    role: "dance_frame_03",
    sourceRel: "assets_raw/dance loop/dex_dance_loop_03.png",
    destinationRel: "assets/sprites/dance/frames/dex_dance_loop_03.png",
    reason: "Single-frame dance loop animation frame 3.",
  },
  {
    role: "dance_frame_04",
    sourceRel: "assets_raw/dance loop/dex_dance_loop_04.png",
    destinationRel: "assets/sprites/dance/frames/dex_dance_loop_04.png",
    reason: "Single-frame dance loop animation frame 4.",
  },
  {
    role: "dance_frame_05",
    sourceRel: "assets_raw/dance loop/dex_dance_loop_05.png",
    destinationRel: "assets/sprites/dance/frames/dex_dance_loop_05.png",
    reason: "Single-frame dance loop animation frame 5.",
  },
  {
    role: "dance_frame_06",
    sourceRel: "assets_raw/dance loop/dex_dance_loop_06.png",
    destinationRel: "assets/sprites/dance/frames/dex_dance_loop_06.png",
    reason: "Single-frame dance loop animation frame 6.",
  },
  {
    role: "dance_frame_07",
    sourceRel: "assets_raw/dance loop/dex_dance_loop_07.png",
    destinationRel: "assets/sprites/dance/frames/dex_dance_loop_07.png",
    reason: "Single-frame dance loop animation frame 7.",
  },
  {
    role: "dance_frame_08",
    sourceRel: "assets_raw/dance loop/dex_dance_loop_08.png",
    destinationRel: "assets/sprites/dance/frames/dex_dance_loop_08.png",
    reason: "Single-frame dance loop animation frame 8.",
  },
  {
    role: "dance_clean_01",
    sourceRel: "assets_raw/dexter_dance_01.png",
    destinationRel: "assets/sprites/dance/dexter_dance_01.png",
    reason: "Clean transparent dance frame 1 with no baked background.",
  },
  {
    role: "dance_clean_02",
    sourceRel: "assets_raw/dexter_dance_02.png",
    destinationRel: "assets/sprites/dance/dexter_dance_02.png",
    reason: "Clean transparent dance frame 2 with no baked background.",
  },
  {
    role: "dance_clean_03",
    sourceRel: "assets_raw/dexter_dance_03.png",
    destinationRel: "assets/sprites/dance/dexter_dance_03.png",
    reason: "Clean transparent dance frame 3 with no baked background.",
  },
  {
    role: "hit_react_01",
    sourceRel: "assets_raw/shark_hit/dex_hit_react_01.png",
    destinationRel: "assets/sprites/hit/dex_hit_react_01.png",
    reason: "Hazard reaction frame 1.",
  },
  {
    role: "hit_react_02",
    sourceRel: "assets_raw/shark_hit/dex_hit_react_02.png",
    destinationRel: "assets/sprites/hit/dex_hit_react_02.png",
    reason: "Hazard reaction frame 2.",
  },
  {
    role: "hit_react_03",
    sourceRel: "assets_raw/shark_hit/dex_hit_react_03.png",
    destinationRel: "assets/sprites/hit/dex_hit_react_03.png",
    reason: "Hazard reaction frame 3.",
  },
  {
    role: "perfect_pop",
    sourceRel: "assets_raw/dex_perfect_pop.png",
    destinationRel: "assets/sprites/ui/dex_perfect_pop.png",
    reason: "Perfect hit overlay animation.",
  },
  {
    role: "shadow_blob",
    sourceRel: "assets_raw/shadow_blob.png",
    destinationRel: "assets/sprites/ui/shadow_blob.png",
    reason: "Dexter foot shadow layer.",
  },
  {
    role: "spotlight_vignette",
    sourceRel: "assets_raw/spotlight_vignette.png",
    destinationRel: "assets/sprites/ui/spotlight_vignette.png",
    reason: "Phase 2 dramatic spotlight overlay.",
  },
  {
    role: "censor_slam",
    sourceRel: "assets_raw/censor_slam.png",
    destinationRel: "assets/sprites/ui/censor_slam.png",
    reason: "Phase 3 slam overlay.",
  },
  {
    role: "victory_subtext",
    sourceRel: "assets_raw/victory_subtext.png",
    destinationRel: "assets/sprites/ui/victory_subtext.png",
    reason: "Victory subtitle support art.",
  },
  {
    role: "title_screen",
    sourceRel: "assets_raw/Title_Screen.png",
    destinationRel: "assets/sprites/ui/Title_Screen.png",
    reason: "Launch screen art used before gameplay starts.",
  },
  {
    role: "pwa_guide",
    sourceRel: "assets_raw/PWA_guide.png",
    destinationRel: "assets/sprites/ui/PWA_guide.png",
    reason: "PWA install guide image used as the first on-screen call-to-action.",
  },
  {
    role: "hazard_shark_fin",
    sourceRel: "assets_raw/hazard_shark_fin.png",
    destinationRel: "assets/sprites/items/hazard_shark_fin.png",
    reason: "Hazard lane object.",
  },
  {
    role: "item_nana_cheese",
    sourceRel: "assets_raw/item_nana_cheese.png",
    destinationRel: "assets/sprites/items/item_nana_cheese.png",
    reason: "Left lane good item.",
  },
  {
    role: "item_unsweetened_iced_tea",
    sourceRel: "assets_raw/item_unsweetened_iced_tea.png",
    destinationRel: "assets/sprites/items/item_unsweetened_iced_tea.png",
    reason: "Right lane good item.",
  },
  {
    role: "overlay_party_hat",
    sourceRel: "assets_raw/overlay_party_hat.png",
    destinationRel: "assets/sprites/overlays/overlay_party_hat.png",
    reason: "Hat pop burst layer.",
  },
  {
    role: "overlay_birthday_sweater",
    sourceRel: "assets_raw/overlay_birthday_sweater.png",
    destinationRel: "assets/sprites/overlays/overlay_birthday_sweater.png",
    reason: "Sweater pop burst layer.",
  },
  {
    role: "overlay_bowtie",
    sourceRel: "assets_raw/overlay_bowtie.png",
    destinationRel: "assets/sprites/overlays/overlay_bowtie.png",
    reason: "Bowtie overlay and pop burst layer.",
  },
  {
    role: "dexter_neutral",
    sourceRel: "assets_raw/dexter_neutral.png",
    destinationRel: "assets/sprites/poses/dexter_neutral.png",
    reason: "Start gate pose.",
  },
  {
    role: "dexter_focused",
    sourceRel: "assets_raw/dexter_focused.png",
    destinationRel: "assets/sprites/poses/dexter_focused.png",
    reason: "Rhythm pose badge.",
  },
  {
    role: "dexter_excited",
    sourceRel: "assets_raw/dexter_excited.png",
    destinationRel: "assets/sprites/poses/dexter_excited.png",
    reason: "Popoff phase pose badge.",
  },
  {
    role: "dexter_joyful",
    sourceRel: "assets_raw/dexter_joyful.png",
    destinationRel: "assets/sprites/poses/dexter_joyful.png",
    reason: "Joyful pose badge and icon fallback source.",
  },
  {
    role: "dexter_proud",
    sourceRel: "assets_raw/dexter_proud.png",
    destinationRel: "assets/sprites/poses/dexter_proud.png",
    reason: "Victory pose badge and icon source preference.",
  },
];

const copyDestinations = {
  sprites: "public/assets/sprites",
  backgrounds: "public/assets/backgrounds",
  music: "public/assets/music",
  icons: "public/icons",
};

async function ensureDir(targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
}

async function listFilesRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(absolutePath)));
      continue;
    }
    files.push(absolutePath);
  }
  return files;
}

async function copyWithStats(sourceRel, destinationRel, role, reason) {
  const sourcePath = path.join(root, sourceRel);
  const destinationPath = path.join(publicRoot, destinationRel);
  await ensureDir(path.dirname(destinationPath));
  await fs.copyFile(sourcePath, destinationPath);
  const stat = await fs.stat(destinationPath);
  return {
    role,
    source: sourceRel,
    destination: `public/${destinationRel}`,
    url: `/${destinationRel.replaceAll(path.sep, "/")}`,
    sizeBytes: stat.size,
    reason,
  };
}

function pickEvenlySpaced(sortedItems, targetCount) {
  if (sortedItems.length <= targetCount) {
    return [...sortedItems];
  }
  if (targetCount <= 1) {
    return [sortedItems[0]];
  }
  const lastIndex = sortedItems.length - 1;
  const picks = [];
  for (let i = 0; i < targetCount; i += 1) {
    const idx = Math.round((i * lastIndex) / (targetCount - 1));
    picks.push(sortedItems[idx]);
  }
  return [...new Set(picks)];
}

async function tryGenerateIconsWithSharp(sourcePath) {
  try {
    const sharpModule = await import("sharp");
    const sharp = sharpModule.default || sharpModule;
    const trimmed = await sharp(sourcePath).trim().png().toBuffer();
    const metadata = await sharp(trimmed).metadata();
    const side = Math.max(metadata.width || 0, metadata.height || 0);
    const squared = await sharp(trimmed)
      .resize(side, side, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    await sharp(squared).resize(192, 192).png().toFile(icon192Path);
    await sharp(squared).resize(512, 512).png().toFile(icon512Path);
    return {
      method: "sharp",
      degraded: false,
      note: "Generated icons using sharp trim/crop/resize.",
    };
  } catch (error) {
    return {
      method: "sharp_failed",
      degraded: true,
      note: String(error?.message || error),
    };
  }
}

async function tryGenerateIconsWithPillow(sourcePath) {
  const code = `
import sys
from PIL import Image

src, out192, out512 = sys.argv[1], sys.argv[2], sys.argv[3]
img = Image.open(src).convert("RGBA")
bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)
side = max(img.size[0], img.size[1])
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(img, ((side - img.size[0]) // 2, (side - img.size[1]) // 2), img)
resample = Image.Resampling.LANCZOS if hasattr(Image, "Resampling") else Image.LANCZOS
for size, destination in ((192, out192), (512, out512)):
    out = canvas.resize((size, size), resample=resample)
    out.save(destination, "PNG")
`;
  const result = spawnSync("python3", ["-c", code, sourcePath, icon192Path, icon512Path], {
    encoding: "utf8",
  });
  if (result.status === 0) {
    return {
      method: "pillow",
      degraded: false,
      note: "Generated icons using Python Pillow trim/crop/resize.",
    };
  }
  return {
    method: "pillow_failed",
    degraded: true,
    note: [result.stderr, result.stdout].filter(Boolean).join("\n").trim(),
  };
}

async function fallbackCopyIcons(sourcePath) {
  await fs.copyFile(sourcePath, icon192Path);
  await fs.copyFile(sourcePath, icon512Path);
  return {
    method: "raw_copy_fallback",
    degraded: true,
    note: "Copied original PNG to both icon slots due missing image toolchain.",
  };
}

async function main() {
  await fs.rm(assetsRoot, { recursive: true, force: true });
  await fs.rm(path.join(publicRoot, "icons"), { recursive: true, force: true });
  await ensureDir(assetsRoot);
  await ensureDir(path.join(publicRoot, "icons"));

  const chosenAssetSourceSet = new Set();

  const sprites = [];
  for (const definition of spriteDefinitions) {
    const copied = await copyWithStats(
      definition.sourceRel,
      definition.destinationRel,
      definition.role,
      definition.reason
    );
    sprites.push(copied);
    chosenAssetSourceSet.add(definition.sourceRel);
  }

  const allBackgroundFiles = await fs.readdir(backgroundsRoot);
  const mp4Files = allBackgroundFiles
    .filter((name) => /^grok_video_.*\.mp4$/i.test(name))
    .sort();
  const pngCandidates = allBackgroundFiles
    .filter((name) => /^17705820.*\.png$/i.test(name))
    .sort();

  const backgrounds = [];
  for (const name of mp4Files) {
    const sourceRel = `assets_backgrounds/${name}`;
    const copied = await copyWithStats(
      sourceRel,
      `assets/backgrounds/${name}`,
      "background_mp4",
      "Primary animated background loop."
    );
    backgrounds.push({ ...copied, fallbackType: "mp4" });
    chosenAssetSourceSet.add(sourceRel);
  }

  const desiredPngFallbackCount = clamp(12, 8, 16);
  const selectedFallbackPngs =
    pngCandidates.length >= 8
      ? pickEvenlySpaced(
          pngCandidates,
          Math.min(desiredPngFallbackCount, pngCandidates.length)
        )
      : [...pngCandidates];

  const pngFallback = [];
  for (const name of selectedFallbackPngs) {
    const sourceRel = `assets_backgrounds/${name}`;
    const copied = await copyWithStats(
      sourceRel,
      `assets/backgrounds/${name}`,
      "background_png_fallback",
      "PNG fallback frame for devices where MP4 cannot play reliably."
    );
    pngFallback.push({ ...copied, fallbackType: "png" });
    chosenAssetSourceSet.add(sourceRel);
  }

  const musicFiles = (await fs.readdir(musicRoot))
    .filter((name) => name.toLowerCase().endsWith(".mp3"))
    .sort();
  const music = [];
  for (const name of musicFiles) {
    const sourceRel = `assets_music/${name}`;
    const copied = await copyWithStats(
      sourceRel,
      `assets/music/${name}`,
      "music_track",
      "Included in random infinite playlist."
    );
    music.push(copied);
    chosenAssetSourceSet.add(sourceRel);
  }

  const preferredIconSources = [
    "assets_raw/The_Full_Weasel_Icon.png",
    "assets_raw/dexter_proud.png",
    "assets_raw/dexter_joyful.png",
  ];
  let iconSourceRel = null;
  for (const candidate of preferredIconSources) {
    try {
      await fs.access(path.join(root, candidate));
      iconSourceRel = candidate;
      break;
    } catch {
      // Keep scanning fallback candidates.
    }
  }
  if (!iconSourceRel) {
    iconSourceRel = preferredIconSources[preferredIconSources.length - 1];
  }
  chosenAssetSourceSet.add(iconSourceRel);
  const iconSourcePath = path.join(root, iconSourceRel);
  let iconResult = await tryGenerateIconsWithSharp(iconSourcePath);
  if (iconResult.degraded) {
    const pillowResult = await tryGenerateIconsWithPillow(iconSourcePath);
    if (!pillowResult.degraded) {
      iconResult = pillowResult;
    } else {
      iconResult = await fallbackCopyIcons(iconSourcePath);
    }
  }

  const manifestPayload = {
    generatedAt: new Date().toISOString(),
    sprites: sprites.map(({ role, url, sizeBytes, source, reason }) => ({
      role,
      url,
      sizeBytes,
      source,
      reason,
    })),
    backgrounds: {
      strategy: "mp4-primary-with-auto-png-fallback",
      mp4: backgrounds.map(({ url, sizeBytes, source, reason }) => ({
        url,
        sizeBytes,
        source,
        reason,
      })),
      pngFallback: pngFallback.map(({ url, sizeBytes, source, reason }) => ({
        url,
        sizeBytes,
        source,
        reason,
      })),
    },
    music: music.map(({ url, sizeBytes, source, reason }) => ({
      url,
      sizeBytes,
      source,
      reason,
    })),
  };

  await fs.writeFile(publicManifestPath, JSON.stringify(manifestPayload, null, 2));

  const rawFiles = await listFilesRecursive(rawRoot);
  const rejectedRawAssets = rawFiles
    .map((filePath) => path.relative(root, filePath))
    .filter((relativePath) => !chosenAssetSourceSet.has(relativePath))
    .map((relativePath) => ({
      source: relativePath,
      reason: "Not required by shipped game loop; excluded to keep payload smaller.",
    }));

  const rejectedBackgroundPng = pngCandidates
    .filter((name) => !selectedFallbackPngs.includes(name))
    .map((name) => ({
      source: `assets_backgrounds/${name}`,
      reason: "Not selected in curated evenly-spaced fallback frame subset.",
    }));

  const degradedFallbacks = [];
  if (pngCandidates.length < 8) {
    degradedFallbacks.push({
      type: "background_png_fallback_count",
      detail:
        "Only 7 PNG fallback frames exist in assets_backgrounds; shipped all available frames.",
    });
  }
  if (iconResult.degraded) {
    degradedFallbacks.push({
      type: "icon_generation",
      detail: iconResult.note,
    });
  }

  const reportPayload = {
    generatedAt: new Date().toISOString(),
    toolchain: {
      detected: "vite (created in this run because no existing package.json toolchain was present)",
      buildOutput: "dist",
    },
    chosenAssets: {
      sprites,
      backgrounds: {
        mp4: backgrounds,
        pngFallback,
      },
      music,
    },
    copyDestinations,
    rejectedAssets: [...rejectedRawAssets, ...rejectedBackgroundPng],
    missingNeedsOrDegradedFallbacks: degradedFallbacks,
    iconGeneration: {
      source: iconSourceRel,
      output192: "public/icons/icon-192.png",
      output512: "public/icons/icon-512.png",
      ...iconResult,
    },
  };

  await fs.writeFile(reportPath, JSON.stringify(reportPayload, null, 2));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

await main();
