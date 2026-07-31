import { visit } from 'unist-util-visit';
import fs from 'node:fs';
import path from 'node:path';

const CONTENT_DIR = path.resolve('./src/content');
const WIKI_LINK_REGEX = /(!?)\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|svg|webp|avif|bmp|tiff)$/i;
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|flac|aac)$/i;
const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|ogv)$/i;

function slugify(str) {
  return str.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function getMdFilesRecursive(dir, baseDir, files = []) {
  if (!fs.existsSync(dir)) return files;
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
        const id = file.relativePath.replace(/\.md$/, '').replace(/\\/g, '/');
        const filenameWithoutExt = file.filename.replace(/\.md$/, '');
        const entryObj = { collection: collection.name, id, filename: file.filename };

        index.set(slugify(filenameWithoutExt), entryObj);
        index.set(slugify(id), entryObj);
        index.set(slugify(`${collection.name}/${id}`), entryObj);
        index.set(slugify(`${collection.name}/${filenameWithoutExt}`), entryObj);
      }
    }
  } catch (err) {
    console.error(`[wiki-links] Failed to build link index: ${err.message}`);
  }
  return index;
}

function getAllAssetsRecursive(dir, baseDir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.obsidian') continue;
      getAllAssetsRecursive(fullPath, baseDir, files);
    } else if (entry.isFile()) {
      if (entry.name === '.DS_Store' || entry.name.endsWith('.md')) continue;
      const relativeFromContent = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      files.push({
        fullPath,
        relativeFromContent,
        filename: entry.name,
      });
    }
  }
  return files;
}

function buildAssetIndex() {
  const assetFiles = getAllAssetsRecursive(CONTENT_DIR, CONTENT_DIR);
  const pathMap = new Map();
  const filenameMap = new Map();

  for (const asset of assetFiles) {
    const rel = asset.relativeFromContent;
    const relLower = rel.toLowerCase();
    pathMap.set(relLower, rel);

    const relNoAssets = rel.replace(/^_assets\//, '');
    const relNoAssetsLower = relNoAssets.toLowerCase();
    pathMap.set(relNoAssetsLower, rel);

    const fnLower = asset.filename.toLowerCase();
    if (!filenameMap.has(fnLower)) {
      filenameMap.set(fnLower, []);
    }
    filenameMap.get(fnLower).push({ rel, relNoAssets, fullPath: asset.fullPath });
  }

  return { pathMap, filenameMap };
}

function resolveAsset(target, currentRelativeDir, assetIndex) {
  if (!target) return null;
  
  let cleanTarget = target.trim().replace(/\\/g, '/');
  cleanTarget = cleanTarget.replace(/^(\.\.\/|\.\/|\/)+/, '');
  cleanTarget = cleanTarget.replace(/^(_assets|assets)\//, '');
  const cleanTargetLower = cleanTarget.toLowerCase();

  if (assetIndex.pathMap.has(cleanTargetLower)) {
    return assetIndex.pathMap.get(cleanTargetLower);
  }

  if (currentRelativeDir) {
    const combined = path.posix.join(currentRelativeDir, cleanTarget).toLowerCase();
    if (assetIndex.pathMap.has(combined)) {
      return assetIndex.pathMap.get(combined);
    }
  }

  const filename = path.basename(cleanTarget).toLowerCase();
  const matches = assetIndex.filenameMap.get(filename);
  if (matches && matches.length > 0) {
    if (matches.length === 1) {
      return matches[0].rel;
    }
    if (currentRelativeDir) {
      const dirLower = currentRelativeDir.toLowerCase();
      const bestMatch = matches.find((m) => m.relNoAssets.toLowerCase().startsWith(dirLower));
      if (bestMatch) return bestMatch.rel;
    }
    return matches[0].rel;
  }

  // Fallback: try matching stem without any sequence of -1, -2 suffixes
  const ext = path.extname(filename);
  const stem = path.basename(filename, ext).replace(/(?:-\d+)+$/, '');
  for (const [fnKey, fileMatches] of assetIndex.filenameMap.entries()) {
    const fnExt = path.extname(fnKey);
    if (ext && fnExt !== ext) continue;
    const fnStem = path.basename(fnKey, fnExt).replace(/(?:-\d+)+$/, '');
    if (fnStem === stem) {
      if (currentRelativeDir) {
        const dirLower = currentRelativeDir.toLowerCase();
        const bestMatch = fileMatches.find((m) => m.relNoAssets.toLowerCase().startsWith(dirLower));
        if (bestMatch) return bestMatch.rel;
      }
      return fileMatches[0].rel;
    }
  }

  // Fallback: if in document directory and matching extension
  if (currentRelativeDir) {
    const dirLower = currentRelativeDir.toLowerCase();
    for (const [fnKey, fileMatches] of assetIndex.filenameMap.entries()) {
      const fnExt = path.extname(fnKey);
      if (ext && fnExt !== ext) continue;
      const bestMatch = fileMatches.find((m) => m.relNoAssets.toLowerCase().startsWith(dirLower));
      if (bestMatch) return bestMatch.rel;
    }
  }

  return null;
}

function encodePathSegments(pathStr) {
  if (!pathStr) return pathStr;
  return pathStr
    .split('/')
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');
}

function formatAssetUrl(relPath, basePath, mediaBaseUrl) {
  const cleanRel = relPath.replace(/^\//, '').replace(/^_assets\//, 'assets/');
  const encodedRel = encodePathSegments(cleanRel);
  if (mediaBaseUrl) {
    const assetTail = encodedRel.replace(/^assets\//, '');
    return `${mediaBaseUrl.replace(/\/+$/, '')}/${assetTail}`;
  }
  const prefix = basePath ? (basePath.endsWith('/') ? basePath : `${basePath}/`) : '/';
  return `${prefix}${encodedRel}`;
}

export function remarkWikiLinks(options = {}) {
  const basePath = String(options.basePath || '').trim().replace(/\/+$/, '');
  const mediaBaseUrl = String(options.mediaBaseUrl || process.env.MEDIA_BASE_URL || '').replace(/\/+$/, '');
  const linkIndex = buildLinkIndex();

  return (tree, vfile) => {
    const assetIndex = buildAssetIndex();
    let currentRelativeDir = '';
    if (vfile?.path) {
      const absPath = path.resolve(vfile.path);
      const relToContent = path.relative(CONTENT_DIR, absPath);
      currentRelativeDir = path.dirname(relToContent).replace(/\\/g, '/');
      if (currentRelativeDir === '.') currentRelativeDir = '';
    }

    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null) return;
      const matches = [...node.value.matchAll(WIKI_LINK_REGEX)];
      if (matches.length === 0) return;

      const newChildren = [];
      let lastIndex = 0;

      for (const match of matches) {
        const [fullMatch, embedPrefix, targetRaw, aliasRaw] = match;
        const matchStart = match.index;

        if (matchStart > lastIndex) {
          newChildren.push({ type: 'text', value: node.value.slice(lastIndex, matchStart) });
        }

        const isEmbed = embedPrefix === '!';
        const target = targetRaw ? targetRaw.trim() : '';
        const alias = aliasRaw ? aliasRaw.trim() : null;

        if (isEmbed) {
          const resolvedAsset = resolveAsset(target, currentRelativeDir, assetIndex);
          if (resolvedAsset) {
            const assetUrl = formatAssetUrl(resolvedAsset, basePath, mediaBaseUrl);
            const isImage = IMAGE_EXT_RE.test(target) || IMAGE_EXT_RE.test(resolvedAsset);
            const isAudio = AUDIO_EXT_RE.test(target) || AUDIO_EXT_RE.test(resolvedAsset);
            const isVideo = VIDEO_EXT_RE.test(target) || VIDEO_EXT_RE.test(resolvedAsset);

            if (isImage) {
              let width = undefined;
              let height = undefined;
              const altParts = [];

              if (alias) {
                const parts = alias.split('|').map((p) => p.trim()).filter(Boolean);
                for (const part of parts) {
                  const dimMatch = part.match(/^(\d+)(?:px)?(?:[xX](\d+)(?:px)?)?$/);
                  if (dimMatch) {
                    width = dimMatch[1];
                    if (dimMatch[2]) height = dimMatch[2];
                  } else {
                    altParts.push(part);
                  }
                }
              }

              const altText = altParts.join(' ');
              const imageNode = {
                type: 'image',
                url: assetUrl,
                alt: altText,
              };

              if (width) {
                const hProperties = { width };
                if (height) {
                  hProperties.height = height;
                  hProperties.style = `max-width: ${width}px; width: 100%; height: ${height}px; object-fit: cover;`;
                } else {
                  hProperties.style = `max-width: ${width}px; width: 100%; height: auto;`;
                }
                imageNode.data = { hProperties };
              }

              newChildren.push(imageNode);
            } else if (isAudio) {
              newChildren.push({
                type: 'html',
                value: `<audio class="content-audio" controls preload="none" src="${assetUrl}"></audio>`,
              });
            } else if (isVideo) {
              newChildren.push({
                type: 'html',
                value: `<video class="content-video" controls preload="metadata" playsinline><source src="${assetUrl}" type="video/mp4" /></video>`,
              });
            } else {
              const displayText = alias || path.basename(resolvedAsset);
              newChildren.push({
                type: 'link',
                url: assetUrl,
                children: [{ type: 'text', value: displayText }],
              });
            }
          } else {
            console.warn(`[wiki-links] Asset embed not found: ![[${target}]] in ${vfile?.path || 'unknown file'}`);
            const displayText = alias || target;
            newChildren.push({
              type: 'html',
              value: `<span class="wiki-link-broken" title="Asset not found: ${target}">![[${displayText}]]</span>`,
            });
          }
        } else {
          let cleanTarget = target.replace(/^(\/|\.\/)+/, '');
          let anchor = '';
          const hashIdx = cleanTarget.indexOf('#');
          if (hashIdx !== -1) {
            anchor = cleanTarget.slice(hashIdx);
            cleanTarget = cleanTarget.slice(0, hashIdx);
          }
          cleanTarget = cleanTarget.replace(/\.md$/i, '');

          const key = slugify(cleanTarget);
          const entry = linkIndex.get(key);
          const displayText = alias || cleanTarget;

          if (entry) {
            const linkUrl = `${basePath}/${entry.collection}/${entry.id}/${anchor}`;
            newChildren.push({
              type: 'link',
              url: linkUrl,
              children: [{ type: 'text', value: displayText }],
            });
          } else {
            const resolvedAsset = resolveAsset(target, currentRelativeDir, assetIndex);
            if (resolvedAsset) {
              const assetUrl = formatAssetUrl(resolvedAsset, basePath, mediaBaseUrl);
              newChildren.push({
                type: 'link',
                url: assetUrl,
                children: [{ type: 'text', value: displayText }],
              });
            } else {
              console.warn(`[wiki-links] Broken link: [[${target}]] in ${vfile?.path || 'unknown file'}`);
              newChildren.push({
                type: 'html',
                value: `<span class="wiki-link-broken" title="Page not found: ${target}">${displayText}</span>`,
              });
            }
          }
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

