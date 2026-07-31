function normalizeMediaBaseUrl() {
  return String(process.env.MEDIA_BASE_URL || '').trim().replace(/\/+$/, '');
}

function encodePathSegments(pathStr: string): string {
  if (!pathStr) return pathStr;
  return pathStr
    .split('/')
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');
}

export function resolveMediaUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;

  const value = String(url).trim();
  if (!value) return undefined;

  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) {
    return value;
  }

  const mediaBaseUrl = normalizeMediaBaseUrl();
  if (!mediaBaseUrl || (!value.includes('_assets/') && !value.includes('/assets/'))) {
    return value;
  }

  const assetTail = value.split(/_?assets\//).pop();
  if (!assetTail) return value;

  return `${mediaBaseUrl}/${encodePathSegments(assetTail)}`;
}