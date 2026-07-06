import { RuntimeMessage } from '../src/shared/messaging/messages';
import {
  normalizeReplyActivities,
  REPLY_ACTIVITY_LIMIT,
  REPLY_ACTIVITY_STORAGE_KEY,
  type ReplyActivity,
} from '../src/shared/replyActivity';

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    void chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true });
  });

  chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    const parsed = RuntimeMessage.safeParse(rawMessage);
    if (!parsed.success) {
      sendResponse({ ok: false, error: 'Invalid message' });
      return false;
    }

    void chrome.storage.local.set({
      'debug:lastRuntimeMessage': {
        type: parsed.data.type,
        senderTabId: sender.tab?.id ?? null,
        timestamp: new Date().toISOString(),
      },
    });

    switch (parsed.data.type) {
      case 'site.detect':
        sendResponse({ ok: true, senderTabId: sender.tab?.id ?? null });
        return false;
      case 'page.analyze':
        sendResponse({ ok: false, error: 'Page analysis is not implemented yet' });
        return false;
      case 'tab.open': {
        const url = linuxDoTabUrl(parsed.data.url);
        if (!url) {
          sendResponse({ ok: false, error: 'Unsupported tab URL' });
          return false;
        }

        const createProperties: chrome.tabs.CreateProperties = {
          active: parsed.data.active ?? false,
          url,
        };
        if (sender.tab?.id !== undefined) {
          createProperties.openerTabId = sender.tab.id;
        }

        chrome.tabs.create(createProperties, (tab) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            sendResponse({ ok: false, error: lastError.message || 'Failed to open tab' });
            return;
          }
          sendResponse({ ok: true, tabId: tab.id ?? null });
        });
        return true;
      }
      case 'reply.activity.record':
        void recordReplyActivity(parsed.data.activity)
          .then(() => sendResponse({ ok: true }))
          .catch((error: unknown) => {
            sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Failed to record reply activity' });
          });
        return true;
      default:
        sendResponse({ ok: false, error: 'Unsupported message' });
        return false;
    }
  });
});

function linuxDoTabUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'linux.do' ||
      (!url.pathname.startsWith('/n/') && !url.pathname.startsWith('/t/'))
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

async function recordReplyActivity(activity: ReplyActivity): Promise<void> {
  const storage = await chrome.storage.local.get([REPLY_ACTIVITY_STORAGE_KEY]);
  const current = normalizeReplyActivities(storage[REPLY_ACTIVITY_STORAGE_KEY]);
  const next = [activity, ...current.filter((item) => item.id !== activity.id)].slice(0, REPLY_ACTIVITY_LIMIT);
  await chrome.storage.local.set({
    [REPLY_ACTIVITY_STORAGE_KEY]: next,
    'debug:lastReplyActivity': activity,
  });
}
