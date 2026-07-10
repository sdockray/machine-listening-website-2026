// astro.config.mjs
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { remarkWikiLinks } from './src/lib/remark-wikilinks.mjs';

export default defineConfig({
  site: 'https://sdockray.github.io',
  base: '/machine-listening-website-2026',
  markdown: {
    processor: unified({
      remarkPlugins: [remarkWikiLinks],
    }),
  },
});

