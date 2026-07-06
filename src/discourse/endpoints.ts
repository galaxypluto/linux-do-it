const LIST_ROUTE_PATTERNS = [
  /^\/$/,
  /^\/latest\/?$/,
  /^\/new\/?$/,
  /^\/unseen\/?$/,
  /^\/unread\/?$/,
  /^\/hot\/?$/,
  /^\/top(?:\/[^/]+)?\/?$/,
  /^\/posted\/?$/,
  /^\/bookmarks\/?$/,
  /^\/c(?:\/.*)?$/,
  /^\/tag(?:\/[^/]+)?\/?$/,
  /^\/tags\/?$/
];

export function isTopicListRoute(pathname = window.location.pathname): boolean {
  return LIST_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function endpointForCurrentRoute(location = window.location): string {
  const path = stripTrailingSlash(location.pathname);
  const search = new URLSearchParams(location.search);

  if (path === "" || path === "/latest") {
    return withPage("/latest.json", search);
  }

  if (path === "/new") {
    return withPage("/new.json", search);
  }

  if (path === "/unseen") {
    return withPage("/unseen.json", search);
  }

  if (path === "/unread") {
    return withPage("/unread.json", search);
  }

  if (path === "/hot") {
    return withPage("/hot.json", search);
  }

  if (path === "/top") {
    return withPage("/top.json", search);
  }

  if (path === "/posted") {
    return withPage("/posted.json", search);
  }

  if (path === "/bookmarks") {
    return withPage("/bookmarks.json", search);
  }

  const topPeriod = path.match(/^\/top\/([^/]+)$/);
  if (topPeriod) {
    search.set("period", topPeriod[1]);
    return withPage("/top.json", search);
  }

  if (path === "/tags" || path === "/tag") {
    return withPage("/tags.json", search);
  }

  const tag = path.match(/^\/tag\/([^/]+)$/);
  if (tag) {
    return withPage(`/tag/${normalizePathSegment(tag[1])}.json`, search);
  }

  if (path === "/c") {
    return withPage("/categories.json", search);
  }

  if (path.startsWith("/c/")) {
    return withPage(`${path}.json`, search);
  }

  return withPage("/latest.json", search);
}

function stripTrailingSlash(pathname: string): string {
  if (pathname === "/") {
    return "";
  }
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function withPage(endpoint: string, search: URLSearchParams): string {
  const params = new URLSearchParams();
  if (endpoint === "/top.json") {
    const period = search.get("period");
    if (period) {
      params.set("period", period);
    }
  }

  const page = search.get("page");
  if (page) {
    params.set("page", page);
  }

  const query = params.toString();
  return query ? `${endpoint}?${query}` : endpoint;
}

function normalizePathSegment(segment: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(segment));
  } catch {
    return encodeURIComponent(segment);
  }
}
