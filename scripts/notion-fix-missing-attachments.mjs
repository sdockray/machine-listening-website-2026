#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const MEDIA_EXTENSIONS = new Set([
  '.pdf', '.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg',
  '.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.xlsx',
]);

const MARKDOWN_LINK_REGEX = /(!?\[[^\]]*\]\()((?:[^()\\]|\\.|\([^)]*\))+)(\))/g;

function parseArgs(argv) {
  const args = { projectRoot: process.cwd(), apply: false, overwrite: false };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--project-root') args.projectRoot = argv[++i];
    else if (t === '--apply') args.apply = true;
    else if (t === '--overwrite') args.overwrite = true;
  }
  return args;
}

function toPosix(p) { return p.split(path.sep).join('/'); }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function isMedia(filePath) { return MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase()); }

function walk(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.isFile()) acc.push(full);
  }
  return acc;
}

function parseTargetToken(rawToken) {
  const token = rawToken.trim();
  if (token.startsWith('<') && token.endsWith('>')) return { pathPart: token.slice(1, -1), suffix: '', wrapped: true };
  const m = token.match(/^(\S+)(\s+['\"].*['\"])$/);
  if (m) return { pathPart: m[1], suffix: m[2], wrapped: false };
  return { pathPart: token, suffix: '', wrapped: false };
}

function externalOrAnchor(p) {
  return /^(https?:|mailto:|notion:)/i.test(p) || (p.startsWith('#') && !p.includes('/'));
}

function stripQueryHash(p) {
  const q = p.indexOf('?');
  const h = (p.startsWith('#') && p.includes('/')) ? -1 : p.indexOf('#');
  let cut = p.length;
  if (q !== -1) cut = Math.min(cut, q);
  if (h !== -1) cut = Math.min(cut, h);
  return p.slice(0, cut);
}

function encodePathForMarkdown(posixPath) {
  return posixPath.split('/').map((s) => encodeURIComponent(s)).join('/');
}

function pickCandidate(candidates, mdPath) {
  if (candidates.length <= 1) return candidates[0] || null;
  const mdBase = path.basename(mdPath, '.md').toLowerCase();
  const best = candidates.find((c) => c.toLowerCase().includes(mdBase));
  return best || candidates[0];
}

function main() {
  const { projectRoot, apply, overwrite } = parseArgs(process.argv);
  const contentRoot = path.join(projectRoot, 'src', 'content');
  const archiveRoot = path.join(contentRoot, '_assets', 'notion-import');
  const reportPath = path.join(projectRoot, 'docs', 'migration', 'attachments-fix-missing-report.json');

  if (!fs.existsSync(archiveRoot)) {
    console.error('Missing archive root:', archiveRoot);
    process.exit(1);
  }

  const archiveFiles = walk(archiveRoot).filter(isMedia);
  const byBase = new Map();
  for (const f of archiveFiles) {
    const b = path.basename(f).toLowerCase();
    if (!byBase.has(b)) byBase.set(b, []);
    byBase.get(b).push(f);
  }

  const mdFiles = walk(contentRoot).filter((f) => f.endsWith('.md') && !f.includes(`${path.sep}_assets${path.sep}`));

  const report = {
    generatedAt: new Date().toISOString(),
    apply,
    markdownFiles: mdFiles.length,
    linksSeen: 0,
    missingLinksFound: 0,
    fixedLinks: 0,
    copiedAssets: 0,
    unresolved: [],
  };

  for (const mdPath of mdFiles) {
    const mdDir = path.dirname(mdPath);
    const noteName = path.basename(mdPath, '.md');
    const noteRel = path.relative(contentRoot, mdPath);
    const noteDirRel = path.dirname(noteRel);
    const targetDir = path.join(contentRoot, '_assets', noteDirRel, noteName);
    ensureDir(targetDir);

    let markdown = fs.readFileSync(mdPath, 'utf8');
    let changed = false;

    markdown = markdown.replace(MARKDOWN_LINK_REGEX, (full, prefix, rawTarget, suffix) => {
      report.linksSeen += 1;
      const parsed = parseTargetToken(rawTarget);
      if (!parsed.pathPart || externalOrAnchor(parsed.pathPart)) return full;

      let clean = stripQueryHash(parsed.pathPart);
      try { clean = decodeURIComponent(clean); } catch {}

      const resolved = path.resolve(mdDir, clean);
      if (!isMedia(resolved)) return full;
      if (fs.existsSync(resolved)) return full;

      report.missingLinksFound += 1;

      const base = path.basename(clean).toLowerCase();
      const candidates = byBase.get(base) || [];
      const chosen = pickCandidate(candidates, mdPath);

      if (!chosen || !fs.existsSync(chosen)) {
        report.unresolved.push({ markdown: toPosix(path.relative(projectRoot, mdPath)), target: parsed.pathPart });
        return full;
      }

      const dest = path.join(targetDir, path.basename(chosen));
      if (!fs.existsSync(dest) || overwrite) {
        if (apply) fs.copyFileSync(chosen, dest);
        report.copiedAssets += 1;
      }

      const rel = encodePathForMarkdown(toPosix(path.relative(mdDir, dest)));
      const rebuilt = parsed.wrapped ? `<${rel}>${parsed.suffix}` : `${rel}${parsed.suffix}`;
      if (rebuilt !== rawTarget) {
        changed = true;
        report.fixedLinks += 1;
      }
      return `${prefix}${rebuilt}${suffix}`;
    });

    if (changed && apply) fs.writeFileSync(mdPath, markdown, 'utf8');
  }

  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Missing-attachment fix ${apply ? 'applied' : 'dry-run'} complete.`);
  console.log(`Missing links found: ${report.missingLinksFound}`);
  console.log(`Fixed links: ${report.fixedLinks}`);
  console.log(`Unresolved: ${report.unresolved.length}`);
  console.log('Report: docs/migration/attachments-fix-missing-report.json');
}

main();
