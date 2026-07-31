import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

const CONTENT_ASSETS_DIR = path.resolve('./src/content/_assets');

const MIME_TYPES: Record<string, string> = {
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

export async function getStaticPaths() {
  function getAllFiles(dir: string, baseDir: string = dir): { params: { path: string } }[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const paths: { params: { path: string } }[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.obsidian') continue;
        paths.push(...getAllFiles(fullPath, baseDir));
      } else if (entry.isFile()) {
        if (entry.name === '.DS_Store') continue;
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        paths.push({ params: { path: relativePath } });
      }
    }
    return paths;
  }

  return getAllFiles(CONTENT_ASSETS_DIR);
}

export const GET: APIRoute = async ({ params }) => {
  const reqPath = params.path;
  if (!reqPath) {
    return new Response('Not Found', { status: 404 });
  }

  const decodedPath = decodeURIComponent(reqPath);
  const filePath = path.join(CONTENT_ASSETS_DIR, decodedPath);

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return new Response('Asset Not Found', { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const fileBuffer = fs.readFileSync(filePath);

  return new Response(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000',
    },
  });
};
