import { detectActiveSite } from '../src/sites/_registry';

export default defineContentScript({
  matches: ['https://example.com/*'],
  async main() {
    const detection = await detectActiveSite();

    document.documentElement.dataset.myExtensionReady = 'true';
    document.documentElement.dataset.myExtensionSite = detection?.siteId ?? 'unknown';
    document.documentElement.dataset.myExtensionPageType = detection?.pageType ?? 'unknown';
    document.documentElement.dataset.myExtensionLoggedIn = String(Boolean(detection?.loggedIn));

    window.dispatchEvent(
      new CustomEvent('my-extension:ready', {
        detail: {
          siteId: detection?.siteId ?? 'unknown',
          pageType: detection?.pageType ?? 'unknown',
          loggedIn: Boolean(detection?.loggedIn),
        },
      }),
    );
  },
});
