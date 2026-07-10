#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const COLLECTION_PATTERNS = [
  { collection: 'works', pattern: /\/site map\/Works /i },
  { collection: 'performances', pattern: /\/site map\/Performances/i },
  { collection: 'curation', pattern: /\/site map\/Curation/i },
  { collection: 'software', pattern: /\/site map\/Software/i },
  { collection: 'curriculum', pattern: /\/site map\/Curriculum/i },
  { collection: 'texts', pattern: /\/site map\/Texts/i },
  { collection: 'interviews', pattern: /\/site map\/Interviews/i },
  { collection: 'events', pattern: /\/site map\/Events/i },
  { collection: 'people', pattern: /\/People [0-9a-f]{32}\.md$/i },
];

const SOURCE_OVERRIDES = {
  'Machine Listening/55 Falls Ambient Assisted Living (with documentati 2a721d7b0efc80b689f5e0fccff53476.md': 'works',
  'Machine Listening/Environments 12 82d888418fdf4ba9855131dd17293475.md': 'works',
  'Machine Listening/Environments 12 New Concepts in Acoustic Enrichmen e9ac6f90f0774a7cbdee03c0f7e0ca51.md': 'works',
  'Machine Listening/Machine Listening - Euro Tour 2025 1f221d7b0efc801ca55ef20ff7591ac7.md': 'events',
  'Machine Listening/This Hideous Replica ca697762e883456c92ede6cee42d84a0.md': 'curation',
  'Machine Listening/site map/CA2024 - Uncomputable d51efb827bc94393867cdf85e5e040fd.md': 'events',
  'Machine Listening/site map/Clone Metamorphosis ccf66ead55894ae98cf717b080db3f14.md': 'events',
  'Machine Listening/site map/CV2024 - Uncomputable cd886b58e0f34b079156d1e95e7ca579.md': 'events',
  'Machine Listening/site map/Data audit workshop a623ac4d7f3e42659ab980aa1698a262.md': 'events',
  'Machine Listening/site map/Egocentric Perception Workshop 19721d7b0efc80b3a088d7c86675201d.md': 'events',
  'Machine Listening/site map/Environments 12 ae3abb64e1384f33ac658ec0500ebde1.md': 'events',
  'Machine Listening/site map/Eryk Salvaggio Gaussian Pop 5680e71024ed4773b843293f43885e71.md': 'events',
  'Machine Listening/site map/Machine Listening Dataset LARP 24621d7b0efc80df9079c49b62d4adf4.md': 'events',
  'Machine Listening/site map/Machine Listening Euro Tour 2025 1f221d7b0efc80a09850ecf13b5f7bf3.md': 'events',
  'Machine Listening/site map/Now or Never support materials c892284887e1492f8aac0b11beea9aed.md': 'events',
  'Machine Listening/site map/Unsound residency b02d57155dd245a79d593229cd5a83f3.md': 'events',
  'Machine Listening/site map/(Against) the coming world of listening machines ( ee57456160a143e299df9e8581750d90.md': 'texts',
  'Machine Listening/site map/Improvisation and control (essay, 2021) a291e164fdf14bf39cca4fccfe8ac6bd.md': 'texts',
  'Machine Listening/site map/Lessons in how (not) to be heard (essay, 2020) ea94e9e50f1c454099d4e5286219f4e4.md': 'texts',
  'Machine Listening/site map/Listening with the pandemic (essay, 2020) 723b302b1b134b0ba0670ee593fbcc84.md': 'texts',
  'Machine Listening/site map/The Planetization of Machine Listening 27321d7b0efc801a9147deaf042fed99.md': 'texts',
  'Machine Listening/site map/Audrey Amsellem transcript 321f16e9c3724d94bb4f8315b3f8a422.md': 'interviews',
  'Machine Listening/site map/Bernard Mont Reynaud transcript e4b246c8027d4981b1874a1d83d1ec42.md': 'interviews',
  'Machine Listening/site map/Beth Semel transcript d70d8209fcda4dc395f7b3b5b71ddfc3.md': 'interviews',
  'Machine Listening/site map/Guillaume Heuguet transcript badf4d97c1b8475b870b140a885fb7bf.md': 'interviews',
  'Machine Listening/site map/Max Ritts transcript 426840680cae4076b60e76e8db642dd0.md': 'interviews',
  'Machine Listening/site map/Santiago Rentiera transcript a4fc0b1a74924554920756c68958cc89.md': 'interviews',
};

function walkFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, acc);
    } else if (entry.isFile()) {
      acc.push(full);
    }
  }
  return acc;
}

function stripNotionId(baseName) {
  return baseName
    .replace(/ [0-9a-f]{32}$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(input) {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getCollection(relativePath) {
  const normalized = relativePath.split(path.sep).join('/');

  if (SOURCE_OVERRIDES[normalized]) {
    return SOURCE_OVERRIDES[normalized];
  }

  for (const rule of COLLECTION_PATTERNS) {
    if (rule.pattern.test('/' + normalized)) return rule.collection;
  }

  const fileName = stripNotionId(path.basename(normalized, '.md')).toLowerCase();
  if (fileName.includes('transcript')) return 'interviews';
  if (fileName.includes('(essay')) return 'texts';

  return null;
}

function extractTitle(markdown, fallback) {
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)/);
    if (match) return match[1].trim();
  }
  return fallback;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sourcePriority(sourcePath) {
  const hasSiteMap = sourcePath.includes('/site map/');
  const depth = sourcePath.split('/').length;
  return (hasSiteMap ? 1000 : 0) + depth;
}

function parseArgs(argv) {
  const args = {
    source: '/Users/sdoc0001/Downloads/ML-website',
    projectRoot: process.cwd(),
  };

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--source') {
      args.source = argv[++i];
    } else if (token === '--project-root') {
      args.projectRoot = argv[++i];
    }
  }
  return args;
}

function main() {
  const { source, projectRoot } = parseArgs(process.argv);
  const outputDir = path.join(projectRoot, 'docs', 'migration');
  ensureDir(outputDir);

  const allFiles = walkFiles(source);
  const markdownFiles = allFiles.filter((f) => f.toLowerCase().endsWith('.md'));

  const entries = [];
  const unresolved = [];

  for (const absPath of markdownFiles) {
    const relativeSource = path.relative(source, absPath).split(path.sep).join('/');
    const base = path.basename(absPath, '.md');
    const baseClean = stripNotionId(base);

    const markdown = fs.readFileSync(absPath, 'utf8');
    const title = extractTitle(markdown, baseClean);

    const collection = getCollection(relativeSource);
    const slug = slugify(baseClean || title);

    if (!collection) {
      unresolved.push({
        source: relativeSource,
        reason: 'No collection mapping rule matched',
      });
      continue;
    }

    const destination = `src/content/${collection}/${slug}.md`;
    entries.push({
      source: relativeSource,
      collection,
      title,
      slug,
      destination,
    });
  }

  const dedupedEntries = [];
  const duplicates = [];
  const byDestination = new Map();

  for (const entry of entries) {
    const existing = byDestination.get(entry.destination);
    if (!existing) {
      byDestination.set(entry.destination, entry);
      continue;
    }

    const existingScore = sourcePriority(existing.source);
    const candidateScore = sourcePriority(entry.source);

    if (candidateScore > existingScore) {
      duplicates.push({
        destination: entry.destination,
        kept: entry.source,
        dropped: existing.source,
      });
      byDestination.set(entry.destination, entry);
    } else {
      duplicates.push({
        destination: entry.destination,
        kept: existing.source,
        dropped: entry.source,
      });
    }
  }

  for (const value of byDestination.values()) {
    dedupedEntries.push(value);
  }

  dedupedEntries.sort((a, b) => a.destination.localeCompare(b.destination));
  unresolved.sort((a, b) => a.source.localeCompare(b.source));

  const summary = dedupedEntries.reduce((acc, entry) => {
    acc[entry.collection] = (acc[entry.collection] || 0) + 1;
    return acc;
  }, {});

  const report = {
    generatedAt: new Date().toISOString(),
    source,
    totalMarkdownFiles: markdownFiles.length,
    mappedFiles: dedupedEntries.length,
    unresolvedFiles: unresolved.length,
    duplicateDestinations: duplicates.length,
    summaryByCollection: summary,
    entries: dedupedEntries,
    duplicates,
    unresolved,
  };

  fs.writeFileSync(
    path.join(outputDir, 'migration-plan.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );

  const md = [];
  md.push('# Notion to Astro Migration Plan (Dry Run)');
  md.push('');
  md.push(`- Source: ${source}`);
  md.push(`- Markdown files scanned: ${markdownFiles.length}`);
  md.push(`- Mapped files: ${dedupedEntries.length}`);
  md.push(`- Unresolved files: ${unresolved.length}`);
  md.push(`- Duplicate destinations removed: ${duplicates.length}`);
  md.push('');
  md.push('## Summary by collection');
  const summaryKeys = Object.keys(summary).sort();
  for (const key of summaryKeys) {
    md.push(`- ${key}: ${summary[key]}`);
  }

  md.push('');
  md.push('## Mapped files');
  for (const entry of dedupedEntries) {
    md.push(`- ${entry.source} -> ${entry.destination}`);
  }

  if (duplicates.length > 0) {
    md.push('');
    md.push('## Duplicate destination conflicts (auto-resolved)');
    for (const item of duplicates) {
      md.push(`- ${item.destination}: kept ${item.kept}, dropped ${item.dropped}`);
    }
  }

  if (unresolved.length > 0) {
    md.push('');
    md.push('## Unresolved files');
    for (const item of unresolved) {
      md.push(`- ${item.source} (${item.reason})`);
    }
  }

  fs.writeFileSync(path.join(outputDir, 'migration-plan.md'), md.join('\n'), 'utf8');

  console.log('Wrote migration plan files:');
  console.log('- docs/migration/migration-plan.json');
  console.log('- docs/migration/migration-plan.md');
  console.log('');
  console.log(`Mapped ${dedupedEntries.length} / ${markdownFiles.length} markdown files.`);
  if (duplicates.length > 0) {
    console.log(`Resolved ${duplicates.length} destination duplicates.`);
  }
  if (unresolved.length > 0) {
    console.log(`Unresolved: ${unresolved.length} (see report).`);
  }
}

main();
