# Machine Listening Website 2026

This project started from Astro minimal, but it is not running with default Astro configuration anymore.

This document records every intentional configuration change so future contributors do not need to reverse-engineer behavior from source files.

## Astro Configuration Changes From Defaults

Source of truth: [astro.config.mjs](astro.config.mjs)

1. Site URL is explicitly set.
Value: site = https://sdockray.github.io
Reason: Generates correct canonical URLs and absolute URLs for sitemap/social metadata in production.

2. Base path is explicitly set.
Value: base = /machine-listening-website-2026
Reason: The site is deployed to a GitHub Pages subpath, not domain root.
Impact: Internal links and generated asset URLs are prefixed with this base path.

3. Vite define injects MEDIA_BASE_URL.
Value: process.env.MEDIA_BASE_URL is injected at build time.
Source: MEDIA_BASE_URL environment variable, normalized to remove trailing slashes.
Reason: Keeps media host configurable per environment while avoiding malformed double-slash URLs.

4. Astro markdown processor is replaced with a custom unified processor.
Default Astro behavior uses built-in markdown pipeline.
Current behavior uses @astrojs/markdown-remark and a custom unified processor.

5. Custom remark plugin: wiki links.
Plugin: src/lib/remark-wikilinks.mjs
Configured with: basePath = /machine-listening-website-2026
Reason: Rewrites wiki-style links into deploy-safe URLs under the configured base path.

6. Custom remark plugin: media embeds.
Plugin: src/lib/remark-media-embeds.mjs
Configured with:
- basePath = /machine-listening-website-2026
- mediaBaseUrl = normalized MEDIA_BASE_URL
Reason: Converts media references to the expected runtime URL format for local/dev and hosted media scenarios.

## TypeScript Configuration Changes

Source of truth: [tsconfig.json](tsconfig.json)

1. Strict Astro TypeScript profile is enabled.
Value: extends = astro/tsconfigs/strict
Reason: Enforces stricter type checking than a looser baseline.

2. Include and exclude are explicitly set.
Values:
- include: .astro/types.d.ts and all project files
- exclude: dist
Reason: Ensures generated Astro types are included for editor/typecheck accuracy and avoids checking build output.

## Environment Variables Used By Config

1. MEDIA_BASE_URL
Used by: astro.config.mjs (vite.define and remark-media-embeds)
Default behavior when unset: empty string
Normalization: trailing slashes are removed before use
Example value: https://example-cdn.com/media

## Operational Notes For Maintainers

1. If deployment path changes, update BASE_PATH in [astro.config.mjs](astro.config.mjs) and verify links, assets, and markdown-generated URLs.
2. If markdown link/media behavior changes, audit both custom plugins in src/lib and the markdown.processor config together.
3. If MEDIA_BASE_URL handling changes, preserve trailing-slash normalization unless you also update URL-join behavior in plugins.

## Commands

All commands run from project root.

- npm install: install dependencies
- npm run dev: start local dev server
- npm run build: build production output
- npm run preview: preview built site
- npm run astro -- --help: Astro CLI help
