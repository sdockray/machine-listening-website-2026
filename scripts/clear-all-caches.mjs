import fs from 'node:fs';

const PATHS = [
  './.astro',
  './dist',
  './node_modules/.vite',
  './node_modules/.astro',
  './debug-wikilinks.log'
];

for (const path of PATHS) {
  if (fs.existsSync(path)) {
    console.log(`Removing ${path}...`);
    fs.rmSync(path, { recursive: true, force: true });
  }
}
console.log('All caches cleared successfully!');
