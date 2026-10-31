import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const optimizedRoot = path.join(root, 'assets_optimized');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', ...options });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  }
}

async function ensureParent(file) {
  await fs.mkdir(path.dirname(file), { recursive: true });
}

async function optimizeImage(entry) {
  const source = path.join(root, entry.source);
  const relativeDestination = entry.destination
    .replace(/^public\/assets\//, '')
    .replace(/\.png$/i, '.webp');
  const destination = path.join(optimizedRoot, relativeDestination);
  await ensureParent(destination);
  run('magick', [
    source,
    '-strip',
    '-define', 'webp:lossless=true',
    '-define', 'webp:method=6',
    destination,
  ]);
  const [sourceStat, destinationStat] = await Promise.all([fs.stat(source), fs.stat(destination)]);
  if (destinationStat.size >= sourceStat.size) {
    await fs.rm(destination);
    return { source: entry.source, kept: false, sourceBytes: sourceStat.size };
  }
  return {
    source: entry.source,
    destination: path.relative(root, destination),
    kept: true,
    sourceBytes: sourceStat.size,
    optimizedBytes: destinationStat.size,
    encoding: 'lossless WebP',
  };
}

async function optimizeVideo(entry) {
  const source = path.join(root, entry.source);
  const destination = path.join(optimizedRoot, 'backgrounds', path.basename(entry.source));
  const candidate = `${destination}.candidate.mp4`;
  await ensureParent(destination);
  run('ffmpeg', [
    '-y', '-i', source,
    '-map', '0:v:0', '-an',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    candidate,
  ]);
  const [sourceStat, candidateStat] = await Promise.all([fs.stat(source), fs.stat(candidate)]);
  let encoding = 'H.264 CRF 23 slow + faststart';
  if (candidateStat.size < sourceStat.size) {
    await fs.rename(candidate, destination);
  } else {
    await fs.rm(candidate);
    run('ffmpeg', [
      '-y', '-i', source,
      '-map', '0:v:0', '-an', '-c:v', 'copy', '-movflags', '+faststart',
      destination,
    ]);
    encoding = 'original H.264 remuxed with faststart';
  }
  const optimizedStat = await fs.stat(destination);
  return {
    source: entry.source,
    destination: path.relative(root, destination),
    kept: true,
    sourceBytes: sourceStat.size,
    optimizedBytes: optimizedStat.size,
    encoding,
  };
}

await fs.rm(optimizedRoot, { recursive: true, force: true });
run(process.execPath, ['scripts/prepare-assets.mjs'], {
  env: { ...process.env, FULL_WEASEL_SOURCE_ASSETS: '1' },
});

const report = JSON.parse(await fs.readFile(path.join(root, 'ASSET_REPORT.json'), 'utf8'));
const imageEntries = [
  ...report.chosenAssets.sprites,
  ...report.chosenAssets.backgrounds.pngFallback,
];
const images = [];
for (const entry of imageEntries) images.push(await optimizeImage(entry));
const videos = [];
for (const entry of report.chosenAssets.backgrounds.mp4) videos.push(await optimizeVideo(entry));

await fs.mkdir(path.join(optimizedRoot, 'icons'), { recursive: true });
await Promise.all([
  fs.copyFile(path.join(root, 'public/icons/icon-192.png'), path.join(optimizedRoot, 'icons/icon-192.png')),
  fs.copyFile(path.join(root, 'public/icons/icon-512.png'), path.join(optimizedRoot, 'icons/icon-512.png')),
]);

await fs.writeFile(
  path.join(optimizedRoot, 'OPTIMIZATION_REPORT.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), images, videos }, null, 2)}\n`,
);
