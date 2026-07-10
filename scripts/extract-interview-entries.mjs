#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'src/content/interviews/interviews.md');
const OUT_DIR = path.join(ROOT, 'src/content/interviews/entries');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function slugify(input) {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripMdStyle(text) {
  return text.replace(/[*_`]+/g, '').trim();
}

function parseTranscript(line) {
  const wiki = line.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (wiki) {
    return {
      transcriptType: 'wiki',
      transcriptTarget: wiki[1].trim(),
      transcriptLabel: stripMdStyle(wiki[2] || 'Transcript'),
    };
  }

  const md = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (md) {
    return {
      transcriptType: 'url',
      transcriptTarget: md[2].trim(),
      transcriptLabel: stripMdStyle(md[1]),
    };
  }

  return {
    transcriptType: 'none',
    transcriptTarget: '',
    transcriptLabel: '',
  };
}

function parseAudio(line) {
  const md = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
  if (!md) return null;

  const target = md[2].trim();
  if (!/\.mp3(\?|#|$)/i.test(target)) return null;

  return {
    label: stripMdStyle(md[1]),
    url: target,
  };
}

function toYamlString(value) {
  return `"${String(value).replace(/"/g, '\\\"')}"`;
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Missing source file: ${SOURCE}`);
    process.exit(1);
  }

  ensureDir(OUT_DIR);

  const input = fs.readFileSync(SOURCE, 'utf8');
  const headingMatches = [...input.matchAll(/^###\s+(.+)$/gm)];

  if (headingMatches.length === 0) {
    console.error('No interview sections found.');
    process.exit(1);
  }

  const sections = headingMatches.map((match, idx) => {
    const start = match.index + match[0].length;
    const end = idx + 1 < headingMatches.length ? headingMatches[idx + 1].index : input.length;
    const heading = stripMdStyle(match[1]);
    const body = input.slice(start, end).trim();
    return { heading, body };
  });

  const total = sections.length;
  let written = 0;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const lines = section.body.split(/\r?\n/);

    const dateIdx = lines.findIndex((line) => /^Interview conducted/i.test(line.trim()));
    const transcriptIdx = lines.findIndex((line) => /Transcript/i.test(line) && (/\[\[/.test(line) || /\]\(/.test(line)));
    const audioIdxs = [];
    for (let j = 0; j < lines.length; j++) {
      if (parseAudio(lines[j])) audioIdxs.push(j);
    }

    const descriptionLines = lines.slice(0, dateIdx === -1 ? lines.length : dateIdx).join('\n').trim();
    const dateLine = dateIdx === -1 ? '' : lines[dateIdx].trim();
    const transcriptLine = transcriptIdx === -1 ? '' : lines[transcriptIdx].trim();

    const transcript = parseTranscript(transcriptLine);
    const audioFiles = audioIdxs.map((idx) => parseAudio(lines[idx])).filter(Boolean);

    const slug = slugify(section.heading);
    const filePath = path.join(OUT_DIR, `${slug}.md`);

    const firstParagraph = descriptionLines.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() || '';

    const out = [];
    out.push('---');
    out.push(`title: ${toYamlString(section.heading)}`);
    out.push('entryType: "interview"');
    out.push(`name: ${toYamlString(section.heading)}`);
    out.push(`description: ${toYamlString(firstParagraph)}`);
    out.push(`dateText: ${toYamlString(dateLine)}`);
    out.push(`transcriptType: ${toYamlString(transcript.transcriptType)}`);
    out.push(`transcriptTarget: ${toYamlString(transcript.transcriptTarget)}`);
    out.push(`transcriptLabel: ${toYamlString(transcript.transcriptLabel)}`);
    out.push(`priority: ${total - i}`);
    out.push('audioFiles:');
    if (audioFiles.length === 0) {
      out.push('  []');
    } else {
      for (const audio of audioFiles) {
        out.push(`  - label: ${toYamlString(audio.label)}`);
        out.push(`    url: ${toYamlString(audio.url)}`);
      }
    }
    out.push('---');
    out.push('');
    out.push(descriptionLines);
    out.push('');

    fs.writeFileSync(filePath, out.join('\n'), 'utf8');
    written += 1;
  }

  console.log(`Wrote ${written} interview entry files to src/content/interviews/entries.`);
}

main();
