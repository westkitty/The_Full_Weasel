import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const result = spawnSync(process.execPath, [viteBin, 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, FULL_WEASEL_EMBED: '1' },
});
if (result.status !== 0) process.exit(result.status ?? 1);
await Promise.all([
  fs.rm(path.join(root, 'dist-embed', 'sw.js'), { force: true }),
  fs.rm(path.join(root, 'dist-embed', 'manifest.webmanifest'), { force: true }),
]);

const outputRoot = path.join(root, 'dist-embed');
const outputFiles = await fs.readdir(path.join(outputRoot, 'assets'));
const cssFile = outputFiles.find((name) => name.endsWith('.css'));
const jsFile = outputFiles.find((name) => name.endsWith('.js'));
if (!cssFile || !jsFile) throw new Error('embed build is missing runtime assets');
const [html, css, js] = await Promise.all([
  fs.readFile(path.join(outputRoot, 'index.html'), 'utf8'),
  fs.readFile(path.join(outputRoot, 'assets', cssFile), 'utf8'),
  fs.readFile(path.join(outputRoot, 'assets', jsFile), 'utf8'),
]);
if (!html.includes('src="./assets/') || !html.includes('href="./assets/')) {
  throw new Error('embed entry points are not relative');
}
if (html.includes('manifest.webmanifest') || html.includes('/icons/')) {
  throw new Error('embed retained root-scoped PWA links');
}
if (css.includes('fonts.googleapis.com') || html.includes('fonts.googleapis.com')) {
  throw new Error('embed retained a remote font request');
}
if (!js.includes('full-weasel:close') || !js.includes('XMLHttpRequest')) {
  throw new Error('embed lifecycle or file manifest support is missing');
}
if (js.includes('serviceWorker.register')) {
  throw new Error('embed retained root-scoped service-worker registration');
}
console.log('embed verification: PASS');
