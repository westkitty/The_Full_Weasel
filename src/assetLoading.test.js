import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialImageUrls,
  gameplayImageUrls,
  loadJsonDocument,
  preloadImages,
} from './assetLoading.js';

const manifest = {
  sprites: [
    { role: 'title_screen', url: '/title.webp' },
    { role: 'dance_clean_01', url: '/dance.webp' },
    { role: 'item_nana_cheese', url: '/cheese.webp' },
    { role: 'dance_base', url: '/unused-sheet.webp' },
    { role: 'pwa_guide', url: '/unused-guide.webp' },
  ],
  backgrounds: {
    pngFallback: [{ url: '/fallback.webp' }],
  },
};

test('loads only title-critical art before first useful interaction', () => {
  assert.deepEqual(initialImageUrls(manifest), ['/title.webp']);
});

test('predicts runtime gameplay art without preloading packaged-only images or backgrounds', () => {
  assert.deepEqual(gameplayImageUrls(manifest), ['/dance.webp', '/cheese.webp']);
});

test('settles image preloads on both load and error', async () => {
  const requested = [];
  class FakeImage {
    set src(value) {
      requested.push(value);
      queueMicrotask(() => value.includes('bad') ? this.onerror() : this.onload());
    }
  }
  await preloadImages(['/ok.webp', '/bad.webp'], FakeImage);
  assert.deepEqual(requested, ['/ok.webp', '/bad.webp']);
});

test('uses fetch for hosted manifests and XMLHttpRequest for file embeds', async () => {
  const hosted = await loadJsonDocument('/manifest.json', {
    protocol: 'https:',
    fetchImpl: async (url, options) => ({
      ok: true,
      json: async () => ({ url, cache: options.cache }),
    }),
  });
  assert.deepEqual(hosted, { url: '/manifest.json', cache: 'no-store' });

  class FakeRequest {
    response = { local: true };
    status = 200;
    open(_method, url) { this.url = url; }
    send() { queueMicrotask(() => this.onload()); }
  }
  const local = await loadJsonDocument('./manifest.json', {
    protocol: 'file:',
    xhrFactory: () => new FakeRequest(),
  });
  assert.deepEqual(local, { local: true });
});
