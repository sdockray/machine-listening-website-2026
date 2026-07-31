import fs from 'node:fs';
import path from 'node:path';
import { resolveMediaUrl } from './media-url';

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|svg|webp|avif|bmp|tiff)$/i;
const CONTENT_DIR = path.resolve('./src/content');

let cachedAssetMap: Map<string, string> | null = null;

function getAssetMap(): Map<string, string> {
  if (cachedAssetMap) return cachedAssetMap;

  const map = new Map<string, string>();
  const assetsDir = path.join(CONTENT_DIR, '_assets');

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.obsidian') continue;
        scan(fullPath);
      } else if (entry.isFile()) {
        if (entry.name === '.DS_Store' || entry.name.endsWith('.md')) continue;
        const relativeFromContent = path.relative(CONTENT_DIR, fullPath).replace(/\\/g, '/');
        const urlPath = `/${relativeFromContent.replace(/^\//, '')}`;

        map.set(relativeFromContent.toLowerCase(), urlPath);
        const relNoAssets = relativeFromContent.replace(/^_assets\//, '');
        map.set(relNoAssets.toLowerCase(), urlPath);

        const fnLower = entry.name.toLowerCase();
        if (!map.has(fnLower)) {
          map.set(fnLower, urlPath);
        }
        const ext = path.extname(fnLower);
        const stemNoSuffix = path.basename(fnLower, ext).replace(/-\d+$/, '') + ext;
        if (!map.has(stemNoSuffix)) {
          map.set(stemNoSuffix, urlPath);
        }
      }
    }
  }

  scan(assetsDir);
  cachedAssetMap = map;
  return map;
}

export function extractFirstMarkdownImage(markdown: string): string | undefined {
  if (!markdown) return undefined;

  // Match both standard markdown images ![alt](url) and Obsidian embeds ![[file]]
  const stdMatch = (() => {
    for (let i = 0; i < markdown.length - 3; i++) {
      if (markdown[i] !== '!' || markdown[i + 1] !== '[') continue;
      if (markdown[i + 2] === '[') continue; // Skip Obsidian ![[...]]

      const labelEnd = markdown.indexOf(']', i + 2);
      if (labelEnd === -1 || markdown[labelEnd + 1] !== '(') continue;

      let j = labelEnd + 2;
      let depth = 1;
      let url = '';

      while (j < markdown.length && depth > 0) {
        const char = markdown[j];
        if (char === '(') {
          depth += 1;
          if (depth > 1) url += char;
        } else if (char === ')') {
          depth -= 1;
          if (depth > 0) url += char;
        } else {
          url += char;
        }
        j += 1;
      }

      if (depth !== 0) continue;

      let trimmed = url.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
        trimmed = trimmed.slice(1, -1).trim();
      }

      const withTitle = trimmed.match(/^([^\s]+)\s+["'][^"']+["']\s*$/);
      if (withTitle) {
        trimmed = withTitle[1];
      }

      return { index: i, url: trimmed };
    }
    return null;
  })();

  const wikiMatch = (() => {
    const match = markdown.match(/!\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/);
    if (!match) return null;
    const target = match[1].trim();
    if (IMAGE_EXT_RE.test(target)) {
      return { index: match.index ?? 0, url: target };
    }
    return null;
  })();

  if (stdMatch && wikiMatch) {
    return stdMatch.index <= wikiMatch.index ? stdMatch.url : wikiMatch.url;
  }
  if (stdMatch) return stdMatch.url;
  if (wikiMatch) return wikiMatch.url;

  return undefined;
}

function encodePathSegments(pathStr: string): string {
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

export function resolveContentImage(rawUrl: string | undefined | null): string | undefined {
  if (!rawUrl) return undefined;
  const value = String(rawUrl).trim();
  if (!value) return undefined;

  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) {
    return value;
  }

  if (value.includes('_assets/') || value.includes('/assets/')) {
    const assetTail = value.split(/_?assets\//).pop();
    if (assetTail) {
      const canonical = `/assets/${encodePathSegments(assetTail.replace(/^\//, ''))}`;
      return resolveMediaUrl(canonical) || canonical;
    }
  }

  const cleanTarget = value.replace(/^(\.\.\/|\.\/|\/)+/, '').toLowerCase();
  const assetMap = getAssetMap();
  const found = assetMap.get(cleanTarget) || assetMap.get(path.basename(cleanTarget).toLowerCase());
  if (found) {
    const cleanFound = found.replace(/^\/_assets\//, '/assets/');
    const encoded = encodePathSegments(cleanFound);
    return resolveMediaUrl(encoded) || encoded;
  }

  const formatted = value.startsWith('/') ? value : `/${value}`;
  const encodedFormatted = encodePathSegments(formatted);
  return resolveMediaUrl(encodedFormatted) || encodedFormatted;
}

export function getCoverImage(entry: { data?: { coverImage?: string | null }; body?: string } | undefined | null): string | undefined {
  if (!entry) return undefined;
  const raw = entry.data?.coverImage || extractFirstMarkdownImage(entry.body || '');
  return resolveContentImage(raw);
}


