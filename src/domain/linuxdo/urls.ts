const DEFAULT_ORIGIN = 'https://linux.do';

export type TopicUrlView = 'classic' | 'nested';

export function linuxDoAbsoluteUrl(pathOrUrl: string, origin = DEFAULT_ORIGIN): string {
  const value = pathOrUrl.trim();
  if (!value) {
    return origin;
  }

  return new URL(value, origin).toString();
}

export function linuxDoClassicTopicPath(slug: string | null | undefined, topicId: number, postNumber?: number | null): string {
  const safeSlug = safePathSegment(slug || 'topic');
  const safeTopicId = Number.isFinite(topicId) && topicId > 0 ? Math.floor(topicId) : 0;
  const base = `/t/${safeSlug}/${safeTopicId}`;
  const safePostNumber = Number.isFinite(postNumber) && postNumber && postNumber > 0 ? Math.floor(postNumber) : null;
  return safePostNumber ? `${base}/${safePostNumber}` : base;
}

export function linuxDoNestedTopicPath(slug: string | null | undefined, topicId: number, postNumber?: number | null): string {
  const safeSlug = safePathSegment(slug || 'topic');
  const safeTopicId = Number.isFinite(topicId) && topicId > 0 ? Math.floor(topicId) : 0;
  const base = `/n/${safeSlug}/${safeTopicId}`;
  const safePostNumber = Number.isFinite(postNumber) && postNumber && postNumber > 0 ? Math.floor(postNumber) : null;
  return safePostNumber ? `${base}/${safePostNumber}` : base;
}

export function linuxDoClassicTopicUrl(pathOrUrl: string, origin = DEFAULT_ORIGIN): string {
  const value = pathOrUrl.trim();
  if (!value) {
    return value;
  }

  const absolute = /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//');
  try {
    const url = new URL(value, origin);
    if (!url.pathname.startsWith('/n/')) {
      return value;
    }
    url.pathname = `/t/${url.pathname.slice(3)}`;
    return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value.replace(/^((?:https?:)?\/\/[^/]+)?\/n\//, '$1/t/');
  }
}

export function linuxDoNestedTopicUrl(pathOrUrl: string, origin = DEFAULT_ORIGIN): string {
  const value = pathOrUrl.trim();
  if (!value) {
    return value;
  }

  const absolute = /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//');
  try {
    const url = new URL(value, origin);
    if (!url.pathname.startsWith('/t/')) {
      return value;
    }
    url.pathname = `/n/${url.pathname.slice(3)}`;
    return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value.replace(/^((?:https?:)?\/\/[^/]+)?\/t\//, '$1/n/');
  }
}

export function linuxDoPreferredTopicUrl(pathOrUrl: string, view: TopicUrlView, origin = DEFAULT_ORIGIN): string {
  return view === 'nested' ? linuxDoNestedTopicUrl(pathOrUrl, origin) : linuxDoClassicTopicUrl(pathOrUrl, origin);
}

function safePathSegment(segment: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}
