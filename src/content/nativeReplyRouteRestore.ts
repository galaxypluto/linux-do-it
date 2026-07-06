export interface NativeReplyRouteGuard {
  topicId: number;
  returnUrl: string;
  expiresAt: number;
  restoreUntil: number;
  submitted: boolean;
}

export function nativeReplyReturnUrl(location: Pick<Location, "pathname" | "search" | "hash">): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function nativeReplyReturnRouteKey(returnUrl: string): string {
  const route = returnUrl.trim();
  if (!route) {
    return "";
  }
  if (!route.startsWith("/") && !/^https?:\/\//i.test(route)) {
    return "";
  }

  try {
    const parsed = new URL(route, "https://linux.do");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return route.startsWith("/") ? route.split("#", 1)[0] ?? "" : "";
  }
}

export function shouldIgnoreNativeReplyListRouteRefresh(
  guard: NativeReplyRouteGuard | null,
  currentRouteKey: string,
  activeRouteKey: string,
  now: number
): boolean {
  return Boolean(
    guard?.submitted &&
      now <= guard.restoreUntil &&
      currentRouteKey &&
      currentRouteKey === activeRouteKey &&
      nativeReplyReturnRouteKey(guard.returnUrl) === currentRouteKey
  );
}

export function topicIdFromTopicPathname(pathname: string): number | null {
  const match = pathname.match(/^\/t\/[^/]+\/(\d+)(?:\/\d+)?\/?$/);
  if (!match) {
    return null;
  }

  const topicId = Number(match[1]);
  return Number.isFinite(topicId) && topicId > 0 ? topicId : null;
}

export function postNumberFromTopicPathname(pathname: string, topicId: number): number | null {
  const match = pathname.match(/^\/t\/[^/]+\/(\d+)(?:\/(\d+))?\/?$/);
  if (!match) {
    return null;
  }

  const matchedTopicId = Number(match[1]);
  if (!Number.isFinite(matchedTopicId) || matchedTopicId !== topicId) {
    return null;
  }

  const postNumber = Number(match[2]);
  return Number.isFinite(postNumber) && postNumber > 0 ? postNumber : null;
}

export function isSameNativeReplyTopicRoute(pathname: string, topicId: number): boolean {
  return topicIdFromTopicPathname(pathname) === topicId;
}

export function shouldRestoreNativeReplyRoute(
  guard: NativeReplyRouteGuard | null,
  pathname: string,
  now: number
): guard is NativeReplyRouteGuard {
  return Boolean(
    guard &&
      now <= Math.max(guard.expiresAt, guard.restoreUntil) &&
      (guard.submitted || now <= guard.expiresAt) &&
      isSameNativeReplyTopicRoute(pathname, guard.topicId)
  );
}
