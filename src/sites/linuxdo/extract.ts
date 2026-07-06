import type { PageSnapshot } from '../../ports/SitePort';
import { endpointForLinuxDoRoute, isLinuxDoTopicListRoute } from '../../domain/linuxdo/routes';
import { detect } from './detect';
import { siteManifest } from './manifest';
import { selectors } from './selectors';

export function extract(): PageSnapshot {
  const detection = detect();
  const location = new URL(window.location.href);
  const isTopicListRoute = isLinuxDoTopicListRoute(location.pathname);
  const content = document.querySelector(selectors.primaryContent)?.textContent?.trim() ?? '';

  return {
    siteId: siteManifest.id,
    pageType: detection.pageType,
    title: document.title,
    url: window.location.href,
    text: content.slice(0, 20_000),
    metadata: {
      loggedIn: detection.loggedIn,
      confidence: detection.confidence,
      pathname: location.pathname,
      endpoint: isTopicListRoute
        ? endpointForLinuxDoRoute({ pathname: location.pathname, search: location.search })
        : null,
    },
  };
}
