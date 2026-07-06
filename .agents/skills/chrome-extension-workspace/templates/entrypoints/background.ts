import { RuntimeMessage } from '../src/shared/messaging/messages';

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
  });

  chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    const parsed = RuntimeMessage.safeParse(rawMessage);
    if (!parsed.success) {
      sendResponse({ ok: false, error: 'Invalid message' });
      return false;
    }

    const message = parsed.data;

    void (async () => {
      try {
        switch (message.type) {
          case 'site.detect':
            sendResponse({ ok: true, sender });
            break;
          case 'page.analyze':
            sendResponse({ ok: true, tabId: message.tabId });
            break;
        }
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();

    return true;
  });
});
