function normalizeMediaBaseUrl() {
  return String(process.env.MEDIA_BASE_URL || '').trim().replace(/\/+$/, '');
}

export function resolveMediaUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;

  const value = String(url).trim();
  if (!value) return undefined;

  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) {
    return value;
  }

  const mediaBaseUrl = normalizeMediaBaseUrl();
  if (!mediaBaseUrl || !value.includes('_assets/')) {
    return value;
  }

  const assetTail = value.split('_assets/').pop();
  if (!assetTail) return value;

  return `${mediaBaseUrl}/${assetTail}`;
}