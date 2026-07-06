import React from 'react';
import { FetchHttpAdapter } from '../../src/adapters/browser/FetchHttpAdapter';
import { BrowserSessionCacheAdapter } from '../../src/adapters/browser/BrowserSessionCacheAdapter';
import { LinuxDoApiService } from '../../src/application/services/LinuxDoApiService';
import { linuxDoAbsoluteUrl } from '../../src/domain/linuxdo/urls';
import { normalizeSearchTopics } from '../../src/domain/linuxdo/normalize';
import { relativeTime, formatPublishTime, compactNumber } from '../../src/ui/format';
import type { DiscourseSearchResponse, TopicCardData } from '../../src/domain/linuxdo/types';
import {
  SidePanelContentMessage,
  SidePanelContentResponse,
  type SidePanelContentMessage as SidePanelContentMessageData,
  type SidePanelContentResponse as SidePanelContentResponseData,
} from '../../src/shared/messaging/messages';
import './style.css';

const ReplyIcon = () => (
  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 5.75A2.75 2.75 0 0 1 7.75 3h8.5A2.75 2.75 0 0 1 19 5.75v6.5A2.75 2.75 0 0 1 16.25 15H11l-4.06 3.25A.75.75 0 0 1 5.75 17v-2.1A2.75 2.75 0 0 1 3 12.25v-6.5Z"/>
  </svg>
);

const EyeIcon = () => (
  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5c5.2 0 8.5 5.1 8.64 5.32a1.25 1.25 0 0 1 0 1.36C20.5 11.9 17.2 17 12 17s-8.5-5.1-8.64-5.32a1.25 1.25 0 0 1 0-1.36C3.5 10.1 6.8 5 12 5Zm0 1.5c-3.85 0-6.57 3.48-7.18 4.5.61 1.02 3.33 4.5 7.18 4.5s6.57-3.48 7.18-4.5C18.57 9.98 15.85 6.5 12 6.5Zm0 1.75a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5Z"/>
  </svg>
);

const HeartIcon = () => (
  <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 20.1 10.9 19C6.4 14.9 3.5 12.25 3.5 8.95A4.73 4.73 0 0 1 8.25 4.2c1.47 0 2.88.68 3.75 1.74a5.02 5.02 0 0 1 3.75-1.74 4.73 4.73 0 0 1 4.75 4.75c0 3.3-2.9 5.95-7.4 10.05L12 20.1Z"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="h-3.5 w-3.5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

type SiteDetectionDebug = {
  detection?: {
    siteId: string;
    loggedIn: boolean;
    pageType: string;
    confidence: number;
    reason?: string;
  } | null;
  detectedAt?: string;
  urlOrigin?: string;
};

type PageSnapshotDebug = {
  siteId: string;
  pageType: string;
  title: string;
  url: string;
  textLength: number;
  metadata?: {
    loggedIn?: boolean;
    confidence?: number;
    pathname?: string;
    endpoint?: unknown;
  };
  detectedAt?: string;
};

type PanelStorageDebug = {
  siteDetection: SiteDetectionDebug | null;
  pageSnapshot: PageSnapshotDebug | null;
};

type LoadState<T> =
  | { status: 'idle'; data: T | null; error: '' }
  | { status: 'loading'; data: T | null; error: '' }
  | { status: 'loaded'; data: T; error: '' }
  | { status: 'error'; data: T | null; error: string };

const emptySearchState: LoadState<TopicCardData[]> = { status: 'idle', data: null, error: '' };
const SEARCH_PAGE_SIZE_FALLBACK = 50;

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]';
const primaryButton = `${focusRing} inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-zinc-950 px-4 text-xs font-bold text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:bg-zinc-800 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200`;
const secondaryButton = `${focusRing} inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--surface-strong)] px-3 text-xs font-bold text-zinc-800 shadow-sm transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:border-cyan-300 hover:text-cyan-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 dark:text-zinc-100 dark:hover:border-cyan-500 dark:hover:text-cyan-200`;
const linkButton = `${focusRing} inline-flex shrink-0 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-xs font-bold leading-none text-cyan-800 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:border-cyan-300 hover:bg-cyan-100 active:scale-[0.98] dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:border-cyan-600`;
const mutedText = 'text-xs leading-5 text-zinc-500 dark:text-zinc-400';

function classNames(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

async function loadPanelStorageDebug(): Promise<PanelStorageDebug> {
  const storage = await chrome.storage.local.get(['debug:lastSiteDetection', 'debug:lastPageSnapshot']);
  return {
    siteDetection: (storage['debug:lastSiteDetection'] as SiteDetectionDebug | undefined) ?? null,
    pageSnapshot: (storage['debug:lastPageSnapshot'] as PageSnapshotDebug | undefined) ?? null,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function hasMoreSearchResults(response: DiscourseSearchResponse): boolean {
  const grouped = response.grouped_search_result;
  if (typeof grouped?.more_full_page_results === 'boolean') {
    return grouped.more_full_page_results;
  }
  if (typeof grouped?.more_posts === 'boolean') {
    return grouped.more_posts;
  }
  return (response.topics?.length ?? 0) >= SEARCH_PAGE_SIZE_FALLBACK || (response.posts?.length ?? 0) >= SEARCH_PAGE_SIZE_FALLBACK;
}

export function mergeSearchTopics(current: TopicCardData[], incoming: TopicCardData[]): TopicCardData[] {
  const seen = new Set(current.map((topic) => topic.id));
  const merged = [...current];
  for (const topic of incoming) {
    if (!seen.has(topic.id)) {
      seen.add(topic.id);
      merged.push(topic);
    }
  }
  return merged;
}

export function sendSidePanelContentMessage(
  tabId: number,
  message: SidePanelContentMessageData,
): Promise<SidePanelContentResponseData> {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (rawResponse: unknown) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          resolve({ ok: false, error: lastError.message || '无法与网页建立通信' });
          return;
        }

        const parsed = SidePanelContentResponse.safeParse(rawResponse);
        if (!parsed.success) {
          resolve({ ok: false, error: '网页返回了无效响应' });
          return;
        }

        resolve(parsed.data);
      });
    } catch (error) {
      resolve({ ok: false, error: errorMessage(error) });
    }
  });
}

export async function searchTopicsInTab(tabId: number, query: string, page = 1): Promise<DiscourseSearchResponse> {
  const response = await sendSidePanelContentMessage(
    tabId,
    SidePanelContentMessage.parse({
      type: 'ldcv.searchTopics',
      query,
      page,
    }),
  );
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.data as DiscourseSearchResponse;
}

export async function openTopicInContentTab(tabId: number, topic: TopicCardData): Promise<boolean> {
  const response = await sendSidePanelContentMessage(
    tabId,
    SidePanelContentMessage.parse({
      type: 'ldcv.openTopic',
      topicId: topic.id,
      topic,
    }),
  );
  return response.ok;
}

export async function resolveLinuxDoTab(): Promise<chrome.tabs.Tab | null> {
  const [activeTabs, linuxDoTabs] = await Promise.all([
    chrome.tabs.query({ active: true, currentWindow: true }),
    chrome.tabs.query({ url: '*://linux.do/*' }),
  ]);

  const activeTab = activeTabs[0];
  if (activeTab?.id && activeTab.url?.startsWith('https://linux.do')) {
    return activeTab;
  }

  const fallbackTab = linuxDoTabs[0];
  return fallbackTab?.id ? fallbackTab : null;
}

export async function requireLinuxDoTab(): Promise<chrome.tabs.Tab> {
  const tab = await resolveLinuxDoTab();
  if (!tab?.id) {
    throw new Error('未检测到活动的 Linux.do 页面。为了以已登录身份执行请求，请点击下方按钮或在新窗口中打开论坛。');
  }
  return tab;
}

export async function openTopicInTabWithRetry(
  tabId: number,
  topic: TopicCardData,
  { attempts = 5, delayMs = 300 }: { attempts?: number; delayMs?: number } = {},
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const opened = await openTopicInContentTab(tabId, topic);
    if (opened) {
      return true;
    }
    if (attempt < attempts - 1) {
      await delay(delayMs);
    }
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function waitForTabComplete(tabId: number, timeoutMs = 6000): Promise<boolean> {
  return new Promise((resolve) => {
    let timer: number | undefined;
    const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        finish(true);
      }
    };
    function finish(value: boolean) {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(value);
    }
    timer = window.setTimeout(() => finish(false), timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

export default function SidePanelApp() {
  const api = React.useMemo(
    () =>
      new LinuxDoApiService({
        http: new FetchHttpAdapter(),
        cache: new BrowserSessionCacheAdapter(),
        origin: 'https://linux.do',
        useAbsoluteUrls: true,
      }),
    [],
  );

  const [debug, setDebug] = React.useState<PanelStorageDebug>({
    siteDetection: null,
    pageSnapshot: null,
  });
  const [query, setQuery] = React.useState('');
  const [searchState, setSearchState] = React.useState<LoadState<TopicCardData[]>>(emptySearchState);
  const [activeSearchQuery, setActiveSearchQuery] = React.useState('');
  const [nextSearchPage, setNextSearchPage] = React.useState(1);
  const [hasMoreResults, setHasMoreResults] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [loadMoreError, setLoadMoreError] = React.useState('');
  const [isOpening, setIsOpening] = React.useState<number | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const lastSearchTimeRef = React.useRef(0);
  const searchRequestIdRef = React.useRef(0);
  const loadMoreInFlightRef = React.useRef(false);
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null);

  const detection = debug.siteDetection?.detection;
  const pageType = detection?.pageType ?? debug.pageSnapshot?.pageType ?? 'unknown';
  const pathname = debug.pageSnapshot?.metadata?.pathname ?? '/';

  const refreshPageState = React.useCallback(() => {
    void loadPanelStorageDebug().then(setDebug);
  }, []);

  const refreshAll = React.useCallback(() => {
    refreshPageState();
  }, [refreshPageState]);

  React.useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Periodically query tab list to check connection with linux.do content scripts
  React.useEffect(() => {
    const checkConnection = async () => {
      try {
        const tabs = await chrome.tabs.query({ url: '*://linux.do/*' });
        setIsConnected(tabs.length > 0);
      } catch {
        setIsConnected(false);
      }
    };
    void checkConnection();
    const timer = setInterval(checkConnection, 1500);
    return () => clearInterval(timer);
  }, []);

  const fetchSearchPage = React.useCallback(
    async (searchQuery: string, page: number): Promise<{ topics: TopicCardData[]; hasMore: boolean }> => {
      const targetTab = await requireLinuxDoTab();
      const responseData = await searchTopicsInTab(targetTab.id!, searchQuery, page);
      try {
        await api.hydrateCategoryMetadata(responseData);
      } catch {
        // Category metadata is optional; search results can still render without it.
      }

      return {
        topics: normalizeSearchTopics(responseData, { origin: 'https://linux.do' }),
        hasMore: hasMoreSearchResults(responseData),
      };
    },
    [api],
  );

  const handleSearch = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    // Rate Limit check (2000ms cooldown)
    const now = Date.now();
    if (now - lastSearchTimeRef.current < 2000) {
      setSearchState({
        status: 'error',
        data: null,
        error: '您的搜索请求过于频繁！请稍候再试（限制 2 秒/次），以保护您的 IP 免遭论坛限频拦截哦~'
      });
      return;
    }

    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;
    setActiveSearchQuery(trimmed);
    setNextSearchPage(1);
    setHasMoreResults(false);
    loadMoreInFlightRef.current = false;
    setIsLoadingMore(false);
    setLoadMoreError('');
    setSearchState({ status: 'loading', data: null, error: '' });

    try {
      const result = await fetchSearchPage(trimmed, 1);
      if (searchRequestIdRef.current !== requestId) {
        return;
      }
      lastSearchTimeRef.current = Date.now();
      setNextSearchPage(2);
      setHasMoreResults(result.hasMore && result.topics.length > 0);
      setSearchState({ status: 'loaded', data: result.topics, error: '' });
    } catch (err) {
      if (searchRequestIdRef.current !== requestId) {
        return;
      }
      setSearchState({ status: 'error', data: null, error: errorMessage(err) });
    }
  }, [fetchSearchPage, query]);

  const loadMoreSearchResults = React.useCallback(async () => {
    if (
      loadMoreInFlightRef.current ||
      !activeSearchQuery ||
      searchState.status !== 'loaded' ||
      isLoadingMore ||
      !hasMoreResults
    ) {
      return;
    }

    const page = nextSearchPage;
    loadMoreInFlightRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError('');

    try {
      const result = await fetchSearchPage(activeSearchQuery, page);
      setSearchState((state) => {
        if (state.status !== 'loaded') {
          return state;
        }
        return {
          status: 'loaded',
          data: mergeSearchTopics(state.data, result.topics),
          error: '',
        };
      });
      setNextSearchPage(page + 1);
      setHasMoreResults(result.hasMore && result.topics.length > 0);
    } catch (err) {
      setLoadMoreError(errorMessage(err));
    } finally {
      loadMoreInFlightRef.current = false;
      setIsLoadingMore(false);
    }
  }, [activeSearchQuery, fetchSearchPage, hasMoreResults, isLoadingMore, nextSearchPage, searchState.status]);

  React.useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || searchState.status !== 'loaded' || !searchState.data.length || !hasMoreResults || isLoadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreSearchResults();
        }
      },
      { root: null, rootMargin: '240px 0px', threshold: 0.01 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreResults, isLoadingMore, loadMoreSearchResults, searchState]);

  const openNativeUrl = React.useCallback((pathOrUrl: string) => {
    void chrome.tabs.create({ url: linuxDoAbsoluteUrl(pathOrUrl) });
  }, []);

  const openTopicInPage = React.useCallback(async (topic: TopicCardData) => {
    setIsOpening(topic.id);
    try {
      let targetTab = await resolveLinuxDoTab();

      if (!targetTab?.id) {
        const newTab = await chrome.tabs.create({ url: 'https://linux.do/latest' });
        if (newTab.id === undefined || !(await waitForTabComplete(newTab.id))) {
          openNativeUrl(topic.url);
          return;
        }
        targetTab = newTab;
      } else {
        const [activeTabs] = await Promise.all([chrome.tabs.query({ active: true, currentWindow: true })]);
        const activeTab = activeTabs[0];
        if (activeTab?.id !== targetTab.id) {
          await chrome.tabs.update(targetTab.id, { active: true });
          await delay(300);
        }
      }

      const tabId = targetTab.id;
      if (tabId === undefined) {
        openNativeUrl(topic.url);
        return;
      }

      const opened = await openTopicInTabWithRetry(tabId, topic);
      if (!opened) {
        openNativeUrl(topic.url);
      }
    } catch (err) {
      openNativeUrl(topic.url);
    } finally {
      // Small timeout to show active click feedback
      setTimeout(() => {
        setIsOpening(null);
      }, 500);
    }
  }, [openNativeUrl]);

  return (
    <main
      className="min-h-screen bg-[var(--bg-base)] p-3.5 font-sans text-[var(--text-base)] antialiased sm:p-4 animate-fade-in-slide"
    >
      <header className="surface-strong mb-3 flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase text-[var(--accent)]">Search Enhancer</p>
          <h1 className="mt-1 text-lg font-extrabold leading-tight text-zinc-950 dark:text-zinc-50">Linux.do 搜索增强</h1>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className={classNames(
              "inline-block h-2 w-2 rounded-full",
              isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" : "bg-rose-500"
            )} />
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
              {isConnected ? "已安全连接论坛环境" : "未检测到活跃论坛网页"}
            </span>
          </div>
        </div>
        <Button variant="secondary" onClick={refreshAll}>
          Refresh
        </Button>
      </header>

      <section className="mb-3 flex flex-wrap gap-1.5" aria-label="Current page">
        <StatusChip>{pageType}</StatusChip>
        <StatusChip tone={detection?.loggedIn ? 'success' : detection ? 'warning' : 'default'}>
          {detection?.loggedIn ? 'logged in' : detection ? 'guest' : 'unknown login'}
        </StatusChip>
        <StatusChip tone="path">{pathname}</StatusChip>
      </section>

      {/* Premium Search Panel (Sticky) */}
      <div className="sticky top-0 z-20 bg-[var(--bg-base)] pb-3">
        <PanelFrame className="mb-0" ariaLabel="Search Options">
          <form onSubmit={handleSearch} className="flex flex-col gap-2.5">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="在 Linux.do 中搜索话题..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full h-9 rounded-md border border-[var(--border-color)] bg-[var(--surface-strong)] pl-8 pr-3 text-xs font-medium text-zinc-900 transition-colors focus:border-[var(--accent)] focus:outline-none dark:text-zinc-100"
                />
                <span className="absolute left-2.5 top-2.5 text-zinc-400 dark:text-zinc-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
              </div>
              <Button variant="primary" type="submit" disabled={searchState.status === 'loading'}>
                {searchState.status === 'loading' ? '搜索中' : '搜索'}
              </Button>
            </div>
            {query.trim() && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => openNativeUrl(`/search?expanded=true&q=${encodeURIComponent(query)}`)}
                  className="text-[10px] font-bold text-[var(--accent)] hover:text-[var(--accent-hover)]"
                >
                  在论坛原生页面中搜索 ↗
                </button>
              </div>
            )}
          </form>
        </PanelFrame>
      </div>

      {/* Search Result Hub */}
      <section className="min-w-0" aria-label="Search results">
        <SectionHeader title="搜索结果" count={searchState.data?.length ?? 0} />

        {searchState.status === 'idle' && (
          <StateBlock
            title="开始搜索"
            description="在上方输入关键词搜索 Linux.do 话题。支持 native 过滤器（如 user:username 等）。"
            compact
          />
        )}

        {searchState.status === 'loading' && (
          <div className="grid gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="surface-item h-24 w-full animate-pulse p-4">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4 mb-3" />
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2 mb-2" />
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
              </div>
            ))}
          </div>
        )}

        {searchState.status === 'error' && (
          <StateBlock
            title="搜索出错"
            description={searchState.error}
            tone="error"
            compact
          />
        )}

        {searchState.status === 'loaded' && !searchState.data.length && (
          <StateBlock
            title="无相关结果"
            description="没有找到匹配的话题，请尝试更换关键词。"
            compact
          />
        )}

        {searchState.status === 'loaded' && searchState.data.length > 0 && (
          <>
            <div className="grid gap-2">
              {searchState.data.map((topic) => {
                const isNsfw = topic.tags?.some(tag => tag.toLowerCase() === 'nsfw') ?? false;
                const categoryColorStyle = topic.category
                  ? {
                      backgroundColor: `#${topic.category.color}15`,
                      color: `#${topic.category.color}`,
                      borderColor: `#${topic.category.color}30`,
                    }
                  : undefined;

                return (
                  <div
                    key={topic.id}
                    className={classNames(
                      'group relative surface-item flex flex-col w-full gap-2 p-4 text-left animate-fade-in-slide hover:border-[var(--accent)]/50',
                      isOpening === topic.id ? 'is-selected' : '',
                    )}
                  >
                    {/* Card Click Action Area */}
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => openTopicInPage(topic)}
                      disabled={isOpening === topic.id}
                    >
                      <div className={classNames(
                        "transition-all duration-500",
                        isNsfw ? "blur-md opacity-25 group-hover:blur-none group-hover:opacity-100" : ""
                      )}>
                        <span className="text-[14px] font-extrabold leading-5 text-zinc-950 transition-colors group-hover:text-[var(--accent)] dark:text-zinc-50 dark:group-hover:text-[var(--accent)]">
                          {topic.title}
                        </span>
                      </div>
                    </button>

                    {/* Time Meta Row */}
                    <div className={classNames(
                      "flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500 transition-all duration-500",
                      isNsfw ? "blur-sm opacity-25 group-hover:blur-none group-hover:opacity-100" : ""
                    )}>
                      <span title="发布时间">{formatPublishTime(topic.dates.createdAt)}</span>
                      <span>•</span>
                      <span title="活跃时间">更新于 {relativeTime(topic.dates.activityAt)}</span>
                    </div>

                    {/* NSFW Shield Overlay (Visible when not hovered) */}
                    {isNsfw && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-100/50 backdrop-blur-md transition-opacity duration-500 pointer-events-none group-hover:opacity-0 dark:bg-zinc-900/50 rounded-lg">
                        <span className="px-3 py-1 text-[10px] font-extrabold tracking-wider text-[var(--accent)] bg-[var(--accent-muted)] rounded-full border border-[var(--accent)]/20 uppercase">
                          NSFW 模糊保护
                        </span>
                      </div>
                    )}

                    {/* Stats and Category Meta Footer */}
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                      {topic.category ? (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] border shrink-0"
                          style={categoryColorStyle}
                        >
                          {topic.category.name}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] border border-zinc-200 bg-zinc-100/50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 shrink-0">
                          uncategorized
                        </span>
                      )}

                      {/* Stats Icons & Links (Arranged: replies, views, likes, open native link) */}
                      <div className="flex items-center gap-2.5 shrink-0 text-zinc-400 dark:text-zinc-500">
                        <span className="flex items-center gap-1 hover:text-[var(--accent)] transition-colors cursor-help" title="评论与回复">
                          <ReplyIcon />
                          <span className="font-semibold text-[10px] text-zinc-500 dark:text-zinc-400">{compactNumber(topic.stats.replies)}</span>
                        </span>
                        <span className="flex items-center gap-1 hover:text-[var(--accent)] transition-colors cursor-help" title="浏览">
                          <EyeIcon />
                          <span className="font-semibold text-[10px] text-zinc-500 dark:text-zinc-400">{compactNumber(topic.stats.views)}</span>
                        </span>
                        {topic.stats.likes > 0 && (
                          <span className="flex items-center gap-1 hover:text-[var(--accent)] transition-colors cursor-help" title="点赞">
                            <HeartIcon />
                            <span className="font-semibold text-[10px] text-zinc-500 dark:text-zinc-400">{compactNumber(topic.stats.likes)}</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openNativeUrl(topic.url);
                          }}
                          className="text-zinc-400 hover:text-[var(--accent)] dark:text-zinc-500 transition-colors ml-1"
                          title="在新窗口打开原帖"
                        >
                          <ExternalLinkIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div ref={loadMoreSentinelRef} className="flex min-h-14 items-center justify-center px-3 py-4 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
              {isLoadingMore ? '加载更多中...' : hasMoreResults ? '' : '已经到底了哦~'}
            </div>
            {loadMoreError ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
                {loadMoreError}
              </p>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}


function StatusChip({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'success' | 'warning' | 'path' }) {
  return <span className={`status-chip status-chip--${tone}`}>{children}</span>;
}

export function Button({
  children,
  onClick,
  disabled = false,
  variant = 'secondary',
  fullWidth = false,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'link';
  fullWidth?: boolean;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      className={classNames(
        variant === 'primary' && primaryButton,
        variant === 'secondary' && secondaryButton,
        variant === 'link' && linkButton,
        fullWidth && 'w-full',
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function PanelFrame({ children, className, ariaLabel }: { children: React.ReactNode; className?: string; ariaLabel?: string }) {
  return (
    <section className={classNames('surface-strong p-3', className)} aria-label={ariaLabel}>
      {children}
    </section>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold leading-5 text-zinc-950 dark:text-zinc-50">{title}</h2>
      <span className="count-badge">{count}</span>
    </div>
  );
}

function StateBlock({
  title,
  description,
  action,
  tone = 'neutral',
  compact = false,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: 'neutral' | 'error';
  compact?: boolean;
}) {
  return (
    <section className={classNames('state-block', `state-block--${tone}`, compact ? 'p-4' : 'min-h-40 p-6')} aria-label={title}>
      <h2 className="text-sm font-bold leading-5 text-zinc-950 dark:text-zinc-50">{title}</h2>
      <p className={classNames('mt-2', mutedText)}>{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
