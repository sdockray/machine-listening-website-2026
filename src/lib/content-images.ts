export function extractFirstMarkdownImage(markdown: string): string | undefined {
  for (let i = 0; i < markdown.length - 3; i++) {
    if (markdown[i] !== '!' || markdown[i + 1] !== '[') continue;

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

    const trimmed = url.trim();
    if (!trimmed) continue;

    // Support the optional angle-bracket URL form: ![alt](<url>)
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      return trimmed.slice(1, -1).trim();
    }

    // Support optional title syntax: ![alt](url "title")
    const withTitle = trimmed.match(/^([^\s]+)\s+["'][^"']+["']\s*$/);
    if (withTitle) {
      return withTitle[1];
    }

    return trimmed;
  }

  return undefined;
}
