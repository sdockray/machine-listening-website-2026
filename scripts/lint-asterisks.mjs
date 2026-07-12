import fs from 'node:fs';
import path from 'node:path';

const CONTENT_DIR = './src/content';

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
console.log(`Analyzing ${files.length} markdown files for missing caption markers...\n`);

function cleanString(str) {
  // Strip markdown link, alt wrappers, formatting characters like * _ ^
  return str.replace(/!\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/[*_#^]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
}

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let hasCaptionIssues = false;
  
  for (let idx = 0; idx < lines.length - 1; idx++) {
    const line = lines[idx];
    // Check if current line contains a markdown image
    const imageMatch = line.match(/!\[(.*?)\]\((.*?)\)/);
    if (imageMatch) {
      const altText = imageMatch[1].trim();
      if (!altText || altText.toLowerCase() === 'image.png' || altText.toLowerCase() === 'image') {
        // Skip generic alt text
        continue;
      }
      
      // Look at the subsequent non-blank lines (up to 3 lines down) to find a matching caption text
      let nextParaIdx = -1;
      for (let j = idx + 1; j < Math.min(lines.length, idx + 4); j++) {
        if (lines[j].trim() !== '') {
          nextParaIdx = j;
          break;
        }
      }
      
      if (nextParaIdx !== -1) {
        const nextPara = lines[nextParaIdx].trim();
        // If it already has ^ or caption: it's correct
        if (nextPara.startsWith('^') || nextPara.toLowerCase().startsWith('caption:')) {
          continue;
        }
        
        const cleanedAlt = cleanString(altText);
        const cleanedNext = cleanString(nextPara);
        
        // If the next paragraph is very similar to the alt text, it's a caption!
        if (cleanedAlt && cleanedNext && (cleanedAlt === cleanedNext || cleanedNext.startsWith(cleanedAlt) || cleanedAlt.startsWith(cleanedNext))) {
          if (!hasCaptionIssues) {
            console.log(`File: ${file}`);
            hasCaptionIssues = true;
          }
          console.log(`  Potential Caption at Line ${nextParaIdx + 1}:`);
          console.log(`    Image Alt: ${line.trim()}`);
          console.log(`    Caption  : ${lines[nextParaIdx].trim()}`);
        }
      }
    }
  }
}
