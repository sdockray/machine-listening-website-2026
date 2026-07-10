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
  const args = {
    projectRoot: process.cwd(),
    apply: false,
    overwrite: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--project-root') args.projectRoot = argv[++i];
    else if (token === '--apply') args.apply = true;
    else if (token === '--overwrite') args.overwrite = true;
  }
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function encodePathForMarkdown(posixPath) {
  return posixPath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function isMediaPath(filePath) {
  return MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function parseTargetToken(rawToken) {
  const token = rawToken.trim();

  if (token.startsWith('<') && token.endsWith('>')) {
    return { pathPart: token.slice(1, -1), suffix: '', wrapped: true };
  }

  const m = token.match(/^(\S+)(\s+['\"].*['\"])$/);
  if (m) {
    return { pathPart: m[1], suffix: m[2], wrapped: false };
  }

  return { pathPart: token, suffix: '', wrapped: false };
}

function isExternalOrAnchor(pathPart) {
  return /^(https?:|mailto:|notion:)/i.test(pathPart) || (pathPart.startsWith('#') && !pathPart.includes('/'));
}

function withoutQueryHash(pathPart) {
  const q = pathPart.indexOf('?');
  const h = (pathPart.startsWith('#') && pathPart.includes('/')) ? -1 : pathPart.indexOf('#');
  let cut = pathPart.length;
  if (q !== -1) cut = Math.min(cut, q);
  if (h !== -1) cut = Math.min(cut, h);
  return pathPart.slice(0, cut);
}

function uniqueFileName(targetDir, desiredName, usedNames) {
  const ext = path.extname(desiredName);
  const base = path.basename(desiredName, ext);

  let i = 1;
  let candidate = desiredName;
  while (usedNames.has(candidate) || fs.existsSync(path.join(targetDir, candidate))) {
    i += 1;
    candidate = `${base}-${i}${ext}`;
  }
  usedNames.add(candidate);
  return candidate;
}

function main() {
  const { projectRoot, apply, overwrite } = parseArgs(process.argv);
  const planPath = path.join(projectRoot, 'docs', 'migration', 'migration-plan.json');
  const reportPath = path.join(projectRoot, 'docs', 'migration', 'attachments-normalize-report.json');
  const contentRoot = path.join(projectRoot, 'src', 'content');

  if (!fs.existsSync(planPath)) {
    console.error('Missing migration plan file.');
    process.exit(1);
  }

  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

  const summary = {
    generatedAt: new Date().toISOString(),
    apply,
    overwrite,
    filesScanned: 0,
    filesUpdated: 0,
    linksSeen: 0,
    linksRewritten: 0,
    assetsCopied: 0,
    assetsSkippedExists: 0,
    assetsMissing: 0,
  };

  const details = [];

  for (const entry of plan.entries) {
    const destMd = path.join(projectRoot, entry.destination);
    if (!fs.existsSync(destMd)) continue;

    summary.filesScanned += 1;

    const mdDir = path.dirname(destMd);
    const noteName = path.basename(destMd, '.md');
    const noteRel = path.relative(contentRoot, destMd);
    const noteDirRel = path.dirname(noteRel);
    const targetAssetsDir = path.join(contentRoot, '_assets', noteDirRel, noteName);

    ensureDir(targetAssetsDir);

    const perFile = {
      markdown: toPosix(path.relative(projectRoot, destMd)),
      linksSeen: 0,
      linksRewritten: 0,
      assetsCopied: 0,
      assetsSkippedExists: 0,
      assetsMissing: 0,
    };

    const sourceToNew = new Map();
    const usedNames = new Set();

    let markdown = fs.readFileSync(destMd, 'utf8');
    let changed = false;

    markdown = markdown.replace(MARKDOWN_LINK_REGEX, (full, prefix, rawTarget, suffix) => {
      summary.linksSeen += 1;
      perFile.linksSeen += 1;

      const parsed = parseTargetToken(rawTarget);
      if (!parsed.pathPart || isExternalOrAnchor(parsed.pathPart)) {
        return full;
      }

      const clean = withoutQueryHash(parsed.pathPart);
      let decoded = clean;
      try {
        decoded = decodeURIComponent(clean);
      } catch {
        decoded = clean;
      }

      const sourceAbs = path.resolve(mdDir, decoded);
      if (!isMediaPath(sourceAbs)) {
        return full;
      }

      if (!fs.existsSync(sourceAbs)) {
        summary.assetsMissing += 1;
        perFile.assetsMissing += 1;
        return full;
      }

      let fileName = sourceToNew.get(sourceAbs);
      if (!fileName) {
        fileName = uniqueFileName(targetAssetsDir, path.basename(sourceAbs), usedNames);
        sourceToNew.set(sourceAbs, fileName);

        const destAbs = path.join(targetAssetsDir, fileName);
        if (fs.existsSync(destAbs) && !overwrite) {
          summary.assetsSkippedExists += 1;
          perFile.assetsSkippedExists += 1;
        } else {
          if (apply) fs.copyFileSync(sourceAbs, destAbs);
          summary.assetsCopied += 1;
          perFile.assetsCopied += 1;
        }
      }

      const relFromNote = toPosix(path.relative(mdDir, path.join(targetAssetsDir, fileName)));
      const encodedRel = encodePathForMarkdown(relFromNote);
      const rebuilt = parsed.wrapped ? `<${encodedRel}>${parsed.suffix}` : `${encodedRel}${parsed.suffix}`;

      if (rebuilt !== rawTarget) {
        changed = true;
        summary.linksRewritten += 1;
        perFile.linksRewritten += 1;
      }

      return `${prefix}${rebuilt}${suffix}`;
    });

    if (changed) {
      summary.filesUpdated += 1;
      if (apply) fs.writeFileSync(destMd, markdown, 'utf8');
    }

    if (perFile.linksRewritten > 0 || perFile.assetsCopied > 0 || perFile.assetsMissing > 0) {
      details.push(perFile);
    }
  }

  const report = { ...summary, details };
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Attachment normalization ${apply ? 'applied' : 'dry-run'} complete.`);
  console.log(`Files updated: ${summary.filesUpdated}`);
  console.log(`Links rewritten: ${summary.linksRewritten}`);
  console.log(`Assets copied: ${summary.assetsCopied}, missing: ${summary.assetsMissing}`);
  console.log('Report: docs/migration/attachments-normalize-report.json');
}

main();
