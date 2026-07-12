import { visit } from 'unist-util-visit';
import fs from 'node:fs';
import path from 'node:path';

const CONTENT_DIR = path.resolve('./src/content');
const WIKI_LINK_REGEX = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;

function slugify(str) {
  return str.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function getMdFilesRecursive(dir, baseDir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getMdFilesRecursive(fullPath, baseDir, files);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const relativePath = path.relative(baseDir, fullPath);
      files.push({
        relativePath,
        filename: entry.name,
      });
    }
  }
  return files;
}

// Walk every collection folder once at build start and build a slug -> {collection, id} lookup
function buildLinkIndex() {
  const index = new Map();

  try {
    const collections = fs.readdirSync(CONTENT_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory());

    for (const collection of collections) {
      if (collection.name.startsWith('_') || collection.name === '.obsidian') continue;

      const collectionPath = path.join(CONTENT_DIR, collection.name);
      const mdFiles = getMdFilesRecursive(collectionPath, collectionPath);
      
      for (const file of mdFiles) {
        const id = file.relativePath.replace(/\.md$/, '');
        const filenameWithoutExt = file.filename.replace(/\.md$/, '');
        const key = slugify(filenameWithoutExt);
        index.set(key, { collection: collection.name, id });
      }
    }
  } catch (err) {
    console.error(`[wiki-links] Failed to build link index: ${err.message}`);
  }
  return index;
}



export function remarkWikiLinks(options = {}) {
  const basePath = String(options.basePath || '').trim().replace(/\/+$/, '');
  const linkIndex = buildLinkIndex();

  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null) return;
      const matches = [...node.value.matchAll(WIKI_LINK_REGEX)];
      if (matches.length === 0) return;

      const newChildren = [];
      let lastIndex = 0;

      for (const match of matches) {
        const [fullMatch, target, alias] = match;
        const matchStart = match.index;

        if (matchStart > lastIndex) {
          newChildren.push({ type: 'text', value: node.value.slice(lastIndex, matchStart) });
        }

        const key = slugify(target);
        const entry = linkIndex.get(key);
        const displayText = alias || target;

        if (entry) {
          newChildren.push({
            type: 'link',
            url: `${basePath}/${entry.collection}/${entry.id}/`,
            children: [{ type: 'text', value: displayText }],
          });
        } else {
          console.warn(`[wiki-links] Broken link: [[${target}]]`);
          newChildren.push({
            type: 'html',
            value: `<span class="wiki-link-broken" title="Page not found: ${target}">${displayText}</span>`,
          });
        }

        lastIndex = matchStart + fullMatch.length;
      }

      if (lastIndex < node.value.length) {
        newChildren.push({ type: 'text', value: node.value.slice(lastIndex) });
      }

      parent.children.splice(index, 1, ...newChildren);
    });
  };
}
