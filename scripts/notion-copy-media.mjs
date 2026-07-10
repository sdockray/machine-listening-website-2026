#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const MEDIA_EXTENSIONS = new Set([
  '.pdf', '.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg',
  '.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.xlsx',
]);

function parseArgs(argv) {
  const args = {
    projectRoot: process.cwd(),
    source: '/Users/sdoc0001/Downloads/ML-website',
    apply: false,
    overwrite: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--project-root') args.projectRoot = argv[++i];
    else if (token === '--source') args.source = argv[++i];
    else if (token === '--apply') args.apply = true;
    else if (token === '--overwrite') args.overwrite = true;
  }
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function walkFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else if (entry.isFile()) acc.push(full);
  }
  return acc;
}

function isMediaFile(filePath) {
  return MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function stripNotionId(baseName) {
  return baseName.replace(/ [0-9a-f]{32}$/i, '').trim();
}

function extractMarkdownLinks(markdown) {
  const links = [];
  const regex = /!?\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    let raw = match[1].trim();

    // Strip optional title from markdown link target.
    if (raw.startsWith('<') && raw.endsWith('>')) {
      raw = raw.slice(1, -1).trim();
    } else {
      const spaceIdx = raw.indexOf(' ');
      if (spaceIdx !== -1) raw = raw.slice(0, spaceIdx);
    }

    if (!raw) continue;
    if (/^(https?:|mailto:)/i.test(raw)) continue;

    // Treat pure hash links as anchors, but keep paths like "#C/file.jpg".
    if (raw.startsWith('#') && !raw.includes('/')) continue;

    const noQuery = raw.split('?')[0];
    const pathPart = noQuery.startsWith('#') ? noQuery : noQuery.split('#')[0];
    if (!pathPart) continue;

    let decoded = pathPart;
    try {
      decoded = decodeURIComponent(noQuery);
    } catch {
      decoded = noQuery;
    }

    links.push(decoded);
  }
  return links;
}

function safeCopyFile(src, dest, apply, overwrite) {
  if (!fs.existsSync(src)) return { copied: false, reason: 'missing_source' };
  if (fs.existsSync(dest) && !overwrite) return { copied: false, reason: 'exists' };
  if (apply) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
  return { copied: true, reason: 'ok' };
}

function main() {
  const { projectRoot, source, apply, overwrite } = parseArgs(process.argv);
  const contentRoot = path.join(projectRoot, 'src', 'content');
  const srcRoot = path.join(projectRoot, 'src');
  const archiveRoot = path.join(contentRoot, '_assets', 'notion-import');
  const planPath = path.join(projectRoot, 'docs', 'migration', 'migration-plan.json');
  const reportPath = path.join(projectRoot, 'docs', 'migration', 'media-copy-report.json');

  if (!fs.existsSync(planPath)) {
    console.error('Missing migration plan file. Run migration plan first.');
    process.exit(1);
  }

  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

  const allFiles = walkFiles(source);
  const mediaFiles = allFiles.filter(isMediaFile);

  const archiveStats = {
    totalMediaFiles: mediaFiles.length,
    copied: 0,
    skippedExists: 0,
    missingSource: 0,
  };

  for (const srcPath of mediaFiles) {
    const rel = path.relative(source, srcPath);
    const dest = path.join(archiveRoot, rel);
    const result = safeCopyFile(srcPath, dest, apply, overwrite);
    if (result.copied) archiveStats.copied++;
    else if (result.reason === 'exists') archiveStats.skippedExists++;
    else if (result.reason === 'missing_source') archiveStats.missingSource++;
  }

  const linkedStats = {
    linksSeen: 0,
    uniqueSources: 0,
    copied: 0,
    skippedExists: 0,
    missingSource: 0,
    unsafePath: 0,
  };

  const seenSourceDest = new Set();

  for (const entry of plan.entries) {
    const srcMd = path.join(source, ...entry.source.split('/'));
    const destMd = path.join(projectRoot, entry.destination);

    if (!fs.existsSync(srcMd)) continue;

    const markdown = fs.readFileSync(srcMd, 'utf8');
    const links = extractMarkdownLinks(markdown);

    for (const relLink of links) {
      linkedStats.linksSeen++;

      const sourceAsset = path.resolve(path.dirname(srcMd), relLink);
      if (!isMediaFile(sourceAsset)) continue;

      const destAsset = path.resolve(path.dirname(destMd), relLink);
      const sourceDestKey = `${sourceAsset}=>${destAsset}`;
      if (seenSourceDest.has(sourceDestKey)) continue;
      seenSourceDest.add(sourceDestKey);
      linkedStats.uniqueSources++;

      // Keep copies inside src/ so legacy relative links like ../../Works... resolve.
      const srcRootResolved = path.resolve(srcRoot) + path.sep;
      const destResolved = path.resolve(destAsset);
      if (!destResolved.startsWith(srcRootResolved)) {
        linkedStats.unsafePath++;
        continue;
      }

      const result = safeCopyFile(sourceAsset, destAsset, apply, overwrite);
      if (result.copied) linkedStats.copied++;
      else if (result.reason === 'exists') linkedStats.skippedExists++;
      else if (result.reason === 'missing_source') linkedStats.missingSource++;
    }

    // Notion export commonly stores page attachments in a sibling folder named
    // after the page title (without the UUID suffix). Mirror that folder.
    const srcBase = stripNotionId(path.basename(srcMd, '.md'));
    const srcSiblingDir = path.join(path.dirname(srcMd), srcBase);
    if (fs.existsSync(srcSiblingDir) && fs.statSync(srcSiblingDir).isDirectory()) {
      const siblingFiles = walkFiles(srcSiblingDir).filter(isMediaFile);
      for (const siblingSrc of siblingFiles) {
        const rel = path.relative(srcSiblingDir, siblingSrc);
        const siblingDestDir = path.join(path.dirname(destMd), srcBase);
        const siblingDest = path.join(siblingDestDir, rel);

        const sourceDestKey = `${siblingSrc}=>${siblingDest}`;
        if (seenSourceDest.has(sourceDestKey)) continue;
        seenSourceDest.add(sourceDestKey);
        linkedStats.uniqueSources++;

        const srcRootResolved = path.resolve(srcRoot) + path.sep;
        const destResolved = path.resolve(siblingDest);
        if (!destResolved.startsWith(srcRootResolved)) {
          linkedStats.unsafePath++;
          continue;
        }

        const result = safeCopyFile(siblingSrc, siblingDest, apply, overwrite);
        if (result.copied) linkedStats.copied++;
        else if (result.reason === 'exists') linkedStats.skippedExists++;
        else if (result.reason === 'missing_source') linkedStats.missingSource++;
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    apply,
    overwrite,
    source,
    archiveRoot,
    archiveStats,
    linkedStats,
  };

  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Media copy ${apply ? 'applied' : 'dry-run'} complete.`);
  console.log(`Archive media: ${archiveStats.copied}/${archiveStats.totalMediaFiles}`);
  console.log(`Linked assets copied: ${linkedStats.copied}, missing: ${linkedStats.missingSource}`);
  console.log('Report: docs/migration/media-copy-report.json');
}

main();
