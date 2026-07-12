import fs from 'node:fs';
import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkWikiLinks } from '../src/lib/remark-wikilinks.mjs';
import { remarkMediaEmbeds } from '../src/lib/remark-media-embeds.mjs';

const fileContent = fs.readFileSync('./src/content/works/how-to-read-a-dataset.md', 'utf8');

const processor = await createMarkdownProcessor({
  remarkPlugins: [
    remarkWikiLinks,
    [remarkMediaEmbeds, { basePath: '/machine-listening-website-2026', mediaBaseUrl: 'https://machinelistening-web.somethingilearned.today' }]
  ]
});

const result = await processor.render(fileContent);
console.log('--- HTML RESULT ---');
// print only first 1000 characters of HTML to avoid clutter
console.log(result.code);
