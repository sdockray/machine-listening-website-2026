import { visit } from 'unist-util-visit';
import fs from 'node:fs';
import path from 'node:path';

const CONTENT_DIR = path.resolve('./src/content');
const WIKI_LINK_REGEX = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;

function slugify(str) {
  return str.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

// Walk every collection folder once at build start and build a slug -> {collection, id} lookup
function buildLinkIndex() {
  const index = new Map();
  const collections = fs.readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  for (const collection of collections) {
    const collectionPath = path.join(CONTENT_DIR, collection.name);
    const files = fs.readdirSync(collectionPath).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const id = file.replace(/\.md$/, '');
      const key = slugify(id);
      index.set(key, { collection: collection.name, id });
    }
  }
  return index;
}

export function remarkWikiLinks() {
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
            url: `/${entry.collection}/${entry.id}/`,
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
