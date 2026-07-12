import fs from 'node:fs';
import path from 'node:path';

const CONTENT_DIR = './src/content';
const APPLY = process.argv.includes('--apply');

function walkFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.DS_Store' || entry.name === '.obsidian' || entry.name === '_assets' || entry.name === '_templates') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, acc);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      acc.push(full);
    }
  }
  return acc;
}

const files = walkFiles(CONTENT_DIR);
console.log(`Scanning ${files.length} markdown files for run-on headers. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

const TARGETS = [
  '**Presentations:**',
  '**Exhibitions:**',
  '**Reviews:**',
  '**Presentations:** ',
  '**Exhibitions:** ',
  '**Reviews:** '
];

let fixedCount = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let fileChanged = false;
  
  for (let idx = 0; idx < lines.length - 1; idx++) {
    const line = lines[idx].trim();
    if (TARGETS.includes(line)) {
      const nextLine = lines[idx + 1].trim();
      if (nextLine !== '') {
        // Insert a blank line
        lines.splice(idx + 1, 0, '');
        fileChanged = true;
        fixedCount++;
        console.log(`[RUNON] Fixed header spacing in ${file} at line ${idx + 1}: "${line}"`);
        // increment idx to skip the newly inserted blank line
        idx++;
      }
    }
  }
  
  if (fileChanged && APPLY) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
  }
}

console.log(`\nFixed run-on headers: ${fixedCount}`);
if (!APPLY) {
  console.log(`Run with --apply to save changes.`);
}
