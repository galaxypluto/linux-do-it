import type { PageSnapshot } from '../../ports/SitePort';
import { siteManifest } from './manifest';
import { selectors } from './selectors';
import { detect } from './detect';

export function extract(): PageSnapshot {
  const detection = detect();
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
    },
  };
}
