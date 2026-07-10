// astro.config.mjs
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { remarkWikiLinks } from './src/lib/remark-wikilinks.mjs';

export default defineConfig({
  markdown: {
    processor: unified({
      remarkPlugins: [remarkWikiLinks],
    }),
  },
});

