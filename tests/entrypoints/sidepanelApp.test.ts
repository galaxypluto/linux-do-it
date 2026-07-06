import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Button,
  hasMoreSearchResults,
  mergeSearchTopics,
  openTopicInTabWithRetry,
  resolveLinuxDoTab,
  searchTopicsInTab,
  sendSidePanelContentMessage,
} from '../../entrypoints/sidepanel/App';

describe('sidepanel search app helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('allows the search action button to submit its parent form', () => {
    const element = Button({
      children: '搜索',
      type: 'submit',
      variant: 'primary',
    });

    expect(element.props.type).toBe('submit');
  });

  it('sends typed messages to the Linux.do content script', async () => {
    const sendMessage = vi.fn((_tabId: number, _message: unknown, callback: (response: unknown) => void) => {
      callback({ ok: true, data: { topics: [] } });
    });
    vi.stubGlobal('chrome', {
      runtime: {
        lastError: undefined,
      },
      tabs: {
        sendMessage,
      },
    });

    await expect(
      sendSidePanelContentMessage(12, {
        type: 'ldcv.searchTopics',
        query: 'reader',
        page: 2,
      }),
    ).resolves.toEqual({ ok: true, data: { topics: [] } });

    expect(sendMessage).toHaveBeenCalledWith(
      12,
      {
        type: 'ldcv.searchTopics',
        query: 'reader',
        page: 2,
      },
      expect.any(Function),
    );
  });

  it('converts content-script messaging failures into structured errors', async () => {
    const sendMessage = vi.fn((_tabId: number, _message: unknown, callback: (response: unknown) => void) => {
      callback(undefined);
    });
    vi.stubGlobal('chrome', {
      runtime: {
        lastError: { message: 'Receiving end does not exist' },
      },
      tabs: {
        sendMessage,
      },
    });

    await expect(
      sendSidePanelContentMessage(12, {
        type: 'ldcv.searchTopics',
        query: 'reader',
      }),
    ).resolves.toEqual({ ok: false, error: 'Receiving end does not exist' });
  });

  it('passes the requested search page through the content-script message', async () => {
    const sendMessage = vi.fn((_tabId: number, _message: unknown, callback: (response: unknown) => void) => {
      callback({ ok: true, data: { topics: [], grouped_search_result: { more_full_page_results: false } } });
    });
    vi.stubGlobal('chrome', {
      runtime: {
        lastError: undefined,
      },
      tabs: {
        sendMessage,
      },
    });

    await expect(searchTopicsInTab(12, 'reader', 3)).resolves.toEqual({
      topics: [],
      grouped_search_result: { more_full_page_results: false },
    });

    expect(sendMessage).toHaveBeenCalledWith(
      12,
      {
        type: 'ldcv.searchTopics',
        query: 'reader',
        page: 3,
      },
      expect.any(Function),
    );
  });

  it('detects whether Discourse search returned more full-page results', () => {
    expect(hasMoreSearchResults({ grouped_search_result: { more_full_page_results: true } })).toBe(true);
    expect(hasMoreSearchResults({ grouped_search_result: { more_full_page_results: false } })).toBe(false);
  });

  it('falls back to page-size inference when Discourse omits explicit more-results flags', () => {
    expect(hasMoreSearchResults({ topics: Array.from({ length: 50 }, (_, id) => ({ id: id + 1 })) as never })).toBe(true);
    expect(hasMoreSearchResults({ topics: [{ id: 1 }] as never })).toBe(false);
  });

  it('appends only new topics while preserving existing order', () => {
    const current = [{ id: 1, title: 'one' }, { id: 2, title: 'two' }] as never;
    const incoming = [{ id: 2, title: 'two again' }, { id: 3, title: 'three' }] as never;

    expect(mergeSearchTopics(current, incoming).map((topic) => topic.id)).toEqual([1, 2, 3]);
  });

  it('prefers the active Linux.do tab over other open forum tabs', async () => {
    const activeTab = { id: 7, url: 'https://linux.do/latest' };
    const backgroundTab = { id: 3, url: 'https://linux.do/posted' };
    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn(async (query: { active?: boolean; currentWindow?: boolean; url?: string }) => {
          if (query.active && query.currentWindow) {
            return [activeTab];
          }
          if (query.url === '*://linux.do/*') {
            return [backgroundTab, activeTab];
          }
          return [];
        }),
      },
    });

    await expect(resolveLinuxDoTab()).resolves.toBe(activeTab);
  });

  it('retries topic-open messages until the content script is ready', async () => {
    const sendMessage = vi
      .fn()
      .mockImplementationOnce((_tabId: number, _message: unknown, callback: (response: unknown) => void) => {
        callback({ ok: false, error: 'Receiving end does not exist' });
      })
      .mockImplementationOnce((_tabId: number, _message: unknown, callback: (response: unknown) => void) => {
        callback({ ok: true });
      });
    vi.stubGlobal('chrome', {
      runtime: {
        lastError: undefined,
      },
      tabs: {
        sendMessage,
      },
    });

    const topic = {
      id: 10,
      title: 'Reader topic',
      url: '/n/reader-topic/10',
      slug: 'reader-topic',
      excerpt: '',
      thumbnailUrl: '',
      tags: [],
      stats: { replies: 0, views: 0, likes: 0, score: 0 },
      dates: { createdAt: '2026-05-01T00:00:00.000Z', activityAt: '2026-05-02T00:00:00.000Z' },
      flags: {
        pinned: false,
        closed: false,
        archived: false,
        bookmarked: false,
        unseen: false,
      },
      posters: [],
    };

    await expect(openTopicInTabWithRetry(12, topic, { attempts: 2, delayMs: 0 })).resolves.toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});
