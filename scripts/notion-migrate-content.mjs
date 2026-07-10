#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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

function escapeYaml(str) {
  return String(str ?? '').replace(/"/g, '\\"');
}

function pickDate(markdown) {
  const m = markdown.match(/(?:^|\n)Date:\s*([^\n]+)/i);
  if (!m) return null;
  const raw = m[1].trim();
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) return iso.toISOString().slice(0, 10);
  return null;
}

function buildFrontmatter(collection, entry, markdown) {
  const date = pickDate(markdown);
  const yearFromDate = date ? Number(date.slice(0, 4)) : null;

  if (collection === 'people') {
    return [
      '---',
      `name: "${escapeYaml(entry.title)}"`,
      'role: ""',
      'url: ""',
      'bio: ""',
      '---',
      '',
    ].join('\n');
  }

  if (collection === 'works') {
    return [
      '---',
      `title: "${escapeYaml(entry.title)}"`,
      ...(yearFromDate ? [`year: ${yearFromDate}`] : []),
      'description: ""',
      '---',
      '',
    ].join('\n');
  }

  if (collection === 'performances') {
    return [
      '---',
      `title: "${escapeYaml(entry.title)}"`,
      ...(date ? [`date: ${date}`] : []),
      'location: ""',
      '---',
      '',
    ].join('\n');
  }

  if (collection === 'curation') {
    return [
      '---',
      `title: "${escapeYaml(entry.title)}"`,
      ...(date ? [`date: ${date}`] : []),
      '---',
      '',
    ].join('\n');
  }

  if (collection === 'software') {
    return [
      '---',
      `title: "${escapeYaml(entry.title)}"`,
      'repoUrl: ""',
      'description: ""',
      '---',
      '',
    ].join('\n');
  }

  if (collection === 'curriculum') {
    return [
      '---',
      `title: "${escapeYaml(entry.title)}"`,
      ...(date ? [`date: ${date}`] : []),
      '---',
      '',
    ].join('\n');
  }

  if (collection === 'texts') {
    return [
      '---',
      `title: "${escapeYaml(entry.title)}"`,
      'author: ""',
      ...(date ? [`date: ${date}`] : []),
      '---',
      '',
    ].join('\n');
  }

  if (collection === 'interviews') {
    return [
      '---',
      `title: "${escapeYaml(entry.title)}"`,
      'interviewee: ""',
      ...(date ? [`date: ${date}`] : []),
      '---',
      '',
    ].join('\n');
  }

  if (collection === 'events') {
    return [
      '---',
      `title: "${escapeYaml(entry.title)}"`,
      ...(date ? [`date: ${date}`] : []),
      'location: ""',
      '---',
      '',
    ].join('\n');
  }

  throw new Error(`Unsupported collection: ${collection}`);
}

function stripLeadingH1(markdown) {
  return markdown.replace(/^#\s+.+\n+/, '');
}

function rewriteLinks(markdown) {
  // Keep links relative for now; this import stage focuses on frontmatter and location.
  return markdown;
}

function main() {
  const { projectRoot, source, apply, overwrite } = parseArgs(process.argv);
  const planPath = path.join(projectRoot, 'docs', 'migration', 'migration-plan.json');
  const reportPath = path.join(projectRoot, 'docs', 'migration', 'migration-import-report.json');

  if (!fs.existsSync(planPath)) {
    console.error('Missing plan file. Run migration:plan first.');
    process.exit(1);
  }

  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const written = [];
  const skipped = [];

  for (const entry of plan.entries) {
    const sourcePath = path.join(source, ...entry.source.split('/'));
    const destinationPath = path.join(projectRoot, entry.destination);
    ensureDir(path.dirname(destinationPath));

    if (!fs.existsSync(sourcePath)) {
      skipped.push({ ...entry, reason: 'source_missing' });
      continue;
    }

    if (fs.existsSync(destinationPath) && !overwrite) {
      skipped.push({ ...entry, reason: 'destination_exists' });
      continue;
    }

    const sourceMd = fs.readFileSync(sourcePath, 'utf8');
    const contentBody = rewriteLinks(stripLeadingH1(sourceMd));
    const frontmatter = buildFrontmatter(entry.collection, entry, sourceMd);
    const output = `${frontmatter}${contentBody}`;

    if (apply) {
      fs.writeFileSync(destinationPath, output, 'utf8');
    }

    written.push({
      source: entry.source,
      destination: entry.destination,
      collection: entry.collection,
      applied: apply,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    apply,
    overwrite,
    totalPlanEntries: plan.entries.length,
    readyToWrite: written.length,
    skipped: skipped.length,
    skippedByReason: skipped.reduce((acc, item) => {
      acc[item.reason] = (acc[item.reason] || 0) + 1;
      return acc;
    }, {}),
    written,
    skipped,
  };

  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Import ${apply ? 'applied' : 'dry-run completed'}: ${written.length} ready, ${skipped.length} skipped.`);
  console.log('Report: docs/migration/migration-import-report.json');
}

main();
