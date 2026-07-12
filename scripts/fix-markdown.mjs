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
console.log(`Liting and fixing ${files.length} markdown files. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

function cleanString(str) {
  return str.replace(/!\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/\[(.*?)\]\(.*?\)/g, '$1')
            .replace(/[*_#^]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
}

let totalCaptionsFixed = 0;
let totalAsterisksFixed = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let fileChanged = false;
  
  // First pass: fix general formatting issues
  for (let idx = 0; idx < lines.length; idx++) {
    let line = lines[idx];
    const original = line;
    
    // 1. Fix **** patterns
    if (line.includes('****')) {
      // If it's environments launch
      if (line.includes('****Environments 12 LP launch')) {
        line = line.replace('****Environments 12 LP launch', '*Environments 12* LP launch');
      } else if (line.includes('****[*Egocentric Perception Workshop*]')) {
        line = line.replace('****[*Egocentric Perception Workshop*]', '[*Egocentric Perception Workshop*]');
      } else if (line.includes('****[Gaussian Pop: 14 Theses]')) {
        line = line.replace('****[Gaussian Pop: 14 Theses]', '[Gaussian Pop: 14 Theses]');
      } else if (line.endsWith(' ****')) {
        line = line.replace(/ \*\*\*\*$/, '');
      } else if (line.includes('Mimi Ọnụọha’s ****performance-lecture')) {
        line = line.replace('Mimi Ọnụọha’s ****performance-lecture', 'Mimi Ọnụọha’s performance-lecture');
      }
    }
    
    // 2. Fix specific malformed bold-italics
    if (line.includes('***Eryk Salvaggio**')) {
      line = line.replace('***Eryk Salvaggio**', '**Eryk Salvaggio**');
    }
    if (line.includes('*#C***,**')) {
      line = line.replace(/\*#C\*\*\*, \*\*/g, '*#C*, ');
      line = line.replace(/\*#C\*\*\*,\*\*/g, '*#C*,');
    }
    if (line.includes('***Konvolute (hate speech)**,*')) {
      line = line.replace(/\*\*\*Konvolute \(hate speech\)\*\*,\*/g, '*Konvolute (hate speech)*,');
    }
    if (line.includes('***Konvolute* example.**')) {
      line = line.replace(/\*\*\*Konvolute\* example\.\*\*/g, '**_Konvolute_ example.**');
    }
    if (line.includes('***Speaking of atmospheres: more than voice and voice of the more-than’ by* Norie Neumark**')) {
      line = line.replace('***Speaking of atmospheres: more than voice and voice of the more-than’ by* Norie Neumark**', '*Speaking of atmospheres: more than voice and voice of the more-than*’ by Norie Neumark');
    }
    if (line.includes('***Environments 12*, 2025, Stereo LP, 35 mins. Future Resistenza.**')) {
      line = line.replace('***Environments 12*, 2025, Stereo LP, 35 mins. Future Resistenza.**', '**_Environments 12_, 2025, Stereo LP, 35 mins. Future Resistenza.**');
    }
    
    if (line !== original) {
      lines[idx] = line;
      totalAsterisksFixed++;
      fileChanged = true;
      console.log(`[AST] ${file}:${idx + 1}`);
      console.log(`  -: ${original.trim()}`);
      console.log(`  +: ${line.trim()}`);
    }
  }

  // Second pass: identify captions and prefix them with ^
  for (let idx = 0; idx < lines.length - 1; idx++) {
    const line = lines[idx];
    // Check if line contains a markdown image or standard video/audio link
    const imageMatch = line.match(/!\[(.*?)\]\((.*?)\)/);
    const linkMatch = line.match(/^\[(.*?)\]\((.*?)\)$/); // alone link in line
    
    const mediaMatch = imageMatch || linkMatch;
    if (mediaMatch) {
      const mediaText = mediaMatch[1].trim();
      if (!mediaText || mediaText.toLowerCase() === 'image.png' || mediaText.toLowerCase() === 'image') {
        continue;
      }
      
      // Look at the subsequent non-blank line (up to 3 lines down)
      let nextParaIdx = -1;
      for (let j = idx + 1; j < Math.min(lines.length, idx + 4); j++) {
        if (lines[j].trim() !== '') {
          nextParaIdx = j;
          break;
        }
      }
      
      if (nextParaIdx !== -1) {
        const nextPara = lines[nextParaIdx];
        const nextParaTrim = nextPara.trim();
        
        // Skip if already a caption
        if (nextParaTrim.startsWith('^') || nextParaTrim.toLowerCase().startsWith('caption:')) {
          continue;
        }
        
        const cleanedMedia = cleanString(mediaText);
        const cleanedNext = cleanString(nextParaTrim);
        
        // If the texts match, it's a caption!
        if (cleanedMedia && cleanedNext && (cleanedMedia === cleanedNext || cleanedNext.startsWith(cleanedMedia) || cleanedMedia.startsWith(cleanedNext))) {
          const originalCaption = lines[nextParaIdx];
          
          // Prefix with ^
          lines[nextParaIdx] = `^ ${originalCaption}`;
          totalCaptionsFixed++;
          fileChanged = true;
          console.log(`[CAP] ${file}:${nextParaIdx + 1}`);
          console.log(`  -: ${originalCaption.trim()}`);
          console.log(`  +: ${lines[nextParaIdx].trim()}`);
        }
      }
    }
  }

  if (fileChanged && APPLY) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
  }
}

console.log(`\nLint Summary:`);
console.log(`- Fixed asterisks: ${totalAsterisksFixed}`);
console.log(`- Added caption markers: ${totalCaptionsFixed}`);
if (!APPLY) {
  console.log(`\nRun with --apply to write these changes back to the files.`);
}
