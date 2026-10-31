import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

test('publishes smaller lossless WebP derivatives with source provenance', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'public/assets/manifest.json'), 'utf8'));
  const images = [
    ...manifest.sprites,
    ...manifest.backgrounds.pngFallback,
  ];
  assert.ok(images.some((entry) => entry.url.endsWith('.webp')));
  for (const entry of images.filter((item) => item.url.endsWith('.webp'))) {
    assert.match(entry.source, /\.(png)$/i);
    assert.ok(entry.sizeBytes < entry.sourceSizeBytes, `${entry.role} derivative must be smaller`);
    const signature = await fs.readFile(path.join(root, 'public', entry.url), { encoding: null });
    assert.equal(signature.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(signature.subarray(8, 12).toString('ascii'), 'WEBP');
  }
});

test('publishes only smaller streaming-friendly video derivatives', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'public/assets/manifest.json'), 'utf8'));
  for (const entry of manifest.backgrounds.mp4) {
    assert.ok(entry.sizeBytes <= entry.sourceSizeBytes, `${entry.url} grew`);
    const bytes = await fs.readFile(path.join(root, 'public', entry.url));
    const moov = bytes.indexOf(Buffer.from('moov'));
    const mdat = bytes.indexOf(Buffer.from('mdat'));
    assert.ok(moov > 0 && mdat > 0 && moov < mdat, `${entry.url} is missing faststart`);
  }
});
