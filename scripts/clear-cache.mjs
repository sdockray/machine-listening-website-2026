import fs from 'node:fs';

const PATHS = ['./.astro', './dist'];

for (const path of PATHS) {
  if (fs.existsSync(path)) {
    console.log(`Removing ${path}...`);
    fs.rmSync(path, { recursive: true, force: true });
  }
}
console.log('Cache cleared successfully!');
