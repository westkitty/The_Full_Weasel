const INITIAL_ROLES = new Set(['title_screen']);

const GAMEPLAY_ROLES = new Set([
  'dance_clean_01',
  'dance_clean_02',
  'dance_clean_03',
  'hit_react_01',
  'hit_react_02',
  'hit_react_03',
  'perfect_pop',
  'shadow_blob',
  'spotlight_vignette',
  'censor_slam',
  'hazard_shark_fin',
  'item_nana_cheese',
  'item_unsweetened_iced_tea',
  'dexter_neutral',
  'dexter_focused',
  'dexter_excited',
  'dexter_joyful',
  'dexter_proud',
]);

function urlsForRoles(manifest, roles) {
  return (manifest.sprites || [])
    .filter((entry) => roles.has(entry.role) && entry.url)
    .map((entry) => entry.url);
}

export function initialImageUrls(manifest) {
  return urlsForRoles(manifest, INITIAL_ROLES);
}

export function gameplayImageUrls(manifest) {
  return urlsForRoles(manifest, GAMEPLAY_ROLES);
}

export function preloadImages(urls, ImageConstructor = Image) {
  return Promise.all(urls.map((url) => new Promise((resolve) => {
    const image = new ImageConstructor();
    image.onload = image.onerror = resolve;
    image.src = url;
  })));
}

export async function loadJsonDocument(url, options = {}) {
  const protocol = options.protocol ?? globalThis.location?.protocol;
  if (protocol === 'file:') {
    const request = (options.xhrFactory ?? (() => new XMLHttpRequest()))();
    return new Promise((resolve, reject) => {
      request.open('GET', url, true);
      request.responseType = 'json';
      request.onload = () => {
        if (request.status === 0 || (request.status >= 200 && request.status < 300)) {
          resolve(request.response);
        } else {
          reject(new Error(`manifest request failed (${request.status})`));
        }
      };
      request.onerror = () => reject(new Error('manifest request failed'));
      request.send();
    });
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('manifest fetch failed');
  return response.json();
}
