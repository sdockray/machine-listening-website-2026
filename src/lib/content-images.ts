const IMAGE_EXT_RE = /\.(jpe?g|png|gif|svg|webp|avif|bmp|tiff)$/i;

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

