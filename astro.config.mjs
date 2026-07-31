// astro.config.mjs
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import fs from 'node:fs';
import path from 'node:path';
import { remarkWikiLinks } from './src/lib/remark-wikilinks.mjs';
import { remarkMediaEmbeds } from './src/lib/remark-media-embeds.mjs';

const BASE_PATH = '/';
const MEDIA_BASE_URL = (process.env.MEDIA_BASE_URL || '').replace(/\/+$/, '');

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

function findAssetFile(relPath) {
  const decodedPath = decodeURIComponent(relPath);
  const fullPath = path.join(process.cwd(), 'src/content/_assets', decodedPath);
  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return fullPath;
  }

  const dir = path.dirname(fullPath);
  if (fs.existsSync(dir)) {
    const filename = path.basename(decodedPath);
    const ext = path.extname(filename);
    const stem = path.basename(filename, ext).replace(/(?:-\d+)+$/, '');
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const entryExt = path.extname(entry);
      if (ext && entryExt.toLowerCase() !== ext.toLowerCase()) continue;
      const entryStem = path.basename(entry, entryExt).replace(/(?:-\d+)+$/, '');
      if (entryStem.toLowerCase() === stem.toLowerCase()) {
        const candidatePath = path.join(dir, entry);
        if (fs.statSync(candidatePath).isFile()) {
          return candidatePath;
        }
      }
    }
  }
  return null;
}

function serveLocalAssetsDevPlugin() {
  return {
    name: 'serve-local-assets-dev-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url || '';
        if (rawUrl.startsWith('/_assets/') || rawUrl.startsWith('/assets/')) {
          const relPath = rawUrl.replace(/^\/(_assets|assets)\//, '').split('?')[0];
          const targetFile = findAssetFile(relPath);

          if (targetFile) {
            const ext = path.extname(targetFile).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'no-cache');
            fs.createReadStream(targetFile).pipe(res);
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  site: 'https://machinelistening.exposed',
  base: BASE_PATH,
  vite: {
    plugins: [serveLocalAssetsDevPlugin()],
    define: {
      'process.env.MEDIA_BASE_URL': JSON.stringify(MEDIA_BASE_URL),
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        [remarkWikiLinks, { basePath: BASE_PATH, mediaBaseUrl: MEDIA_BASE_URL }],
        [remarkMediaEmbeds, { basePath: BASE_PATH, mediaBaseUrl: MEDIA_BASE_URL }],
      ],
    }),
  },
});
