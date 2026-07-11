import { visit } from 'unist-util-visit';

const AUDIO_RE = /\.mp3(?:[?#].*)?$/i;
const VIDEO_RE = /\.mp4(?:[?#].*)?$/i;
const CAPTION_RE = /^(?:\^|caption:)\s*(.+)$/i;

function withLeadingSlash(value) {
  if (!value) return '/';
  return value.startsWith('/') ? value : `/${value}`;
}

function withTrailingSlash(value) {
  if (!value) return '/';
  return value.endsWith('/') ? value : `${value}/`;
}

function normalizeBasePath(basePath) {
  if (!basePath) return '/';
  return withTrailingSlash(withLeadingSlash(String(basePath).trim()));
}

function normalizeMediaUrl(url, basePath = '/') {
  const value = String(url || '').trim();
  if (!value) return value;

  // Leave absolute/protocol/hash URLs untouched.
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) {
    return value;
  }

  const basePrefix = normalizeBasePath(basePath);
  if (value.includes('_assets/')) {
    const parts = value.split('_assets/');
    const assetTail = parts[parts.length - 1];
    return `${basePrefix}_assets/${assetTail}`;
  }

  return value;
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getYouTubeId(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    return id || null;
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (parsed.pathname === '/watch') {
      return parsed.searchParams.get('v');
    }

    if (parsed.pathname.startsWith('/embed/')) {
      return parsed.pathname.split('/')[2] || null;
    }

    if (parsed.pathname.startsWith('/shorts/')) {
      return parsed.pathname.split('/')[2] || null;
    }
  }

  return null;
}

function toAudioHtml(url, basePath) {
  const safeUrl = escapeAttr(normalizeMediaUrl(url, basePath));
  return `<audio class="content-audio" controls preload="none" src="${safeUrl}"></audio>`;
}

function toVideoHtml(url, basePath) {
  const safeUrl = escapeAttr(normalizeMediaUrl(url, basePath));
  return `<video class="content-video" controls preload="metadata" playsinline><source src="${safeUrl}" type="video/mp4" /></video>`;
}

function toYouTubeHtml(videoId) {
  const safeId = escapeAttr(videoId);
  const embedUrl = `https://www.youtube.com/embed/${safeId}`;
  return `<div class="content-youtube"><iframe src="${embedUrl}" title="YouTube video player" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isWhitespaceText(node) {
  return node?.type === 'text' && !(node.value || '').trim();
}

function serializeInlineNodes(nodes) {
  return nodes.map((node) => {
    if (!node) return '';

    switch (node.type) {
      case 'text':
        return escapeHtml(node.value || '');
      case 'break':
        return '<br />';
      case 'inlineCode':
        return `<code>${escapeHtml(node.value || '')}</code>`;
      case 'emphasis':
        return `<em>${serializeInlineNodes(node.children || [])}</em>`;
      case 'strong':
        return `<strong>${serializeInlineNodes(node.children || [])}</strong>`;
      case 'delete':
        return `<del>${serializeInlineNodes(node.children || [])}</del>`;
      case 'link': {
        const href = escapeAttr(node.url || '');
        return `<a href="${href}">${serializeInlineNodes(node.children || [])}</a>`;
      }
      default:
        return '';
    }
  }).join('');
}

function stripCaptionMarkerFromInline(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;

  let start = 0;
  while (start < nodes.length && (nodes[start]?.type === 'break' || isWhitespaceText(nodes[start]))) {
    start += 1;
  }

  if (start >= nodes.length) return null;
  const first = nodes[start];
  if (first?.type !== 'text') return null;

  const raw = first.value || '';
  const match = raw.match(/^(?:\^|caption:)\s*/i);
  if (!match) return null;

  const cleaned = raw.slice(match[0].length);
  const cloned = nodes.slice(start).map((node, idx) => {
    if (idx === 0) {
      return { ...node, value: cleaned };
    }
    return node;
  });

  return cloned;
}

function getCaptionHtmlFromParagraph(node) {
  if (!node || node.type !== 'paragraph' || !Array.isArray(node.children)) return null;
  const stripped = stripCaptionMarkerFromInline(node.children);
  if (!stripped) return null;

  const html = serializeInlineNodes(stripped).trim();
  return html || null;
}

function toCaptionParagraphNode(sourceParagraph) {
  const stripped = stripCaptionMarkerFromInline(sourceParagraph?.children || []);
  if (!stripped) return null;

  return {
    type: 'paragraph',
    children: stripped,
    data: {
      hProperties: {
        className: ['content-caption'],
      },
    },
  };
}

function splitMediaAndSameParagraphCaption(node, basePath) {
  if (!node || node.type !== 'paragraph' || !Array.isArray(node.children) || node.children.length === 0) {
    return null;
  }

  const first = node.children[0];
  const rest = node.children.slice(1);

  let mediaHtml = null;
  let mediaKind = null;
  if (first.type === 'image') {
    mediaKind = 'image';
  } else if (first.type === 'link') {
    const url = (first.url || '').trim();
    if (!url) return null;

    const youtubeId = getYouTubeId(url);
    if (youtubeId) {
      mediaHtml = toYouTubeHtml(youtubeId);
      mediaKind = 'embed';
    } else if (AUDIO_RE.test(url)) {
      mediaHtml = toAudioHtml(url, basePath);
      mediaKind = 'embed';
    } else if (VIDEO_RE.test(url)) {
      mediaHtml = toVideoHtml(url, basePath);
      mediaKind = 'embed';
    }
  } else if (first.type === 'html') {
    if (
      first.value.includes('content-audio')
      || first.value.includes('content-video')
      || first.value.includes('content-youtube')
      || first.value.includes('<img')
    ) {
      mediaHtml = first.value;
      mediaKind = 'embed';
    }
  }

  if (!mediaKind) return null;

  const captionNodes = stripCaptionMarkerFromInline(rest);
  const captionHtml = captionNodes ? serializeInlineNodes(captionNodes).trim() : null;

  if (!captionHtml) return null;

  if (mediaKind === 'image') {
    return {
      mode: 'image-split',
      imageParagraph: {
        type: 'paragraph',
        children: [first],
      },
      captionParagraph: {
        type: 'paragraph',
        children: captionNodes,
        data: {
          hProperties: {
            className: ['content-caption'],
          },
        },
      },
    };
  }

  return { mode: 'embed-figure', mediaHtml, captionHtml };
}

function toMediaHtmlFromParagraph(node, basePath) {
  if (!node || node.type !== 'paragraph' || !Array.isArray(node.children)) return null;
  if (node.children.length !== 1) return null;

  const child = node.children[0];

  if (child.type === 'html') {
    if (
      child.value.includes('content-audio')
      || child.value.includes('content-video')
      || child.value.includes('content-youtube')
      || child.value.includes('<img')
    ) {
      return { mediaHtml: child.value, mediaType: child.type };
    }
    return null;
  }

  if (child.type !== 'link') return null;

  const url = (child.url || '').trim();
  if (!url) return null;

  const youtubeId = getYouTubeId(url);
  if (youtubeId) return { mediaHtml: toYouTubeHtml(youtubeId), mediaType: child.type };
  if (AUDIO_RE.test(url)) return { mediaHtml: toAudioHtml(url, basePath), mediaType: child.type };
  if (VIDEO_RE.test(url)) return { mediaHtml: toVideoHtml(url, basePath), mediaType: child.type };

  return null;
}

export function remarkMediaEmbeds(options = {}) {
  const basePath = normalizeBasePath(options.basePath || '/');

  return (tree) => {
    visit(tree, (node) => Array.isArray(node?.children), (parent) => {
      const children = parent.children;
      if (!Array.isArray(children) || children.length === 0) return;

      for (let i = 0; i < children.length; i++) {
        const current = children[i];

        // Image paragraph + following caption paragraph: keep image node native,
        // convert caption paragraph marker into styled caption paragraph.
        if (
          current?.type === 'paragraph'
          && Array.isArray(current.children)
          && current.children.length === 1
          && current.children[0]?.type === 'image'
        ) {
          const next = children[i + 1];
          const captionParagraph = toCaptionParagraphNode(next);
          if (captionParagraph) {
            children.splice(i + 1, 1, captionParagraph);
          }
        }

        const splitResult = splitMediaAndSameParagraphCaption(current, basePath);
        if (splitResult?.mode === 'image-split') {
          children.splice(i, 1, splitResult.imageParagraph, splitResult.captionParagraph);
          i += 1;
          continue;
        }

        if (splitResult?.mode === 'embed-figure') {
          const figureHtml = `<figure class="content-figure">${splitResult.mediaHtml}<figcaption>${splitResult.captionHtml}</figcaption></figure>`;
          children.splice(i, 1, { type: 'html', value: figureHtml });
          continue;
        }

        const mediaResult = toMediaHtmlFromParagraph(current, basePath);
        if (!mediaResult) continue;

        const next = children[i + 1];
        const captionHtml = getCaptionHtmlFromParagraph(next);

        if (captionHtml) {
          const figureHtml = `<figure class="content-figure">${mediaResult.mediaHtml}<figcaption>${captionHtml}</figcaption></figure>`;
          children.splice(i, 2, { type: 'html', value: figureHtml });
        } else if (current.type === 'paragraph' && current.children[0]?.type === 'link') {
          children[i] = { type: 'html', value: mediaResult.mediaHtml };
        }
      }
    });
  };
}
