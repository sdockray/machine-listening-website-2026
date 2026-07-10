#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const MARKDOWN_LINK_REGEX = /(!?\[([^\]]*)\]\()((?:[^()\\]|\\.|\([^)]*\))+)(\))/g;

function parseArgs(argv) {
  const args = { projectRoot: process.cwd(), apply: false };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--project-root') args.projectRoot = argv[++i];
    else if (t === '--apply') args.apply = true;
  }
  return args;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function walk(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.isFile()) acc.push(full);
  }
  return acc;
}

function stripNotionId(baseName) {
  return baseName.replace(/ [0-9a-f]{32}$/i, '').trim();
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

function parseTargetToken(rawToken) {
  const token = rawToken.trim();
  if (token.startsWith('<') && token.endsWith('>')) {
    return { pathPart: token.slice(1, -1), suffix: '', wrapped: true };
  }
  const m = token.match(/^(\S+)(\s+['\"].*['\"])$/);
  if (m) return { pathPart: m[1], suffix: m[2], wrapped: false };
  return { pathPart: token, suffix: '', wrapped: false };
}

function externalOrAnchor(p) {
  return /^(https?:|mailto:|notion:)/i.test(p) || (p.startsWith('#') && !p.includes('/'));
}

function stripQueryHash(p) {
  const q = p.indexOf('?');
  const h = p.indexOf('#');
  let cut = p.length;
  if (q !== -1) cut = Math.min(cut, q);
  if (h !== -1) cut = Math.min(cut, h);
  return p.slice(0, cut);
}

function textForAlias(label) {
  return label.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
}

function collectionHint(target) {
  const t = target.toLowerCase();
  if (t.includes('works')) return 'works';
  if (t.includes('curation')) return 'curation';
  if (t.includes('performances')) return 'performances';
  if (t.includes('software')) return 'software';
  if (t.includes('curriculum')) return 'curriculum';
  if (t.includes('texts')) return 'texts';
  if (t.includes('interviews')) return 'interviews';
  if (t.includes('events')) return 'events';
  if (t.includes('people')) return 'people';
  return null;
}

function main() {
  const { projectRoot, apply } = parseArgs(process.argv);
  const contentRoot = path.join(projectRoot, 'src', 'content');
  const planPath = path.join(projectRoot, 'docs', 'migration', 'migration-plan.json');
  const reportPath = path.join(projectRoot, 'docs', 'migration', 'wikilinks-rewrite-report.json');

  if (!fs.existsSync(planPath)) {
    console.error('Missing migration plan file.');
    process.exit(1);
  }

  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

  const byExactNotionBase = new Map();
  const bySlug = new Map();

  for (const entry of plan.entries) {
    const notionBase = path.basename(entry.source, '.md');
    if (!byExactNotionBase.has(notionBase)) byExactNotionBase.set(notionBase, []);
    byExactNotionBase.get(notionBase).push(entry);

    if (!bySlug.has(entry.slug)) bySlug.set(entry.slug, []);
    bySlug.get(entry.slug).push(entry);
  }

  const mdFiles = walk(contentRoot).filter((f) => f.endsWith('.md') && !f.includes(`${path.sep}_assets${path.sep}`));

  const report = {
    generatedAt: new Date().toISOString(),
    apply,
    filesScanned: mdFiles.length,
    filesUpdated: 0,
    linksSeen: 0,
    linksConverted: 0,
    skippedExternal: 0,
    skippedNonMd: 0,
    skippedAmbiguous: 0,
    skippedNotFound: 0,
    ambiguous: [],
    notFound: [],
  };

  for (const mdFile of mdFiles) {
    let content = fs.readFileSync(mdFile, 'utf8');
    let changed = false;

    content = content.replace(MARKDOWN_LINK_REGEX, (full, prefix, label, rawTarget, suffix) => {
      report.linksSeen += 1;

      const parsed = parseTargetToken(rawTarget);
      if (!parsed.pathPart || externalOrAnchor(parsed.pathPart)) {
        report.skippedExternal += 1;
        return full;
      }

      let clean = stripQueryHash(parsed.pathPart);
      try { clean = decodeURIComponent(clean); } catch {}

      if (!clean.toLowerCase().endsWith('.md')) {
        report.skippedNonMd += 1;
        return full;
      }

      const base = path.basename(clean, '.md');
      let candidates = byExactNotionBase.get(base) || [];

      if (candidates.length === 0) {
        const slug = slugify(stripNotionId(base));
        candidates = bySlug.get(slug) || [];
      }

      if (candidates.length > 1) {
        const hint = collectionHint(clean);
        if (hint) candidates = candidates.filter((c) => c.collection === hint);
      }

      if (candidates.length !== 1) {
        if (candidates.length === 0) {
          report.skippedNotFound += 1;
          report.notFound.push({ file: path.relative(projectRoot, mdFile), target: rawTarget });
        } else {
          report.skippedAmbiguous += 1;
          report.ambiguous.push({
            file: path.relative(projectRoot, mdFile),
            target: rawTarget,
            options: candidates.map((c) => `${c.collection}/${c.slug}`),
          });
        }
        return full;
      }

      const resolved = candidates[0];
      const alias = textForAlias(label);
      const replacement = alias && alias.toLowerCase() !== resolved.slug
        ? `[[${resolved.slug}|${alias}]]`
        : `[[${resolved.slug}]]`;

      report.linksConverted += 1;
      changed = true;
      return replacement;
    });

    if (changed) {
      report.filesUpdated += 1;
      if (apply) fs.writeFileSync(mdFile, content, 'utf8');
    }
  }

  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Wikilink rewrite ${apply ? 'applied' : 'dry-run'} complete.`);
  console.log(`Files updated: ${report.filesUpdated}`);
  console.log(`Links converted: ${report.linksConverted}`);
  console.log(`Ambiguous: ${report.skippedAmbiguous}, not found: ${report.skippedNotFound}`);
  console.log('Report: docs/migration/wikilinks-rewrite-report.json');
}

main();
