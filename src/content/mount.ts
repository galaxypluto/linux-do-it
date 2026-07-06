import {
  fetchTopicReaderAtPost,
  getCachedTopicReader,
  rememberCachedTopicReader,
  syncTopicReadTimings,
  voteReaderPoll
} from "../discourse/api";
import { recordReplyActivity } from "../adapters/chrome/replyActivity";
import { parseLinuxDoNestedTopicRoute, parseLinuxDoTopicRoute } from "../domain/linuxdo/routes";
import { isTopicListRoute } from "../discourse/endpoints";
import type { TopicCardData, TopicReaderData } from "../discourse/types";
import { loadSettings, normalizeSettings, saveSettings, type ExtensionSettings } from "../storage/settings";
import {
  renderApp,
  renderNativeTopControls,
  setLoadMoreLoadingState,
  closeImageViewerWithMotion,
  closeTransientPanels,
  closeReaderWithMotion,
  eventPathContainsTransientPanel,
  hasOpenTransientPanels,
  type ReaderImageViewerAction,
  type ReaderImageViewerState,
  type ReaderPollVoteRequest,
  type NativeComposerAction,
  type ReaderPostAction,
  type ReaderState,
  type ReaderUserPreviewState
} from "../ui/render";
import type { ReaderModalOrigin } from "../ui/readerTypes";
import type { ReplyActivity } from "../shared/replyActivity";
import { imageViewerActionFromKey } from "../ui/imageViewerState";
import {
  ensurePageStyle,
  NATIVE_REPLY_ROOT_PRESERVING_CLASS,
  PRIVATE_MESSAGE_LAYOUT_CLASS,
  READER_SCROLL_LOCK_CLASS
} from "./pageStyle";
import { mainOutlet, rootInsertionTarget } from "./pageDetector";
import { NativeNoticeHostController } from "./nativeNoticeHost";
import { resolveReaderOverlayLockActive } from "./overlayStacking";
import {
  nativeReplyReturnUrl,
  shouldIgnoreNativeReplyListRouteRefresh,
  type NativeReplyRouteGuard
} from "./nativeReplyRouteRestore";
import {
  ensurePageBridge,
  NATIVE_REPLY_SUBMITTED_EVENT,
  requestNativePostAction,
  requestNativePrivateMessage,
  requestNativePrivateMessageClose,
  requestNativeRouteRestore,
  type NativePostActionResult
} from "./privateMessageBridge";
import { PrivateMessageLayoutController } from "./privateMessageLayout";
import { ReaderMemoryCache } from "./readerCache";
import { mountTopicPageEnhancer, unmountTopicPageEnhancer } from "./topicPageEnhancer";
import {
  applyConfirmedReaderPostAction,
  emptyReaderState,
  mergeSubmittedReaderReply
} from "./readerState";
import { ReaderRuntime } from "./readerRuntime";
import {
  capturePageScrollAnchor,
  captureReaderScroll,
  revealReaderPost,
  restorePageScrollAnchor as restorePageScrollAnchorFromRoot,
  restoreReaderScroll as restoreReaderScrollFromRoot,
  scrollToPageTop
} from "./scrollState";
import {
  mergeViewedTopicIds,
  mergeViewedTopicIdsStorage,
  loadViewedTopicIdsAsync,
  normalizeViewedTopicIds,
  persistViewedTopicIdsAsync,
  viewedTopicIdsEqual,
  CREDIT_VIEWED_TOPICS_STORAGE_KEY,
  DEFAULT_CREDIT_VIEWED_TOPIC_STORAGE_MAX,
} from "./topicListState";
import {
  consumeSameScrollLoadMoreSuppression,
  loadMoreRectIntersectsViewportMargin,
  loadMoreObserverRootMargin,
} from "./progressiveTopics";
import {
  absoluteLinuxDoUrl,
  createLocalRequestId,
  createReplyActivity,
  nativeReplyActivityId,
  nativeResultStatusForReader,
  NativeActionRuntime,
  positiveNumberOrNull,
  readerPostActionFallbackMessage,
  readerPostActionLabel,
} from "./nativeActionRuntime";
import { TopicListRuntime, shouldSuppressLoadMoreIntersectionAtCurrentScroll } from "./topicListRuntime";
import type { TopicListNavigationRequest } from "./newTopicApplyFlow";
import { createSidePanelSearchBridge, fetchLinuxDoSearchJson } from "./sidePanelSearchBridge";
import { shouldScheduleCreditTopicView, trimCreditViewedTopicIdSets } from "./creditViewedTopics";
import { attachReaderReadTimingsSync } from "./readerReadTimingsSync";
import { TopicViewTrackingController } from "./topicViewTracking";

const ROOT_ID = "linuxdo-card-view-root";
const RUNTIME_ATTR = "data-linuxdo-card-view-runtime";
const JUST_READ_ANIMATION_MS = 900;
const READER_STICKY_GAP = 12;
const NATIVE_COMPOSER_OPEN_TIMEOUT_MS = 5000;
const ROOT_FRAME_PIXEL_PRECISION = 0.1;
const VIEWED_TOPIC_IDS_PERSIST_DEBOUNCE_MS = 500;

function creditViewedTopicStorageMax(): number {
  return settings?.creditViewedTopicStorageMax ?? DEFAULT_CREDIT_VIEWED_TOPIC_STORAGE_MAX;
}

let settings: ExtensionSettings;
let rootHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let stickyOffsetFrame: number | undefined;
let rootConnectionObserver: MutationObserver | undefined;
let loadMoreObserver: IntersectionObserver | undefined;
let suppressedLoadMoreIntersectionScrollY: number | null = null;
let nativeReplyRootPreserveTimer: number | undefined;
let nativeReplyFallbackRootActive = false;
let nativeReplyRootFrame: { top: number; left: number; width: number } | null = null;
let readerAbortController: AbortController | null = null;
let readerMoreAbortController: AbortController | null = null;
let userPreviewAbortController: AbortController | null = null;
let readerState: ReaderState = emptyReaderState();
const readerMemoryCache = new ReaderMemoryCache();
let viewedTopicIds = new Set<number>();
let justReadTopicIds = new Set<number>();
let localViewedTopicIds = new Set<number>();
let pendingViewedTopicIds = new Set<number>();
let viewedTopicIdsInFlight = new Set<number>();
let viewedTopicIdsPersistTimer: number | undefined;
let readerReadTimingsSyncCleanup: (() => void) | null = null;
let readerReadTimingsSyncTopicId: number | null = null;
let readerReadTimingsSyncSignal: AbortSignal | null = null;
let viewedTopicIdsPersistPromise: Promise<void> | null = null;
const syncedReadPostNumbersByTopic = new Map<number, Set<number>>();
const searchTopicsMap = new Map<number, TopicCardData>();
let activeTopicListRouteKey = "";
const privateMessageLayout = new PrivateMessageLayoutController({
  rootHost: () => rootHost,
  readerSurface: () => activeReaderSurface(),
  canDock: () => shouldDockNativePrivateMessage(),
  shouldUseReaderGeometry: () => Boolean(activeReaderSurface()),
  onDeactivate: () => nativeActionRuntime.clearComposerOpenedFeedback(Boolean(shadowRoot && settings?.enabled))
});
const nativeNoticeHost = new NativeNoticeHostController({
  rootHost: () => rootHost,
  outlet: () => mainOutlet()
});
const topicListRuntime = new TopicListRuntime({
  getSettings: () => settings,
  setCardMode: (enabled) => {
    document.documentElement.classList.toggle("ldcv-card-mode", enabled);
  },
  renderCurrent: (request) => renderCurrent(request),
  setLoadMoreLoadingState: (loading) => {
    if (shadowRoot) {
      setLoadMoreLoadingState(shadowRoot, loading);
    }
  },
  onResetReader: () => resetReaderState(),
  onBeforeApplyPendingRefresh: () => {
    closeAllTransientPanels();
  },
  onPendingNoticeRootCleared: () => {
    nativeNoticeHost.removeRoot();
  },
  onScheduleNavigation: (request) => {
    scheduleTopicListNavigation(request);
  },
  isModalReaderOverlayActive: () => isModalReaderOverlayActive(),
  canPollLatest: () => Boolean(shadowRoot && isTopicListRoute() && !readerState.topicId),
});
const nativeActionRuntime = new NativeActionRuntime({
  getReaderState: () => readerState,
  setReaderState: (updater) => {
    readerState = updater(readerState);
  },
  renderCurrent: () => renderCurrent({ loading: false, error: "", preservePageAnchor: true }),
  ensureRoot: () => ensureRoot(),
  syncNativeReplyRootPreserveClass: () => syncNativeReplyRootPreserveClass(),
  captureNativeReplyRootFrame: () => captureNativeReplyRootFrame(),
  requestNativeRouteRestore: (returnUrl) => requestNativeRouteRestore(returnUrl),
});
const topicViewTracking = new TopicViewTrackingController({
  getTopicId: () => readerState.topicId,
  setTrackingState: ({ phase, startedAt }) => {
    readerState = {
      ...readerState,
      creditViewTrackingPhase: phase,
      creditViewTrackingStartedAt: startedAt,
    };
  },
  renderCurrent: () => renderCurrent({ loading: false, error: "", preservePageAnchor: true }),
  getDwellMs: () => (settings?.creditTopicViewDwellSeconds ?? 10) * 1000,
  isAlreadyTracked: (topicId) => !shouldScheduleCreditTopicView(topicId, viewedTopicIds),
  onTrackSuccess: (topic) => markTopicReadConfirmed(topic.id),
});
const readerRuntime = new ReaderRuntime({
  getSettings: () => settings,
  getReaderState: () => readerState,
  setReaderState: (updater) => {
    readerState = updater(readerState);
  },
  getReaderAbortController: () => readerAbortController,
  setReaderAbortController: (controller) => {
    readerAbortController = controller;
  },
  getReaderMoreAbortController: () => readerMoreAbortController,
  setReaderMoreAbortController: (controller) => {
    readerMoreAbortController = controller;
  },
  getUserPreviewAbortController: () => userPreviewAbortController,
  setUserPreviewAbortController: (controller) => {
    userPreviewAbortController = controller;
  },
  renderCurrent: (request) => renderCurrent(request),
  getShadowRoot: () => shadowRoot,
  getTopicById: (topicId) => topicListRuntime.getTopicById(topicId) || searchTopicsMap.get(topicId) || null,
  prepareTopicOpen: (topicId) => topicListRuntime.prepareTopicOpen(topicId),
  updateStickyOffset: () => updateStickyOffset(),
  cachedReaderData: (topicId) => cachedReaderData(topicId),
  rememberReaderData: (reader) => rememberReaderData(reader),
  syncLoadedReaderPosts: (reader, signal, selectedPostNumbers) =>
    syncLoadedReaderPosts(reader, signal, selectedPostNumbers),
  revealFreshPosts: (postNumbers) => scheduleReaderPostReveal(postNumbers),
  onReset: () => {
    clearReaderReadTimingsSync();
    nativeActionRuntime.clearNativePostActionFeedbackTimer();
    privateMessageLayout.deactivate();
    setReaderOverlayLock(false);
  },
  closeImageViewerWithMotion: () => closeImageViewerWithMotion(shadowRoot),
  onReaderTopicDismissed: () => topicViewTracking.cancel(),
  onReaderTopicDisplayed: (topic) => topicViewTracking.schedule(topic),
});

export function claimCardViewRuntime(): boolean {
  if (document.documentElement.getAttribute(RUNTIME_ATTR) === "active") {
    return false;
  }

  document.documentElement.setAttribute(RUNTIME_ATTR, "active");
  return true;
}

export async function bootCardView(): Promise<void> {
  if (typeof window !== "undefined" && window.CSS && window.CSS.registerProperty) {
    try {
      window.CSS.registerProperty({
        name: "--ldcv-beam-angle",
        syntax: "<angle>",
        inherits: false,
        initialValue: "0deg"
      });
    } catch (e) {
      // Ignore double registration
    }
  }
  settings = await loadSettings();
  viewedTopicIds = await loadViewedTopicIdsAsync(
    CREDIT_VIEWED_TOPICS_STORAGE_KEY,
    settings.creditViewedTopicStorageMax,
  );
  ensurePageStyle();
  ensurePageBridge();
  startRootConnectionObserver();
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes[CREDIT_VIEWED_TOPICS_STORAGE_KEY]) {
        const newVal = changes[CREDIT_VIEWED_TOPICS_STORAGE_KEY].newValue;
        if (Array.isArray(newVal)) {
          handleViewedTopicIdsStorageChange(
            normalizeViewedTopicIds(newVal, creditViewedTopicStorageMax()),
          );
        }
      }
    });
  } catch {
    // Fail silently in test or non-extension environments
  }
  document.addEventListener("visibilitychange", handleViewedTopicIdsFlush);
  window.addEventListener("pagehide", handleViewedTopicIdsFlush);
  window.addEventListener("keydown", handleReaderKeydown, true);
  window.addEventListener(NATIVE_REPLY_SUBMITTED_EVENT, handleNativeReplySubmitted as EventListener);
  window.addEventListener("resize", scheduleStickyOffsetUpdate, { passive: true });
  window.addEventListener("scroll", scheduleStickyOffsetUpdate, { passive: true });
  document.addEventListener("click", handleTransientPanelOutsideClick);
  try {
    chrome.runtime.onMessage.addListener(
      createSidePanelSearchBridge({
        searchTopics: (query, page) => fetchLinuxDoSearchJson(query, page),
        openTopic: async (topicId, topic) => {
          searchTopicsMap.set(topicId, topic);
          ensureRoot();
          if (!shadowRoot) {
            throw new Error("Unable to open Reader on this page");
          }
          const opened = await readerRuntime.open(topicId, { force: true, modalOrigin: null });
          if (!opened) {
            throw new Error("Unable to open Reader on this page");
          }
        },
      })
    );
  } catch (e) {
    // Fail silently in non-extension environments
  }
  nativeNoticeHost.startThemeSyncObserver();
  await updateForRoute();
}

export async function updateForRoute(): Promise<void> {
  if (!settings) {
    settings = await loadSettings();
  }

  const nestedTopicRoute = parseLinuxDoNestedTopicRoute(window.location);
  if (nestedTopicRoute) {
    if (nativeActionRuntime.restoreNativeReplyListRouteIfNeeded()) {
      return;
    }
    if (rootHost || shadowRoot || topicListRuntime.hasData) {
      removeActiveState({ keepTopicEnhancer: true });
    }

    activeTopicListRouteKey = "";
    await mountTopicPageEnhancer({
      route: nestedTopicRoute,
      settings,
    });
    return;
  }

  const topicRoute = parseLinuxDoTopicRoute(window.location);
  if (topicRoute) {
    if (nativeActionRuntime.restoreNativeReplyListRouteIfNeeded()) {
      return;
    }
    if (rootHost || shadowRoot || topicListRuntime.hasData) {
      removeActiveState();
    }
    activeTopicListRouteKey = "";
    unmountTopicPageEnhancer();
    return;
  }

  unmountTopicPageEnhancer();

  if (!isTopicListRoute()) {
    if (nativeActionRuntime.restoreNativeReplyListRouteIfNeeded()) {
      return;
    }
    activeTopicListRouteKey = "";
    removeActiveState();
    return;
  }

  ensureRoot();
  scheduleStickyOffsetUpdate();
  const routeKey = currentTopicListRouteKey();
  if (shouldIgnoreNativeReplyListRouteRefresh(nativeActionRuntime.routeGuard, routeKey, activeTopicListRouteKey, Date.now())) {
    return;
  }
  const routeChanged = activeTopicListRouteKey !== routeKey;
  activeTopicListRouteKey = routeKey;
  await refreshData({ reset: routeChanged });
}

function currentTopicListRouteKey(): string {
  return `${window.location.pathname}${window.location.search}`;
}

async function refreshData({ reset }: { reset: boolean }): Promise<void> {
  if (!shadowRoot) {
    return;
  }

  document.documentElement.classList.toggle("ldcv-card-mode", settings.enabled);

  if (!settings.enabled) {
    topicListRuntime.reset();
    resetReaderState();
    document.documentElement.classList.remove("ldcv-card-mode");
    const nativeTopControlsRoot = nativeNoticeHost.ensureRoot();
    const topicList = topicListRuntime.snapshot;
    renderApp({
      root: shadowRoot,
      data: null,
      settings,
      loading: false,
      loadingMore: false,
      error: "扩展视图已关闭，点击“卡片”或“瀑布”可重新启用。",
      updatedAt: topicList.updatedAt,
      pendingNewTopicCount: topicList.pendingNewTopicCount,
      pendingNewTopics: topicListRuntime.pendingTopics,
      pendingNoticeExpanded: topicList.pendingNoticeExpanded,
      pendingNoticeMinimized: topicList.pendingNoticeMinimized,
      useNativePendingNotice: Boolean(nativeTopControlsRoot),
      allowFloatingPendingNotice: window.innerWidth <= 760,
      hasMore: false,
      reader: readerState,
      viewedTopicIds,
      justReadTopicIds,
      onRefresh: () => void refreshData({ reset: false }),
      onApplyPendingRefresh: applyPendingRefresh,
      onTogglePendingPreview: togglePendingPreview,
      onMinimizePendingNotice: minimizePendingNotice,
      onDismissPendingPreview: dismissPendingPreviewWithoutRender,
      onLoadMore: () => void loadMoreTopics(),
      onOpenTopic: (topicId, modalOrigin) => void openReader(topicId, { modalOrigin }),
      onReaderAdjacent: readerAdjacent,
      onRefreshReader: () => void refreshReader(),
      onLoadMoreReaderPosts: () => void loadMoreReaderPosts(),
      onRetryReader: retryReader,
      onCloseReader: closeReader,
      onReaderBackdropClick: handleReaderBackdropClick,
      onOpenReaderImage: openReaderImage,
      onImageViewerAction: updateReaderImageViewer,
      onCloseReaderImage: closeReaderImage,
      onOpenUserPreview: openUserPreview,
      onCloseUserPreview: closeUserPreview,
      onOpenPrivateMessage: openPrivateMessage,
      onNativePostAction: handleNativePostAction,
      onPollVote: handlePollVote,
      onCommentSortChange: handleCommentSortChange,
      onSettingsChange: handleSettingsChange
    });
    renderNativeTopControlsRoot(nativeTopControlsRoot, false);
    return;
  }

  await topicListRuntime.refreshData({ reset });
}

async function loadMoreTopics(): Promise<void> {
  await topicListRuntime.loadMoreTopics();
}

async function loadMoreReaderPosts(): Promise<void> {
  await readerRuntime.loadMorePosts();
}

async function pollLatest(): Promise<void> {
  await topicListRuntime.pollLatest();
}

function applyPendingRefresh(): void {
  topicListRuntime.applyPendingRefresh();
}

function scheduleTopicListNavigation(request: TopicListNavigationRequest): void {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (request.kind === "page-top") {
        scrollToPageTop({ durationMs: request.durationMs });
      }
    });
  });
}

function togglePendingPreview(): void {
  closeAllTransientPanels();
  topicListRuntime.togglePendingPreview();
}

function minimizePendingNotice(): void {
  topicListRuntime.minimizePendingNotice();
}

function dismissTransientPanels(): boolean {
  let changed = closeAllTransientPanels();
  if (topicListRuntime.hasPendingNoticeExpanded) {
    dismissPendingPreviewWithoutRender();
    changed = true;
  }
  return changed;
}

function dismissPendingPreviewWithoutRender(): void {
  topicListRuntime.dismissPendingPreviewWithoutRender();
}

function closeAllTransientPanels(): boolean {
  const nativeRoot = nativeNoticeHost.hostElement()?.shadowRoot ?? null;
  const closedAppPanels = closeTransientPanels(shadowRoot);
  const closedNativePanels = closeTransientPanels(nativeRoot);
  return closedAppPanels || closedNativePanels;
}

function hasAnyOpenTransientPanels(): boolean {
  const nativeRoot = nativeNoticeHost.hostElement()?.shadowRoot ?? null;
  return hasOpenTransientPanels(shadowRoot) || hasOpenTransientPanels(nativeRoot);
}

function clearPendingLatest(): void {
  topicListRuntime.clearPendingLatest();
}

function pendingNewTopics(): TopicCardData[] {
  return topicListRuntime.pendingTopics;
}

function renderNativeTopControlsRoot(targetRoot: ShadowRoot | null, loading: boolean): void {
  if (!targetRoot) {
    return;
  }

  const topicList = topicListRuntime.snapshot;
  renderNativeTopControls(targetRoot, {
    settings,
    topicCount: topicList.data?.topics.length ?? 0,
    loading,
    updatedAt: topicList.updatedAt,
    count: topicList.pendingNewTopicCount,
    topics: pendingNewTopics(),
    expanded: topicList.pendingNoticeExpanded,
    onTogglePendingPreview: togglePendingPreview,
    onApplyPendingRefresh: applyPendingRefresh,
    onOpenTopic: (topicId) => void openReader(topicId),
    onDismissPendingPreview: dismissPendingPreviewWithoutRender,
    onRefresh: () => void refreshData({ reset: false }),
    onSettingsChange: handleSettingsChange
  });
}

function handleTransientPanelOutsideClick(event: MouseEvent): void {
  if (!settings) {
    return;
  }

  const path = event.composedPath();
  if (eventPathContainsTransientPanel(path)) {
    return;
  }

  if (!topicListRuntime.hasPendingNoticeExpanded && !hasAnyOpenTransientPanels()) {
    return;
  }

  const changed = dismissTransientPanels();

  if (changed) {
    renderCurrent({ loading: false, error: "", preservePageAnchor: true });
  }
}

function handleSettingsChange(next: ExtensionSettings): void {
  const previous = settings;
  dismissTransientPanels();
  settings = normalizeSettings(next);
  void saveSettings(settings);

  if (previous.layout === "reader" && settings.layout !== "reader") {
    resetReaderState();
  } else if (previous.layout !== "reader" && settings.layout === "reader") {
    resetReaderState();
  }

  if (previous.newTopicNoticeEnabled && !settings.newTopicNoticeEnabled) {
    topicListRuntime.clearPendingLatest();
  }

  if (previous.creditViewedTopicStorageMax !== settings.creditViewedTopicStorageMax) {
    const max = creditViewedTopicStorageMax();
    const trimmed = trimCreditViewedTopicIdSets(
      {
        viewed: viewedTopicIds,
        local: localViewedTopicIds,
        pending: pendingViewedTopicIds,
        inFlight: viewedTopicIdsInFlight,
      },
      max,
    );
    viewedTopicIds = trimmed.viewed;
    localViewedTopicIds = trimmed.local;
    pendingViewedTopicIds = trimmed.pending;
    viewedTopicIdsInFlight = trimmed.inFlight;
    void persistCreditViewedTopicIdsSnapshot();
  }

  if (previous.creditTopicViewDwellSeconds !== settings.creditTopicViewDwellSeconds) {
    rescheduleActiveCreditTopicViewIfNeeded();
  }

  document.documentElement.classList.toggle("ldcv-card-mode", settings.enabled);
  if (!settings.enabled) {
    topicListRuntime.stopAutoRefresh();
    topicListRuntime.clearPendingLatest();
    resetReaderState();
    const nativeTopControlsRoot = nativeNoticeHost.ensureRoot();
    if (shadowRoot) {
      const topicList = topicListRuntime.snapshot;
      renderApp({
        root: shadowRoot,
        data: null,
        settings,
        loading: false,
        loadingMore: false,
        error: "扩展视图已关闭，点击“卡片”或“瀑布”可重新启用。",
        updatedAt: topicList.updatedAt,
        pendingNewTopicCount: topicList.pendingNewTopicCount,
        pendingNewTopics: pendingNewTopics(),
        pendingNoticeExpanded: topicList.pendingNoticeExpanded,
        pendingNoticeMinimized: topicList.pendingNoticeMinimized,
        useNativePendingNotice: Boolean(nativeTopControlsRoot),
        allowFloatingPendingNotice: window.innerWidth <= 760,
        hasMore: false,
        reader: readerState,
        viewedTopicIds,
        justReadTopicIds,
        onRefresh: () => void refreshData({ reset: false }),
        onApplyPendingRefresh: applyPendingRefresh,
        onTogglePendingPreview: togglePendingPreview,
        onMinimizePendingNotice: minimizePendingNotice,
        onDismissPendingPreview: dismissPendingPreviewWithoutRender,
        onLoadMore: () => void loadMoreTopics(),
        onOpenTopic: (topicId, modalOrigin) => void openReader(topicId, { modalOrigin }),
        onReaderAdjacent: readerAdjacent,
        onRefreshReader: () => void refreshReader(),
        onLoadMoreReaderPosts: () => void loadMoreReaderPosts(),
        onRetryReader: retryReader,
        onCloseReader: closeReader,
        onReaderBackdropClick: handleReaderBackdropClick,
        onOpenReaderImage: openReaderImage,
        onImageViewerAction: updateReaderImageViewer,
        onCloseReaderImage: closeReaderImage,
        onOpenUserPreview: openUserPreview,
        onCloseUserPreview: closeUserPreview,
        onOpenPrivateMessage: openPrivateMessage,
        onNativePostAction: handleNativePostAction,
        onPollVote: handlePollVote,
        onCommentSortChange: handleCommentSortChange,
        onSettingsChange: handleSettingsChange
      });
      renderNativeTopControlsRoot(nativeTopControlsRoot, false);
    }
    return;
  }

  if (!previous.enabled || !topicListRuntime.hasData) {
    void refreshData({ reset: false });
    return;
  }

  if (settings.layout === "masonry") {
    topicListRuntime.restartProgressiveRendering(true);
  }
  topicListRuntime.startAutoRefresh();
  renderCurrent({ loading: false, error: "" });
}

function handleCommentSortChange(commentSortOrder: ExtensionSettings["commentSortOrder"]): void {
  handleSettingsChange({
    ...settings,
    commentSortOrder
  });
}

function renderCurrent({
  loading,
  error,
  preservePageAnchor = false,
  preserveReaderScroll = false
}: {
  loading: boolean;
  error: string;
  preservePageAnchor?: boolean;
  preserveReaderScroll?: boolean;
}): void {
  if (!shadowRoot) {
    return;
  }

  const readerScroll = preserveReaderScroll ? null : captureReaderScroll(shadowRoot);
  const pageAnchor = preservePageAnchor ? capturePageScrollAnchor(shadowRoot) : null;
  const nativeTopControlsRoot = nativeNoticeHost.ensureRoot();
  const topicList = topicListRuntime.snapshot;

  const isEnabled = settings.enabled;

  renderApp({
    root: shadowRoot,
    data: isEnabled ? topicList.data : null,
    settings,
    loading: isEnabled ? loading : false,
    loadingMore: isEnabled ? topicList.loadingMore : false,
    error: isEnabled ? error : "扩展视图已关闭，点击“卡片”或“瀑布”可重新启用。",
    updatedAt: topicList.updatedAt,
    pendingNewTopicCount: topicList.pendingNewTopicCount,
    pendingNewTopics: pendingNewTopics(),
    pendingNoticeExpanded: topicList.pendingNoticeExpanded,
    pendingNoticeMinimized: topicList.pendingNoticeMinimized,
    useNativePendingNotice: Boolean(nativeTopControlsRoot),
    allowFloatingPendingNotice: window.innerWidth <= 760,
    visibleTopicCount: topicList.visibleTopicCount,
    newTopicIds: topicList.newTopicIds,
    enteringTopicIds: topicList.enteringTopicIds,
    hasMore: topicListRuntime.hasMoreTopics,
    reader: readerState,
    viewedTopicIds,
    justReadTopicIds,
    onRefresh: () => void refreshData({ reset: false }),
    onApplyPendingRefresh: applyPendingRefresh,
    onTogglePendingPreview: togglePendingPreview,
    onMinimizePendingNotice: minimizePendingNotice,
    onDismissPendingPreview: dismissPendingPreviewWithoutRender,
    onLoadMore: () => void loadMoreTopics(),
    onOpenTopic: (topicId, modalOrigin) => void openReader(topicId, { modalOrigin }),
    onReaderAdjacent: readerAdjacent,
    onRefreshReader: () => void refreshReader(),
    onLoadMoreReaderPosts: () => void loadMoreReaderPosts(),
    onRetryReader: retryReader,
    onCloseReader: closeReader,
    onReaderBackdropClick: handleReaderBackdropClick,
    onOpenReaderImage: openReaderImage,
    onImageViewerAction: updateReaderImageViewer,
    onCloseReaderImage: closeReaderImage,
    onOpenUserPreview: openUserPreview,
    onCloseUserPreview: closeUserPreview,
    onOpenPrivateMessage: openPrivateMessage,
    onNativePostAction: handleNativePostAction,
    onPollVote: handlePollVote,
    onCommentSortChange: handleCommentSortChange,
    onSettingsChange: handleSettingsChange
  });
  topicListRuntime.acknowledgeRender();
  renderNativeTopControlsRoot(nativeTopControlsRoot, loading);
  setReaderOverlayLock(isReaderOverlayLockActive());
  if (!preserveReaderScroll) {
    restoreReaderScrollFromRoot(shadowRoot, readerScroll, readerState.topicId, readerState.loading);
  }
  restorePageScrollAnchorFromRoot(shadowRoot, pageAnchor);
  setupLoadMoreObserver();
  scheduleStickyOffsetUpdate();
  ensureReaderReadTimingsSync();
}

function clearReaderReadTimingsSync(): void {
  readerReadTimingsSyncCleanup?.();
  readerReadTimingsSyncCleanup = null;
  readerReadTimingsSyncTopicId = null;
  readerReadTimingsSyncSignal = null;
}

function ensureReaderReadTimingsSync(): void {
  const topicId = readerState.topicId;
  if (!shadowRoot || !topicId || !readerState.data || readerState.loading) {
    clearReaderReadTimingsSync();
    return;
  }

  const currentSignal = readerAbortController?.signal ?? null;
  if (
    readerReadTimingsSyncTopicId === topicId &&
    readerReadTimingsSyncCleanup &&
    readerReadTimingsSyncSignal === currentSignal
  ) {
    return;
  }

  clearReaderReadTimingsSync();

  const scrollEl = shadowRoot.querySelector(".ldcv-reader-scroll");
  if (!(scrollEl instanceof HTMLElement)) {
    window.requestAnimationFrame(() => ensureReaderReadTimingsSync());
    return;
  }

  readerReadTimingsSyncTopicId = topicId;
  readerReadTimingsSyncSignal = currentSignal;
  readerReadTimingsSyncCleanup = attachReaderReadTimingsSync({
    scrollRoot: scrollEl,
    signal: readerAbortController?.signal,
    syncPostNumbers: (postNumbers) => {
      const data = readerState.data;
      if (!data || data.id !== topicId) {
        return Promise.resolve(false);
      }
      return syncLoadedReaderPosts(data, readerAbortController?.signal, postNumbers);
    },
  });
}

function cachedReaderData(topicId: number): TopicReaderData | null {
  const memoryReader = readerMemoryCache.get(topicId);
  if (memoryReader) {
    return memoryReader;
  }

  const sessionReader = getCachedTopicReader(topicId);
  if (sessionReader) {
    readerMemoryCache.remember(sessionReader);
    return sessionReader;
  }

  return null;
}

function rememberReaderData(reader: TopicReaderData): void {
  readerMemoryCache.remember(reader);
  rememberCachedTopicReader(reader);
}

async function syncLoadedReaderPosts(
  reader: TopicReaderData,
  signal?: AbortSignal,
  selectedPostNumbers?: ReadonlySet<number>
): Promise<boolean> {
  const syncedPostNumbers = syncedReadPostNumbersByTopic.get(reader.id) ?? new Set<number>();
  const postNumbers = new Set(
    reader.posts
      .map((post) => post.postNumber)
      .filter(
        (postNumber) =>
          Number.isFinite(postNumber) &&
          postNumber > 0 &&
          !syncedPostNumbers.has(postNumber) &&
          (!selectedPostNumbers || selectedPostNumbers.has(postNumber))
      )
  );

  if (!postNumbers.size) {
    // 批次内楼层已在本地记录为已同步，或当前 reader 数据尚未包含该楼层
    if (!selectedPostNumbers?.size) {
      return true;
    }
    return Array.from(selectedPostNumbers).every(
      (postNumber) =>
        syncedPostNumbers.has(postNumber) ||
        !reader.posts.some((post) => post.postNumber === postNumber),
    );
  }

  try {
    const result = await syncTopicReadTimings(reader, { postNumbers, signal });
    if (result === "failed") {
      console.warn("[linuxdo-reader] Failed to sync Discourse read timings", {
        topicId: reader.id,
        postNumbers: Array.from(postNumbers)
      });
      return false;
    }
    if (result === "skipped") {
      return false;
    }

    postNumbers.forEach((postNumber) => syncedPostNumbers.add(postNumber));
    syncedReadPostNumbersByTopic.set(reader.id, syncedPostNumbers);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return false;
    }
    console.warn("[linuxdo-reader] Failed to sync Discourse read timings", {
      topicId: reader.id,
      error
    });
    return false;
  }
}

async function openReader(
  topicId: number,
  { force = false, modalOrigin = null }: { force?: boolean; modalOrigin?: ReaderModalOrigin | null } = {}
): Promise<void> {
  await readerRuntime.open(topicId, { force, modalOrigin });
}

function closeReader(): void {
  suppressedLoadMoreIntersectionScrollY = window.scrollY;
  resetReaderState();
  renderCurrent({ loading: false, error: "", preservePageAnchor: true });
  scheduleLoadMoreVisibilityCheckAfterReaderClose();
}

async function persistCreditViewedTopicIdsSnapshot(): Promise<void> {
  const maxIds = creditViewedTopicStorageMax();
  const normalized = normalizeViewedTopicIds(Array.from(viewedTopicIds), maxIds);
  viewedTopicIds = normalized;
  localViewedTopicIds = normalizeViewedTopicIds(Array.from(localViewedTopicIds), maxIds);

  try {
    await persistViewedTopicIdsAsync(normalized, CREDIT_VIEWED_TOPICS_STORAGE_KEY, maxIds);
  } catch {
    // 裁剪后的快照写入失败不应阻塞阅读
  }
}

function rescheduleActiveCreditTopicViewIfNeeded(): void {
  if (readerState.creditViewTrackingPhase !== "countdown" || !readerState.topicId) {
    return;
  }

  const topic =
    topicListRuntime.getTopicById(readerState.topicId)
    || searchTopicsMap.get(readerState.topicId)
    || null;
  if (!topic || !shouldScheduleCreditTopicView(topic.id, viewedTopicIds)) {
    return;
  }

  topicViewTracking.schedule(topic);
}

function markTopicReadConfirmed(topicId: number): void {
  if (!Number.isFinite(topicId)) {
    return;
  }

  const wasViewed = viewedTopicIds.has(topicId);
  const maxIds = creditViewedTopicStorageMax();
  localViewedTopicIds = mergeViewedTopicIds(localViewedTopicIds, [topicId], maxIds);
  viewedTopicIds = mergeViewedTopicIds(viewedTopicIds, [topicId], maxIds);
  pendingViewedTopicIds = mergeViewedTopicIds(pendingViewedTopicIds, [topicId], maxIds);
  scheduleViewedTopicIdsPersist();
  patchTopicCardReadState(topicId, !wasViewed);
  if (!wasViewed) {
    markJustReadTopic(topicId);
  }
}

function markJustReadTopic(topicId: number): void {
  if (!Number.isFinite(topicId)) {
    return;
  }

  justReadTopicIds.delete(topicId);
  justReadTopicIds.add(topicId);
  window.setTimeout(() => {
    if (!justReadTopicIds.delete(topicId)) {
      return;
    }
    patchTopicCardReadState(topicId, false);
    if (shadowRoot && settings.enabled && settings.layout === "reader") {
      renderCurrent({ loading: false, error: "" });
    }
  }, JUST_READ_ANIMATION_MS);
}

function patchTopicCardReadState(topicId: number, justRead: boolean): void {
  const cards = shadowRoot?.querySelectorAll<HTMLElement>(`.ldcv-card[data-topic-id="${topicId}"]`);
  if (!cards) return;

  cards.forEach(card => {
    if (card.classList.contains("is-selected")) {
      return;
    }

    card.classList.add("is-viewed");
    card.classList.toggle("is-just-read", justRead);
    const status = card.querySelector<HTMLElement>(".ldcv-card__status");
    if (status) {
      let badge = status.querySelector<HTMLElement>(".ldcv-state");
      if (!badge) {
        badge = document.createElement("span");
        status.appendChild(badge);
      }
      badge.className = "ldcv-state is-viewed";
      badge.textContent = "已读";
    }
  });
}

function handleReaderBackdropClick(): void {
  if (document.documentElement.classList.contains(PRIVATE_MESSAGE_LAYOUT_CLASS)) {
    requestNativePrivateMessageClose();
    privateMessageLayout.resetGraceWindow();
    privateMessageLayout.scheduleChecks();
    privateMessageLayout.scheduleSync();
    return;
  }

  closeReader();
}

function openReaderImage(image: ReaderImageViewerState): void {
  readerRuntime.openImage(image);
}

function closeReaderImage(): void {
  readerRuntime.closeImage();
}

function openUserPreview(preview: ReaderUserPreviewState): void {
  readerRuntime.openUserPreview(preview);
}

function closeUserPreview(): void {
  readerRuntime.closeUserPreview();
}

function openPrivateMessage(): void {
  const preview = readerState.userPreview;
  const reader = readerState.data;
  if (!preview || !reader || !preview.username) {
    return;
  }
  if (readerState.nativePostAction?.status === "pending") {
    return;
  }
  nativeActionRuntime.clearNativePostActionFeedbackTimer();

  const username = preview.profile?.username || preview.username;
  const anchorPost =
    reader.posts.find((post) => post.postNumber === preview.anchorPostNumber) ||
    reader.posts.find((post) => post.postNumber === preview.postNumber) ||
    reader.posts[0];
  const postUrl = new URL(anchorPost?.url || reader.url, window.location.origin).toString();
  const title = `回复： ${reader.title}`;
  const body = postUrl;
  const useDockedComposer = shouldDockNativePrivateMessage();
  const replaceExisting = false;
  const postNumber = anchorPost?.postNumber || preview.postNumber || 1;
  const requestId = createLocalRequestId();

  if (useDockedComposer) {
    privateMessageLayout.activate();
  }

  readerState = {
    ...readerState,
    nativePostAction: {
      requestId,
      action: "private-message",
      postNumber,
      status: "pending",
      message: "私信窗口打开中...",
      replaceExisting
    }
  };
  renderCurrent({ loading: false, error: "" });

  void requestNativePrivateMessage({
    username,
    title,
    body,
    postUrl,
    replaceExisting
  }, { timeoutMs: NATIVE_COMPOSER_OPEN_TIMEOUT_MS }).then((opened) => {
    if (readerState.nativePostAction?.requestId !== requestId) {
      return;
    }

    if (!opened) {
      if (useDockedComposer) {
        privateMessageLayout.deactivate();
      }
      if (replaceExisting) {
        return;
      }
      readerState = {
        ...readerState,
        nativePostAction: {
          requestId,
          action: "private-message",
          postNumber,
          status: "error",
          message: "私信窗口打开失败，请在原贴中重试。"
        }
      };
      nativeActionRuntime.scheduleNativePostActionFeedbackDismiss(readerState.nativePostAction);
      renderCurrent({ loading: false, error: "" });
      const fallback = `/new-message?username=${encodeURIComponent(username)}&title=${encodeURIComponent(
        title
      )}&body=${encodeURIComponent(body)}`;
      window.open(fallback, "_blank", "noopener,noreferrer");
      return;
    }

    if (useDockedComposer) {
      privateMessageLayout.scheduleSync();
    }

    readerState = {
      ...readerState,
      nativePostAction: {
        requestId,
        action: "private-message",
        postNumber,
        status: "success",
        message: "已打开私信窗口。"
      }
    };
    nativeActionRuntime.scheduleNativePostActionFeedbackDismiss(readerState.nativePostAction);
    renderCurrent({ loading: false, error: "" });
  });
}

function handleNativeReplySubmitted(
  event: CustomEvent<{
    topicId?: number;
    postNumber?: number;
    submittedPostNumber?: number;
    submittedUrl?: string;
  }>
): void {
  const topicId = Number(event.detail?.topicId);
  if (!settings?.enabled || !readerState.topicId || topicId !== readerState.topicId) {
    return;
  }

  const submittedPostNumber = positiveNumberOrNull(event.detail?.submittedPostNumber);
  const targetPostNumber = positiveNumberOrNull(event.detail?.postNumber) || readerState.nativePostAction?.postNumber || 1;
  const submittedUrl = absoluteLinuxDoUrl(event.detail?.submittedUrl);
  const activityId = nativeReplyActivityId(topicId, submittedPostNumber, submittedUrl);
  nativeActionRuntime.clearNativePostActionFeedbackTimer();
  readerState = {
    ...readerState,
    nativePostAction: {
      requestId: createLocalRequestId(),
      action: "reply",
      postNumber: targetPostNumber,
      status: "pending",
      message: "回复已发送，正在同步我的新回复。",
      fallbackUrl: submittedUrl
    }
  };
  renderCurrent({ loading: false, error: "" });
  nativeActionRuntime.markNativeReplySubmittedForRouteRestore(topicId);
  recordSubmittedReplyActivity(activityId, "syncing", "回复已发送，正在同步到 Reader。", {
    submittedPostNumber,
    submittedUrl,
    targetPostNumber
  });
  void syncSubmittedNativeReply({
    activityId,
    submittedPostNumber,
    submittedUrl,
    targetPostNumber,
    topicId
  });
}

async function syncSubmittedNativeReply({
  activityId,
  submittedPostNumber,
  submittedUrl,
  targetPostNumber,
  topicId
}: {
  activityId: string;
  submittedPostNumber: number | null;
  submittedUrl?: string;
  targetPostNumber: number;
  topicId: number;
}): Promise<void> {
  const topic = topicListRuntime.getTopicById(topicId);
  const previousData = readerState.data;
  if (!topic || !previousData || !submittedPostNumber) {
    setSubmittedReplyFallback(activityId, targetPostNumber, submittedPostNumber, submittedUrl);
    return;
  }

  if (previousData.posts.some((post) => post.postNumber === submittedPostNumber)) {
    setSubmittedReplySynced(activityId, previousData, [submittedPostNumber], targetPostNumber, submittedPostNumber, submittedUrl);
    return;
  }

  readerAbortController?.abort();
  readerAbortController = new AbortController();
  const controller = readerAbortController;
  readerState = {
    ...readerState,
    refreshing: true,
    refreshError: ""
  };
  renderCurrent({ loading: false, error: "" });

  try {
    const freshData = await fetchTopicReaderAtPost(topic, submittedPostNumber, controller.signal);
    if (readerState.topicId !== topicId) {
      return;
    }

    const merged = mergeSubmittedReaderReply(previousData, freshData, submittedPostNumber);
    if (!merged.freshPostNumbers.length) {
      setSubmittedReplyFallback(activityId, targetPostNumber, submittedPostNumber, submittedUrl);
      return;
    }

    setSubmittedReplySynced(
      activityId,
      merged.data,
      merged.freshPostNumbers,
      targetPostNumber,
      submittedPostNumber,
      submittedUrl
    );
    void syncLoadedReaderPosts(merged.data, controller.signal, new Set(merged.freshPostNumbers));
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    if (readerState.topicId === topicId) {
      setSubmittedReplyFallback(activityId, targetPostNumber, submittedPostNumber, submittedUrl);
    }
  } finally {
    if (readerAbortController === controller) {
      readerAbortController = null;
    }
  }
}

function setSubmittedReplySynced(
  activityId: string,
  data: TopicReaderData,
  freshPostNumbers: number[],
  targetPostNumber: number,
  submittedPostNumber: number | null,
  submittedUrl: string | undefined
): void {
  readerState = {
    ...readerState,
    data,
    refreshing: false,
    refreshError: "",
    freshPostNumbers,
    nativePostAction: {
      requestId: createLocalRequestId(),
      action: "reply",
      postNumber: submittedPostNumber || targetPostNumber,
      status: "success",
      message: "回复已同步到 Reader。"
    }
  };
  rememberReaderData(data);
  recordSubmittedReplyActivity(activityId, "synced", "回复已同步到 Reader。", {
    submittedPostNumber,
    submittedUrl,
    targetPostNumber
  });
  nativeActionRuntime.scheduleNativePostActionFeedbackDismiss(readerState.nativePostAction);
  renderCurrent({ loading: false, error: "" });
  scheduleReaderPostReveal(freshPostNumbers);
}

function setSubmittedReplyFallback(
  activityId: string,
  targetPostNumber: number,
  submittedPostNumber: number | null,
  submittedUrl: string | undefined
): void {
  readerState = {
    ...readerState,
    refreshing: false,
    nativePostAction: {
      requestId: createLocalRequestId(),
      action: "reply",
      postNumber: submittedPostNumber || targetPostNumber,
      status: "success",
      message: "回复已发送，暂时无法同步正文。",
      fallbackUrl: submittedUrl
    }
  };
  recordSubmittedReplyActivity(activityId, "sent", "回复已发送，可打开原生视图查看。", {
    submittedPostNumber,
    submittedUrl,
    targetPostNumber
  });
  nativeActionRuntime.scheduleNativePostActionFeedbackDismiss(readerState.nativePostAction);
  renderCurrent({ loading: false, error: "" });
}

function recordSubmittedReplyActivity(
  id: string,
  status: ReplyActivity["status"],
  message: string,
  {
    submittedPostNumber,
    submittedUrl,
    targetPostNumber
  }: {
    submittedPostNumber: number | null;
    submittedUrl?: string;
    targetPostNumber: number | null;
  }
): void {
  const activity = createReplyActivity(readerState.data, readerState.topicId, id, status, message, {
    submittedPostNumber,
    submittedUrl,
    targetPostNumber,
  });
  if (!activity) {
    return;
  }
  void recordReplyActivity(activity);
}

function handleNativePostAction(action: ReaderPostAction, postNumber: number): void {
  const reader = readerState.data;
  const post = reader?.posts.find((item) => item.postNumber === postNumber);
  if (!reader || !post) {
    return;
  }
  if (readerState.nativePostAction?.status === "pending") {
    return;
  }
  nativeActionRuntime.clearNativePostActionFeedbackTimer();

  const cooldownMessage = nativeActionRuntime.nativeWriteCooldownMessage(action, post.id);
  if (cooldownMessage) {
    nativeActionRuntime.setNativePostActionFeedback(action, postNumber, "timeout", cooldownMessage);
    return;
  }

  const useDockedComposer = action === "reply" && shouldDockNativePrivateMessage();
  const replaceExisting = false;
  if (useDockedComposer) {
    privateMessageLayout.activate();
  }
  if (action === "reply") {
    nativeActionRuntime.armNativeReplyRouteGuard(reader.id);
  }

  const requestId = createLocalRequestId();
  readerState = {
    ...readerState,
    nativePostAction: {
      requestId,
      action,
      postNumber,
      status: "pending",
      message: `${readerPostActionLabel(action)}处理中...`,
      replaceExisting
    }
  };
  renderCurrent({ loading: false, error: "" });

  void requestNativePostAction({
    action,
    topicId: reader.id,
    topicUrl: new URL(reader.url, window.location.origin).toString(),
    postUrl: new URL(post.url || reader.url, window.location.origin).toString(),
    postId: post.id,
    postNumber: post.postNumber,
    title: reader.title,
    username: post.author.username,
    avatarUrl: post.author.avatarUrl,
    canReply: post.actions.canReply ?? reader.actions.canReply,
    returnUrl: action === "reply" ? nativeReplyReturnUrl(window.location) : undefined,
    draftKey: reader.actions.draftKey,
    draftSequence: reader.actions.draftSequence,
    canLike: post.actions.canLike,
    liked: post.actions.liked,
    canBookmark: post.actions.canBookmark,
    bookmarked: post.actions.bookmarked,
    replaceExisting
  }).then((result) => {
    if (readerState.nativePostAction?.requestId !== requestId) {
      return;
    }

    if (useDockedComposer && result.ok) {
      privateMessageLayout.scheduleSync();
    } else if (useDockedComposer) {
      privateMessageLayout.deactivate();
    }

    const nextData = result.ok
      ? updateReaderDataAfterNativePostAction(readerState.data, action, postNumber, result)
      : readerState.data;
    nativeActionRuntime.updateNativeWriteCooldown(action, post.id, result.ok, result.status);
    if (nextData && nextData !== readerState.data) {
      rememberReaderData(nextData);
    }

    readerState = {
      ...readerState,
      data: nextData,
      nativePostAction: {
        requestId,
        action,
        postNumber,
        status: result.ok ? "success" : nativeResultStatusForReader(result.status),
        message: result.message || readerPostActionFallbackMessage(action),
        fallbackUrl: result.fallbackUrl
      }
    };
    nativeActionRuntime.scheduleNativePostActionFeedbackDismiss(readerState.nativePostAction);
    renderCurrent({ loading: false, error: "" });
  });
}

function handlePollVote(vote: ReaderPollVoteRequest): void {
  if (!readerState.data || readerState.refreshing) {
    return;
  }

  if (
    readerState.pollVote?.status === "pending" &&
    readerState.pollVote.postId === vote.postId &&
    readerState.pollVote.pollName === vote.pollName
  ) {
    return;
  }

  const controller = new AbortController();
  readerState = {
    ...readerState,
    refreshError: "",
    pollVote: {
      postId: vote.postId,
      pollName: vote.pollName,
      optionIds: [vote.optionId],
      status: "pending",
      message: "投票提交中...",
      poll: null
    }
  };
  renderCurrent({ loading: false, error: "" });

  void voteReaderPoll(
    {
      postId: vote.postId,
      pollName: vote.pollName,
      optionIds: [vote.optionId]
    },
    controller.signal
  )
    .then((result) => {
      if (!result.ok) {
        readerState = {
          ...readerState,
          pollVote: {
            postId: vote.postId,
            pollName: vote.pollName,
            optionIds: [vote.optionId],
            status: "error",
            message: "投票失败，请在原贴中重试。",
            poll: null
          }
        };
        renderCurrent({ loading: false, error: "" });
        return;
      }
      const selectedOptionIds = result.selectedOptionIds.length ? result.selectedOptionIds : [vote.optionId];
      readerState = {
        ...readerState,
        pollVote: {
          postId: vote.postId,
          pollName: vote.pollName,
          optionIds: selectedOptionIds,
          status: "success",
          message: "投票成功，已同步到原贴。",
          poll: result.poll
        }
      };
      renderCurrent({ loading: false, error: "" });
      void refreshReader();
    })
    .catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      readerState = {
        ...readerState,
        pollVote: {
          postId: vote.postId,
          pollName: vote.pollName,
          optionIds: [vote.optionId],
          status: "error",
          message: "投票失败，请在原贴中重试。",
          poll: null
        }
      };
      renderCurrent({ loading: false, error: "" });
    });
}

function updateReaderDataAfterNativePostAction(
  reader: TopicReaderData | null,
  action: ReaderPostAction,
  postNumber: number,
  result: NativePostActionResult
): TopicReaderData | null {
  if (!reader || !result.ok) {
    return reader;
  }
  if (action !== "like" && action !== "bookmark") {
    return reader;
  }
  return applyConfirmedReaderPostAction(reader, postNumber, action, result.acted ?? true);
}

function shouldDockNativePrivateMessage(): boolean {
  return Boolean(settings?.enabled) && Boolean(readerState.topicId);
}

function activeReaderSurface(): HTMLElement | null {
  return (
    shadowRoot?.querySelector<HTMLElement>(".ldcv-reader-pane .ldcv-reader-article") ||
    shadowRoot?.querySelector<HTMLElement>(".ldcv-reader-modal .ldcv-reader-article") ||
    null
  );
}

function updateReaderImageViewer(action: ReaderImageViewerAction): void {
  readerRuntime.updateImageViewer(action);
}

function readerAdjacent(direction: -1 | 1): void {
  if (!readerState.topicId) {
    return;
  }

  const nextTopic = topicListRuntime.topicAtOffset(readerState.topicId, direction);
  if (nextTopic) {
    void openReader(nextTopic.id);
  }
}

function retryReader(): void {
  readerRuntime.retry();
}

async function refreshReader({ revealFresh = false }: { revealFresh?: boolean } = {}): Promise<void> {
  if (readerState.creditViewTrackingPhase === "failed" && readerState.topicId) {
    const topic = topicListRuntime.snapshot.data?.topics.find((item) => item.id === readerState.topicId) ?? null;
    if (topic && topicViewTracking.retry(topic, readerState.creditViewTrackingPhase)) {
      return;
    }
  }

  await readerRuntime.refresh({ revealFresh });
}

function scheduleReaderPostReveal(postNumbers: readonly number[]): void {
  const targetRoot = shadowRoot;
  const postNumber = postNumbers[0];
  if (!targetRoot || !postNumber) {
    return;
  }

  const reveal = (): void => {
    if (targetRoot !== shadowRoot) {
      return;
    }

    revealReaderPost(targetRoot, postNumber);
  };

  window.requestAnimationFrame(() => {
    reveal();
    window.setTimeout(reveal, 80);
  });
}

function resetReaderState(): void {
  readerRuntime.reset();
}

function handleReaderKeydown(event: KeyboardEvent): void {
  if (!settings || isTextEntryEvent(event)) {
    return;
  }

  if (event.key === "Escape" && dismissTransientPanels()) {
    event.preventDefault();
    event.stopPropagation();
    renderCurrent({ loading: false, error: "" });
    return;
  }

  if (!readerState.topicId || !settings.enabled) {
    return;
  }

  if (readerState.imageViewer) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeReaderImage();
      return;
    }
    if (isScrollKey(event.key)) {
      event.preventDefault();
      event.stopPropagation();
    }
    return;
  }

  if (event.key === "Escape") {
    closeReaderWithMotion(shadowRoot, closeReader);
    return;
  }

  if (settings.layout !== "reader" && scrollModalReaderWithKey(event)) {
    return;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    readerAdjacent(-1);
    return;
  }

  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    readerAdjacent(1);
  }
}

function scrollModalReaderWithKey(event: KeyboardEvent): boolean {
  const scroller = shadowRoot?.querySelector<HTMLElement>(".ldcv-reader-modal .ldcv-reader-scroll");
  if (!scroller) {
    return false;
  }

  const pageStep = Math.max(Math.floor(scroller.clientHeight * 0.86), 120);
  const lineStep = 64;
  let nextTop: number | null = null;

  if (event.key === "ArrowUp") {
    nextTop = scroller.scrollTop - lineStep;
  } else if (event.key === "ArrowDown") {
    nextTop = scroller.scrollTop + lineStep;
  } else if (event.key === "PageUp") {
    nextTop = scroller.scrollTop - pageStep;
  } else if (event.key === "PageDown" || (event.key === " " && !event.shiftKey)) {
    nextTop = scroller.scrollTop + pageStep;
  } else if (event.key === " " && event.shiftKey) {
    nextTop = scroller.scrollTop - pageStep;
  } else if (event.key === "Home") {
    nextTop = 0;
  } else if (event.key === "End") {
    nextTop = scroller.scrollHeight;
  }

  if (nextTop === null) {
    return false;
  }

  event.preventDefault();
  event.stopPropagation();
  scroller.scrollTop = Math.min(Math.max(nextTop, 0), Math.max(scroller.scrollHeight - scroller.clientHeight, 0));
  return true;
}

export function isTextEntryEvent(event: KeyboardEvent): boolean {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [event.target];
  return path.some(isTextEntryTarget);
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function isScrollKey(key: string): boolean {
  return key === " " || key === "PageUp" || key === "PageDown" || key === "Home" || key === "End";
}

function setupLoadMoreObserver(): void {
  loadMoreObserver?.disconnect();
  loadMoreObserver = undefined;

  if (!shadowRoot || !settings.enabled || !topicListRuntime.hasData || isModalReaderOverlayActive()) {
    return;
  }

  const sentinel = shadowRoot.querySelector<HTMLElement>("[data-load-more-root]");
  if (!sentinel) {
    return;
  }

  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      const suppression = shouldSuppressLoadMoreIntersectionAtCurrentScroll(suppressedLoadMoreIntersectionScrollY);
      suppressedLoadMoreIntersectionScrollY = suppression.nextSuppressedScrollY;
      if (suppression.suppressed) {
        return;
      }
      topicListRuntime.handleLoadMoreIntersection(entries.some((entry) => entry.isIntersecting));
    },
    { root: null, rootMargin: loadMoreObserverRootMargin(settings.layout), threshold: 0.01 }
  );
  loadMoreObserver.observe(sentinel);
}

function scheduleLoadMoreVisibilityCheckAfterReaderClose(): void {
  window.setTimeout(() => {
    suppressedLoadMoreIntersectionScrollY = null;
    if (!loadMoreSentinelIntersectsPreloadMargin()) {
      return;
    }
    topicListRuntime.handleLoadMoreIntersection(true);
  }, 0);
}

function loadMoreSentinelIntersectsPreloadMargin(): boolean {
  if (!shadowRoot || !settings.enabled || !topicListRuntime.hasData || isModalReaderOverlayActive()) {
    return false;
  }

  const sentinel = shadowRoot.querySelector<HTMLElement>("[data-load-more-root]");
  if (!sentinel) {
    return false;
  }

  const rect = sentinel.getBoundingClientRect();
  return loadMoreRectIntersectsViewportMargin({
    rectTop: rect.top,
    rectBottom: rect.bottom,
    viewportHeight: window.innerHeight,
    rootMargin: loadMoreObserverRootMargin(settings.layout)
  });
}

function isModalReaderOverlayActive(): boolean {
  return Boolean(settings.enabled && settings.layout !== "reader" && readerState.topicId);
}

function isReaderOverlayLockActive(): boolean {
  return resolveReaderOverlayLockActive({
    settingsEnabled: settings.enabled,
    layout: settings.layout,
    readerTopicId: readerState.topicId,
    imageViewerActive: Boolean(readerState.imageViewer),
  });
}

function handleViewedTopicIdsStorageChange(nextIds: Set<number>): void {
  const missingLocalIds = subtractViewedTopicIds(localViewedTopicIds, nextIds);
  const maxIds = creditViewedTopicStorageMax();
  const queuedLocalIds = mergeViewedTopicIds(viewedTopicIdsInFlight, pendingViewedTopicIds, maxIds);
  const retryLocalIds = subtractViewedTopicIds(missingLocalIds, queuedLocalIds);
  if (retryLocalIds.size > 0) {
    pendingViewedTopicIds = mergeViewedTopicIds(pendingViewedTopicIds, retryLocalIds, maxIds);
    scheduleViewedTopicIdsPersist();
  }

  const merged = mergeViewedTopicIds(
    mergeViewedTopicIds(
      mergeViewedTopicIds(nextIds, localViewedTopicIds, maxIds),
      viewedTopicIdsInFlight,
      maxIds
    ),
    pendingViewedTopicIds,
    maxIds
  );
  if (viewedTopicIdsEqual(viewedTopicIds, merged)) {
    return;
  }

  viewedTopicIds = merged;
  renderCurrent({ loading: false, error: "" });
}

function scheduleViewedTopicIdsPersist(): void {
  if (viewedTopicIdsPersistTimer !== undefined) {
    window.clearTimeout(viewedTopicIdsPersistTimer);
  }
  viewedTopicIdsPersistTimer = window.setTimeout(() => {
    viewedTopicIdsPersistTimer = undefined;
    void flushViewedTopicIdsPersist();
  }, VIEWED_TOPIC_IDS_PERSIST_DEBOUNCE_MS);
}

function handleViewedTopicIdsFlush(): void {
  void flushViewedTopicIdsPersist();
}

async function flushViewedTopicIdsPersist(): Promise<void> {
  if (viewedTopicIdsPersistTimer !== undefined) {
    window.clearTimeout(viewedTopicIdsPersistTimer);
    viewedTopicIdsPersistTimer = undefined;
  }

  if (viewedTopicIdsPersistPromise) {
    await viewedTopicIdsPersistPromise;
  }

  if (pendingViewedTopicIds.size === 0) {
    return;
  }

  const idsToPersist = new Set(pendingViewedTopicIds);
  pendingViewedTopicIds.clear();
  const maxIds = creditViewedTopicStorageMax();
  viewedTopicIdsInFlight = mergeViewedTopicIds(viewedTopicIdsInFlight, idsToPersist, maxIds);
  const persistPromise = (async () => {
    try {
      const persisted = await mergeViewedTopicIdsStorage(
        idsToPersist,
        CREDIT_VIEWED_TOPICS_STORAGE_KEY,
        maxIds,
      );
      viewedTopicIdsInFlight = subtractViewedTopicIds(viewedTopicIdsInFlight, idsToPersist);
      const nextViewed = mergeViewedTopicIds(
        mergeViewedTopicIds(persisted, viewedTopicIdsInFlight, maxIds),
        pendingViewedTopicIds,
        maxIds
      );
      if (!viewedTopicIdsEqual(viewedTopicIds, nextViewed)) {
        viewedTopicIds = nextViewed;
      }
    } catch {
      viewedTopicIdsInFlight = subtractViewedTopicIds(viewedTopicIdsInFlight, idsToPersist);
      pendingViewedTopicIds = mergeViewedTopicIds(pendingViewedTopicIds, idsToPersist, maxIds);
    }
  })();
  viewedTopicIdsPersistPromise = persistPromise;

  try {
    await persistPromise;
  } finally {
    if (viewedTopicIdsPersistPromise === persistPromise) {
      viewedTopicIdsPersistPromise = null;
    }
  }

  if (pendingViewedTopicIds.size > 0) {
    scheduleViewedTopicIdsPersist();
  }
}

function subtractViewedTopicIds(current: ReadonlySet<number>, idsToRemove: Iterable<number>): Set<number> {
  const next = new Set(current);
  for (const id of idsToRemove) {
    next.delete(id);
  }
  return next;
}

function scheduleStickyOffsetUpdate(): void {
  if (stickyOffsetFrame !== undefined) {
    window.cancelAnimationFrame(stickyOffsetFrame);
  }
  stickyOffsetFrame = window.requestAnimationFrame(updateStickyOffset);
}

function updateStickyOffset(): void {
  stickyOffsetFrame = undefined;
  if (!rootHost?.isConnected) {
    return;
  }

  const topObstructionBottom = nativeNoticeHost.measureTopObstructionBottom();
  const offset = Math.max(READER_STICKY_GAP, topObstructionBottom + READER_STICKY_GAP);
  rootHost.style.setProperty("--ldcv-sticky-offset", `${Math.ceil(offset)}px`);
  nativeNoticeHost.syncCurrentChrome();
  nativeNoticeHost.updateDockPosition(topObstructionBottom);
  if (document.documentElement.classList.contains(PRIVATE_MESSAGE_LAYOUT_CLASS)) {
    privateMessageLayout.scheduleSync();
  }
}

function startRootConnectionObserver(): void {
  if (rootConnectionObserver) {
    return;
  }

  rootConnectionObserver = new MutationObserver(() => {
    if (!rootHost || rootHost.isConnected || !shouldPreserveRootDuringNativeReplyRestore()) {
      return;
    }

    ensureRoot();
    scheduleStickyOffsetUpdate();
  });
  rootConnectionObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

function captureNativeReplyRootFrame(): void {
  if (!rootHost?.isConnected) {
    return;
  }

  const rect = rootHost.getBoundingClientRect();
  if (rect.width <= 0) {
    return;
  }

  nativeReplyRootFrame = {
    top: roundRootFramePixel(rect.top),
    left: roundRootFramePixel(rect.left),
    width: roundRootFramePixel(rect.width)
  };
}

function applyNativeReplyRootFrame(parent: HTMLElement): void {
  if (!rootHost || !nativeReplyRootFrame) {
    return;
  }

  const parentRect = parent.getBoundingClientRect();
  const parentStyle = window.getComputedStyle(parent);
  const parentContentTop =
    parentRect.top + cssPixelValue(parentStyle.borderTopWidth) + cssPixelValue(parentStyle.paddingTop);
  const parentContentLeft =
    parentRect.left + cssPixelValue(parentStyle.borderLeftWidth) + cssPixelValue(parentStyle.paddingLeft);
  rootHost.style.marginTop = `${roundRootFramePixel(nativeReplyRootFrame.top - parentContentTop)}px`;
  rootHost.style.marginLeft = `${roundRootFramePixel(nativeReplyRootFrame.left - parentContentLeft)}px`;
  rootHost.style.width = `${nativeReplyRootFrame.width}px`;
}

function clearNativeReplyRootFrameStyle(): void {
  if (!rootHost) {
    return;
  }

  rootHost.style.removeProperty("margin-top");
  rootHost.style.removeProperty("margin-left");
  rootHost.style.removeProperty("width");
}

function roundRootFramePixel(value: number): number {
  return Math.round(value / ROOT_FRAME_PIXEL_PRECISION) * ROOT_FRAME_PIXEL_PRECISION;
}

function cssPixelValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ensureRoot(): void {
  const target = rootInsertionTarget({
    preserveWithoutList: shouldPreserveRootDuringNativeReplyRestore()
  });
  if (!target) {
    if (shouldPreserveRootDuringNativeReplyRestore()) {
      syncNativeReplyRootPreserveClass();
      return;
    }
    rootHost?.remove();
    rootHost = null;
    shadowRoot = null;
    return;
  }

  rootHost = document.getElementById(ROOT_ID) || rootHost || document.createElement("section");
  rootHost.id = ROOT_ID;
  rootHost.setAttribute("aria-label", "Linux.do card view");

  const before = target.before === rootHost ? rootHost.nextSibling : target.before;
  if (rootHost.parentElement !== target.parent || rootHost.nextSibling !== before) {
    target.parent.insertBefore(rootHost, before);
  }

  if (target.mode === "preserve") {
    nativeReplyFallbackRootActive = true;
    applyNativeReplyRootFrame(target.parent);
  } else {
    nativeReplyFallbackRootActive = false;
    clearNativeReplyRootFrameStyle();
    captureNativeReplyRootFrame();
  }
  syncNativeReplyRootPreserveClass();
  shadowRoot = rootHost.shadowRoot || rootHost.attachShadow({ mode: "open" });
}

function shouldPreserveRootDuringNativeReplyRestore(): boolean {
  const guard = nativeActionRuntime.routeGuard;
  return Boolean(guard && Date.now() <= Math.max(guard.expiresAt, guard.restoreUntil));
}

function syncNativeReplyRootPreserveClass(): void {
  window.clearTimeout(nativeReplyRootPreserveTimer);
  nativeReplyRootPreserveTimer = undefined;

  const preservingByGuard = shouldPreserveRootDuringNativeReplyRestore();
  document.documentElement.classList.toggle(
    NATIVE_REPLY_ROOT_PRESERVING_CLASS,
    nativeReplyFallbackRootActive || preservingByGuard
  );

  const routeGuard = nativeActionRuntime.routeGuard;
  if (!preservingByGuard || nativeReplyFallbackRootActive || !routeGuard) {
    return;
  }

  const preserveUntil = Math.max(routeGuard.expiresAt, routeGuard.restoreUntil);
  nativeReplyRootPreserveTimer = window.setTimeout(() => {
    nativeReplyRootPreserveTimer = undefined;
    syncNativeReplyRootPreserveClass();
  }, Math.max(0, preserveUntil - Date.now() + 1));
}

function removeActiveState({ keepTopicEnhancer = false }: { keepTopicEnhancer?: boolean } = {}): void {
  nativeActionRuntime.reset();
  window.clearTimeout(nativeReplyRootPreserveTimer);
  nativeReplyRootPreserveTimer = undefined;
  nativeReplyFallbackRootActive = false;
  nativeReplyRootFrame = null;
  activeTopicListRouteKey = "";
  resetReaderState();
  topicListRuntime.reset();
  loadMoreObserver?.disconnect();
  document.documentElement.classList.remove("ldcv-card-mode");
  document.documentElement.classList.remove(NATIVE_REPLY_ROOT_PRESERVING_CLASS);
  if (!keepTopicEnhancer) {
    unmountTopicPageEnhancer();
  }
  setReaderOverlayLock(false);
  rootHost?.remove();
  rootHost = null;
  shadowRoot = null;
}

function setReaderOverlayLock(locked: boolean): void {
  const root = document.documentElement;
  root.classList.toggle(READER_SCROLL_LOCK_CLASS, locked);
}
