import { detectActiveSiteWithAdapter } from '../src/sites/_registry';
import { bootCardView, claimCardViewRuntime, updateForRoute } from '../src/content/mount';
import { watchRouteChanges } from '../src/content/routeWatcher';

let routeDebounce: number | undefined;

export default defineContentScript({
  matches: ['https://linux.do/*'],
  runAt: 'document_idle',
  async main() {
    const detectedAt = new Date().toISOString();
    const activeSite = await detectActiveSiteWithAdapter();
    const detection = activeSite?.detection ?? null;
    const snapshot = activeSite ? await activeSite.adapter.extract() : null;

    document.documentElement.dataset.myExtensionReady = 'true';
    document.documentElement.dataset.myExtensionSite = detection?.siteId ?? 'unknown';
    document.documentElement.dataset.myExtensionPageType = detection?.pageType ?? 'unknown';
    document.documentElement.dataset.myExtensionLoggedIn = String(Boolean(detection?.loggedIn));

    document.documentElement.dataset.linuxdoReaderReady = 'true';
    document.documentElement.dataset.linuxdoReaderSite = detection?.siteId ?? 'unknown';
    document.documentElement.dataset.linuxdoReaderPageType = detection?.pageType ?? 'unknown';
    document.documentElement.dataset.linuxdoReaderLoggedIn = String(Boolean(detection?.loggedIn));

    await chrome.storage.local.set({
      'debug:lastSiteDetection': {
        detection,
        urlOrigin: window.location.origin,
        detectedAt,
      },
      'debug:lastPageSnapshot': snapshot
        ? {
            siteId: snapshot.siteId,
            pageType: snapshot.pageType,
            title: snapshot.title,
            url: snapshot.url,
            textLength: snapshot.text?.length ?? 0,
            metadata: snapshot.metadata ?? {},
            detectedAt,
          }
        : null,
    });

    if (claimCardViewRuntime()) {
      await bootCardView();
      
      // Magic Card Spotlight hover effect tracker
      document.addEventListener('mousemove', (e) => {
        const target = e.target as Element;
        const card = target.closest('.ldcv-card') as HTMLElement;
        if (card && !card.classList.contains('is-viewed') && !card.classList.contains('is-selected')) {
          const rect = card.getBoundingClientRect();
          card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
          card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
        }
      });

      watchRouteChanges(() => {
        window.clearTimeout(routeDebounce);
        routeDebounce = window.setTimeout(() => {
          void updateForRoute();
        }, 120);
      });
    }

    window.dispatchEvent(
      new CustomEvent('linuxdo-reader:ready', {
        detail: {
          siteId: detection?.siteId ?? 'unknown',
          pageType: detection?.pageType ?? 'unknown',
          loggedIn: Boolean(detection?.loggedIn),
          detectedAt,
        },
      }),
    );
  },
});
