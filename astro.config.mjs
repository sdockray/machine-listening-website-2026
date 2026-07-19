// astro.config.mjs
import { defineConfig } from 'astro/config'; // force config cache reload
import { unified } from '@astrojs/markdown-remark';
import { remarkWikiLinks } from './src/lib/remark-wikilinks.mjs';
import { remarkMediaEmbeds } from './src/lib/remark-media-embeds.mjs';

// const BASE_PATH = '/machine-listening-website-2026';
const BASE_PATH = '/';
const MEDIA_BASE_URL = (process.env.MEDIA_BASE_URL || '').replace(/\/+$/, '');

export default defineConfig({
  // site: 'https://sdockray.github.io',
  site: 'https://future.machinelistening.exposed',
  base: BASE_PATH,
  vite: {
    define: {
      'process.env.MEDIA_BASE_URL': JSON.stringify(MEDIA_BASE_URL),
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        [remarkWikiLinks, { basePath: BASE_PATH }],
        [remarkMediaEmbeds, { basePath: BASE_PATH, mediaBaseUrl: MEDIA_BASE_URL }],
      ],
    }),
  },
});

