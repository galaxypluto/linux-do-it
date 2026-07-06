import {
  endpointFromMoreTopicsUrl,
  fetchCurrentTopicList,
  fetchTopicList,
} from "../discourse/api";
import type { TopicCardData, TopicListData } from "../discourse/types";
import type { ExtensionSettings } from "../storage/settings";
import {
  consumeSameScrollLoadMoreSuppression,
  nextVisibleTopicCount,
  shouldHonorLoadMoreIntersection,
  shouldPreserveAppendPageAnchor,
  shouldScheduleAutomaticTopicReveal,
  visibleTopicCountForLayout,
} from "./progressiveTopics";
import {
  acknowledgeTopicEntering,
  buildApplyPendingRefreshResult,
  clearTopicFromVisualState,
  createEmptyTopicListVisualState,
  type TopicListNavigationRequest,
  withEnteringTopicIds,
} from "./newTopicApplyFlow";
import {
  detectNewTopics,
  mergeAppend,
  mergeLatest,
  mergePendingTopicMap,
  newestTopicCreatedAtMs,
} from "./topicListState";

const AUTO_REFRESH_MS = 60_000;

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export type TopicListRenderRequest = {
  loading: boolean;
  error: string;
  preservePageAnchor?: boolean;
};

export type TopicListRuntimeSnapshot = {
  data: TopicListData | null;
  loadingMore: boolean;
  updatedAt: string;
  pendingNewTopicCount: number;
  pendingNoticeExpanded: boolean;
  pendingNoticeMinimized: boolean;
  visibleTopicCount: number;
  newTopicIds: ReadonlySet<number>;
  enteringTopicIds: ReadonlySet<number>;
};

type ProgressiveTopicRenderOptions = {
  preservePageAnchorOnReveal?: boolean;
};

type TopicListRuntimeDependencies = {
  getSettings: () => ExtensionSettings;
  setCardMode: (enabled: boolean) => void;
  renderCurrent: (request: TopicListRenderRequest) => void;
  setLoadMoreLoadingState: (loading: boolean) => void;
  onResetReader: () => void;
  onBeforeApplyPendingRefresh: () => void;
  onPendingNoticeRootCleared: () => void;
  onScheduleNavigation: (request: TopicListNavigationRequest) => void;
  isModalReaderOverlayActive: () => boolean;
  canPollLatest: () => boolean;
};

export class TopicListRuntime {
  private abortController: AbortController | null = null;
  private currentData: TopicListData | null = null;
  private loadingMore = false;
  private lastUpdatedAt = "";
  private pendingLatestData: TopicListData | null = null;
  private pendingNewTopicMap = new Map<number, TopicCardData>();
  private pendingNewTopicCount = 0;
  private newTopicCreatedAfterMs = 0;
  private pendingNoticeExpanded = false;
  private pendingNoticeMinimized = false;
  private visualState = createEmptyTopicListVisualState();
  private visibleTopicCount = 0;
  private autoRefreshTimer: number | undefined;
  private progressiveTopicTimer: number | undefined;
  private progressiveTopicTimerKind: "idle" | "timeout" | undefined;
  private progressiveRevealPreservePageAnchor = false;

  constructor(private readonly deps: TopicListRuntimeDependencies) {}

  get snapshot(): TopicListRuntimeSnapshot {
    return {
      data: this.currentData,
      loadingMore: this.loadingMore,
      updatedAt: this.lastUpdatedAt,
      pendingNewTopicCount: this.pendingNewTopicCount,
      pendingNoticeExpanded: this.pendingNoticeExpanded,
      pendingNoticeMinimized: this.pendingNoticeMinimized,
      visibleTopicCount: this.visibleTopicCount,
      newTopicIds: this.visualState.newTopicIds,
      enteringTopicIds: this.visualState.enteringTopicIds,
    };
  }

  get pendingTopics(): TopicCardData[] {
    return Array.from(this.pendingNewTopicMap.values());
  }

  get hasPendingNoticeExpanded(): boolean {
    return this.pendingNoticeExpanded;
  }

  get hasData(): boolean {
    return Boolean(this.currentData);
  }

  get hasMoreTopics(): boolean {
    return Boolean(this.currentData?.moreTopicsUrl);
  }

  acknowledgeRender(): void {
    this.visualState = acknowledgeTopicEntering(this.visualState);
  }

  getTopicById(topicId: number): TopicCardData | null {
    return this.currentData?.topics.find((item) => item.id === topicId) ?? this.pendingNewTopicMap.get(topicId) ?? null;
  }

  topicAtOffset(topicId: number, direction: -1 | 1): TopicCardData | null {
    if (!this.currentData) {
      return null;
    }

    const index = this.currentData.topics.findIndex((topic) => topic.id === topicId);
    return this.currentData.topics[index + direction] ?? null;
  }

  prepareTopicOpen(topicId: number): void {
    if (this.pendingNewTopicMap.has(topicId)) {
      this.pendingNoticeExpanded = false;
      this.pendingNoticeMinimized = false;
    }
    this.visualState = clearTopicFromVisualState(this.visualState, topicId);
  }

  reset(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.stopAutoRefresh();
    this.resetProgressiveTopicRendering();
    this.currentData = null;
    this.loadingMore = false;
    this.visualState = createEmptyTopicListVisualState();
    this.clearPendingLatest();
  }

  stopAutoRefresh(): void {
    window.clearInterval(this.autoRefreshTimer);
    this.autoRefreshTimer = undefined;
  }

  async refreshData({ reset }: { reset: boolean }): Promise<void> {
    this.abortController?.abort();
    this.abortController = new AbortController();

    if (reset) {
      this.currentData = null;
      this.resetProgressiveTopicRendering();
      this.visualState = createEmptyTopicListVisualState();
      this.clearPendingLatest();
      this.newTopicCreatedAfterMs = 0;
      this.deps.onResetReader();
    }

    this.deps.renderCurrent({ loading: !this.currentData, error: "" });

    try {
      const data = await fetchCurrentTopicList(this.abortController.signal);
      this.currentData = reset || !this.currentData ? data : mergeLatest(this.currentData, data);
      this.startProgressiveTopicRendering(this.currentData, reset || this.visibleTopicCount <= 0);
      this.clearPendingLatest();
      if (this.currentData) {
        this.updateNewTopicCreatedBaseline(this.currentData);
      }
      this.lastUpdatedAt = "刚刚更新";
      this.deps.setCardMode(true);
      this.deps.renderCurrent({ loading: false, error: "" });
      this.startAutoRefresh();
    } catch (error) {
      this.deps.setCardMode(false);
      this.deps.renderCurrent({
        loading: false,
        error: error instanceof Error ? error.message : "无法读取 Linux.do 话题列表",
      });
    }
  }

  async loadMoreTopics(): Promise<void> {
    const settings = this.deps.getSettings();
    if (!this.currentData || this.loadingMore || !settings.enabled) {
      return;
    }

    const nextEndpoint = endpointFromMoreTopicsUrl(this.currentData.moreTopicsUrl);
    if (!nextEndpoint) {
      this.deps.renderCurrent({ loading: false, error: "" });
      return;
    }

    const existingTopicIds = new Set(this.currentData.topics.map((topic) => topic.id));
    this.loadingMore = true;
    if (settings.layout === "masonry") {
      this.deps.setLoadMoreLoadingState(true);
    } else {
      this.deps.renderCurrent({ loading: false, error: "" });
    }

    let errorMessage = "";
    try {
      const nextPage = await fetchTopicList(nextEndpoint);
      this.currentData = mergeAppend(this.currentData, nextPage);
      this.visualState = withEnteringTopicIds(
        this.visualState,
        this.currentData.topics.filter((topic) => !existingTopicIds.has(topic.id)).map((topic) => topic.id),
      );
      this.startProgressiveTopicRendering(this.currentData, false);
      if (settings.layout !== "reader") {
        this.prepareNextVisibleTopicBatch();
      }
      this.lastUpdatedAt = "刚刚加载更多";
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "加载更多话题失败";
    } finally {
      this.loadingMore = false;
      this.deps.renderCurrent({
        loading: false,
        error: errorMessage,
        preservePageAnchor: shouldPreserveAppendPageAnchor(settings.layout),
      });
    }
  }

  async pollLatest(): Promise<void> {
    const settings = this.deps.getSettings();
    if (
      !settings.enabled ||
      !settings.newTopicNoticeEnabled ||
      document.hidden ||
      !this.deps.canPollLatest()
    ) {
      return;
    }

    try {
      const latest = await fetchCurrentTopicList();
      if (!this.currentData) {
        this.currentData = latest;
        this.startProgressiveTopicRendering(this.currentData, true);
        this.updateNewTopicCreatedBaseline(this.currentData);
        this.lastUpdatedAt = "刚刚更新";
        this.deps.renderCurrent({ loading: false, error: "" });
        return;
      }

      const detectedTopics = detectNewTopics(
        this.currentData,
        latest,
        this.pendingNewTopicMap,
        this.newTopicCreatedAfterMs,
      );
      if (detectedTopics.length > 0) {
        const hadPending = this.pendingNewTopicMap.size > 0;
        this.pendingLatestData = latest;
        this.addPendingNewTopics(detectedTopics);
        this.pendingNewTopicCount = this.pendingNewTopicMap.size;
        if (!hadPending) {
          this.pendingNoticeExpanded = false;
          this.pendingNoticeMinimized = false;
        }
        this.deps.renderCurrent({ loading: false, error: "", preservePageAnchor: true });
      } else if (this.pendingNewTopicMap.size > 0) {
        this.pendingLatestData = latest;
      }
    } catch {
      // Manual refresh still surfaces hard failures.
    }
  }

  applyPendingRefresh(): void {
    const applyResult = buildApplyPendingRefreshResult({
      currentData: this.currentData,
      latestData: this.pendingLatestData,
      pendingTopics: this.pendingTopics,
      layout: this.deps.getSettings().layout,
    });
    if (!applyResult) {
      return;
    }

    this.currentData = applyResult.data;
    this.visualState = applyResult.visualState;
    this.startProgressiveTopicRendering(
      this.currentData,
      this.visibleTopicCount <= 0,
      applyResult.revealDelayMs,
      applyResult.navigation?.kind === "page-top"
        ? { preservePageAnchorOnReveal: false }
        : undefined,
    );
    this.deps.onBeforeApplyPendingRefresh();
    this.clearPendingLatest();
    if (this.currentData) {
      this.updateNewTopicCreatedBaseline(this.currentData);
    }
    this.lastUpdatedAt = applyResult.lastUpdatedAt;
    this.deps.renderCurrent({ loading: false, error: "" });
    if (applyResult.navigation) {
      this.deps.onScheduleNavigation(applyResult.navigation);
    }
  }

  togglePendingPreview(): void {
    if (!this.pendingLatestData) {
      return;
    }

    if (this.pendingNoticeMinimized) {
      this.pendingNoticeMinimized = false;
      this.pendingNoticeExpanded = true;
    } else {
      this.pendingNoticeExpanded = !this.pendingNoticeExpanded;
    }
    this.deps.renderCurrent({ loading: false, error: "", preservePageAnchor: true });
  }

  minimizePendingNotice(): void {
    if (!this.pendingLatestData) {
      return;
    }

    this.pendingNoticeExpanded = false;
    this.pendingNoticeMinimized = true;
    this.deps.renderCurrent({ loading: false, error: "", preservePageAnchor: true });
  }

  dismissPendingPreviewWithoutRender(): boolean {
    if (!this.pendingNoticeExpanded && !this.pendingNoticeMinimized) {
      return false;
    }

    this.pendingNoticeExpanded = false;
    this.pendingNoticeMinimized = false;
    return true;
  }

  handleLoadMoreIntersection(isIntersecting: boolean): void {
    const settings = this.deps.getSettings();
    if (!shouldHonorLoadMoreIntersection({ layout: settings.layout, isIntersecting })) {
      return;
    }

    if (this.hasHiddenVisibleTopics()) {
      this.revealMoreVisibleTopics();
      return;
    }
    if (this.currentData?.moreTopicsUrl) {
      void this.loadMoreTopics();
    }
  }

  startAutoRefresh(): void {
    const settings = this.deps.getSettings();
    this.stopAutoRefresh();
    if (!settings.enabled || !settings.newTopicNoticeEnabled) {
      return;
    }
    this.autoRefreshTimer = window.setInterval(() => {
      void this.pollLatest();
    }, settings.newTopicCheckIntervalSeconds * 1000 || AUTO_REFRESH_MS);
  }

  restartProgressiveRendering(reset: boolean): void {
    this.startProgressiveTopicRendering(this.currentData, reset);
  }

  clearPendingLatest(): void {
    this.pendingLatestData = null;
    this.pendingNewTopicCount = 0;
    this.pendingNewTopicMap = new Map();
    this.pendingNoticeExpanded = false;
    this.pendingNoticeMinimized = false;
    this.deps.onPendingNoticeRootCleared();
  }

  private addPendingNewTopics(topics: TopicCardData[]): void {
    this.pendingNewTopicMap = mergePendingTopicMap(this.pendingNewTopicMap, topics);
  }

  private startProgressiveTopicRendering(
    data: TopicListData | null,
    reset: boolean,
    deferRevealMs = 0,
    options?: ProgressiveTopicRenderOptions,
  ): void {
    if (!data) {
      this.resetProgressiveTopicRendering();
      return;
    }

    const settings = this.deps.getSettings();
    const total = data.topics.length;
    this.visibleTopicCount = visibleTopicCountForLayout(settings.layout, total, this.visibleTopicCount, reset);
    this.progressiveRevealPreservePageAnchor =
      options?.preservePageAnchorOnReveal ?? shouldPreserveAppendPageAnchor(settings.layout);
    this.scheduleProgressiveTopicReveal(deferRevealMs);
  }

  private hasHiddenVisibleTopics(): boolean {
    return Boolean(this.currentData && this.visibleTopicCount < this.currentData.topics.length);
  }

  private revealMoreVisibleTopics(): void {
    const settings = this.deps.getSettings();
    if (!this.prepareNextVisibleTopicBatch()) {
      return;
    }

    this.deps.renderCurrent({
      loading: false,
      error: "",
      preservePageAnchor: this.progressiveRevealPreservePageAnchor,
    });
    this.scheduleProgressiveTopicReveal();
  }

  private prepareNextVisibleTopicBatch(): boolean {
    if (!this.currentData || !this.hasHiddenVisibleTopics()) {
      return false;
    }

    const previousCount = this.visibleTopicCount;
    const nextCount = nextVisibleTopicCount(previousCount, this.currentData.topics.length);
    if (nextCount <= this.visibleTopicCount) {
      return false;
    }

    this.visualState = withEnteringTopicIds(
      this.visualState,
      this.currentData.topics.slice(previousCount, nextCount).map((topic) => topic.id),
    );
    this.visibleTopicCount = nextCount;
    return true;
  }

  private scheduleProgressiveTopicReveal(delayMs = 0): void {
    this.cancelProgressiveTopicReveal();
    if (!this.hasHiddenVisibleTopics()) {
      return;
    }

    if (this.deps.isModalReaderOverlayActive()) {
      return;
    }

    if (!shouldScheduleAutomaticTopicReveal(this.deps.getSettings().layout)) {
      return;
    }

    if (delayMs > 0) {
      this.progressiveTopicTimerKind = "timeout";
      this.progressiveTopicTimer = window.setTimeout(() => {
        this.progressiveTopicTimer = undefined;
        this.progressiveTopicTimerKind = undefined;
        this.revealMoreVisibleTopics();
      }, delayMs);
      return;
    }

    const idleWindow = window as IdleWindow;
    if (idleWindow.requestIdleCallback) {
      this.progressiveTopicTimerKind = "idle";
      this.progressiveTopicTimer = idleWindow.requestIdleCallback(() => {
        this.progressiveTopicTimer = undefined;
        this.progressiveTopicTimerKind = undefined;
        this.revealMoreVisibleTopics();
      }, { timeout: 500 });
      return;
    }

    this.progressiveTopicTimerKind = "timeout";
    this.progressiveTopicTimer = window.setTimeout(() => {
      this.progressiveTopicTimer = undefined;
      this.progressiveTopicTimerKind = undefined;
      this.revealMoreVisibleTopics();
    }, 80);
  }

  private cancelProgressiveTopicReveal(): void {
    if (this.progressiveTopicTimer === undefined) {
      return;
    }

    if (this.progressiveTopicTimerKind === "idle") {
      (window as IdleWindow).cancelIdleCallback?.(this.progressiveTopicTimer);
    } else {
      window.clearTimeout(this.progressiveTopicTimer);
    }
    this.progressiveTopicTimer = undefined;
    this.progressiveTopicTimerKind = undefined;
  }

  private resetProgressiveTopicRendering(): void {
    this.cancelProgressiveTopicReveal();
    this.visibleTopicCount = 0;
    this.progressiveRevealPreservePageAnchor = false;
  }

  private updateNewTopicCreatedBaseline(data: TopicListData): void {
    const newestCreatedAt = newestTopicCreatedAtMs(data.topics);
    if (newestCreatedAt > this.newTopicCreatedAfterMs) {
      this.newTopicCreatedAfterMs = newestCreatedAt;
    }
  }
}

export function shouldSuppressLoadMoreIntersectionAtCurrentScroll(
  suppressedLoadMoreIntersectionScrollY: number | null,
): { suppressed: boolean; nextSuppressedScrollY: number | null } {
  return consumeSameScrollLoadMoreSuppression(suppressedLoadMoreIntersectionScrollY, window.scrollY);
}
