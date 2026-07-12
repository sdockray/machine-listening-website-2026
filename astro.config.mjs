// astro.config.mjs
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { remarkWikiLinks } from './src/lib/remark-wikilinks.mjs';
import { remarkMediaEmbeds } from './src/lib/remark-media-embeds.mjs';

const BASE_PATH = '/machine-listening-website-2026';
const MEDIA_BASE_URL = (process.env.MEDIA_BASE_URL || '').replace(/\/+$/, '');

export default defineConfig({
  site: 'https://sdockray.github.io',
  base: BASE_PATH,
  vite: {
    define: {
      'process.env.MEDIA_BASE_URL': JSON.stringify(MEDIA_BASE_URL),
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [remarkWikiLinks, [remarkMediaEmbeds, { basePath: BASE_PATH, mediaBaseUrl: MEDIA_BASE_URL }]],
    }),
  },
});

