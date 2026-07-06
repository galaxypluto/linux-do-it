import {
  fetchMoreReaderPosts,
  fetchReaderUserProfile,
  fetchSelectedReaderPosts,
  fetchTopicReader,
} from "../discourse/api";
import type { TopicCardData, TopicReaderData } from "../discourse/types";
import type { ExtensionSettings } from "../storage/settings";
import type { ReaderImageViewerAction, ReaderImageViewerState } from "../ui/imageViewer";
import { nextReaderImageViewerState } from "../ui/imageViewerState";
import type { ReaderModalOrigin, ReaderState } from "../ui/readerTypes";
import { sameUserPreviewAnchor, type ReaderUserPreviewState } from "../ui/userPreview";
import {
  emptyReaderState,
  mergeReaderRefreshBase,
  missingReaderPostIdsForRefresh,
  preserveCreditViewTrackingState,
} from "./readerState";

type ReaderRuntimeRenderRequest = {
  loading: boolean;
  error: string;
  preservePageAnchor?: boolean;
  preserveReaderScroll?: boolean;
};

type ReaderRuntimeDeps = {
  getSettings: () => ExtensionSettings;
  getReaderState: () => ReaderState;
  setReaderState: (updater: (state: ReaderState) => ReaderState) => void;
  getReaderAbortController: () => AbortController | null;
  setReaderAbortController: (controller: AbortController | null) => void;
  getReaderMoreAbortController: () => AbortController | null;
  setReaderMoreAbortController: (controller: AbortController | null) => void;
  getUserPreviewAbortController: () => AbortController | null;
  setUserPreviewAbortController: (controller: AbortController | null) => void;
  renderCurrent: (request: ReaderRuntimeRenderRequest) => void;
  getShadowRoot: () => ShadowRoot | null;
  getTopicById: (topicId: number) => TopicCardData | null;
  prepareTopicOpen: (topicId: number) => void;
  updateStickyOffset: () => void;
  cachedReaderData: (topicId: number) => TopicReaderData | null;
  rememberReaderData: (reader: TopicReaderData) => void;
  syncLoadedReaderPosts: (
    reader: TopicReaderData,
    signal?: AbortSignal,
    selectedPostNumbers?: ReadonlySet<number>,
  ) => Promise<boolean>;
  revealFreshPosts: (postNumbers: readonly number[]) => void;
  onReset: () => void;
  closeImageViewerWithMotion: () => boolean;
  onReaderTopicDismissed?: () => void;
  onReaderTopicDisplayed?: (topic: TopicCardData) => void;
};

export class ReaderRuntime {
  constructor(private readonly deps: ReaderRuntimeDeps) {}

  get snapshot(): ReaderState {
    return this.deps.getReaderState();
  }

  async loadMorePosts(): Promise<void> {
    const settings = this.deps.getSettings();
    const readerState = this.snapshot;
    if (!readerState.data || readerState.loading || readerState.loadingMore || !settings.enabled) {
      return;
    }

    this.deps.getReaderMoreAbortController()?.abort();
    const controller = new AbortController();
    this.deps.setReaderMoreAbortController(controller);
    const currentReaderData = readerState.data;
    const topicId = currentReaderData.id;
    this.deps.setReaderState((state) => ({
      ...state,
      loadingMore: true,
      loadMoreError: "",
    }));
    this.renderDefault();

    try {
      const data = await fetchMoreReaderPosts(
        currentReaderData,
        this.deps.getSettings().readerPostBatchSize,
        controller.signal,
      );
      if (this.snapshot.topicId !== topicId) {
        return;
      }

      const previousPostNumbers = new Set(currentReaderData.posts.map((post) => post.postNumber));
      const freshPostNumbers = data.posts
        .filter((post) => !previousPostNumbers.has(post.postNumber))
        .map((post) => post.postNumber);

      this.deps.setReaderState((state) => ({
        ...state,
        data,
        loadingMore: false,
        loadMoreError: "",
        freshPostNumbers,
      }));
      this.deps.rememberReaderData(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (this.snapshot.topicId !== topicId) {
        return;
      }

      this.deps.setReaderState((state) => ({
        ...state,
        loadingMore: false,
        loadMoreError: error instanceof Error ? error.message : "加载更多评论失败",
      }));
    } finally {
      if (this.canRenderTopic(topicId)) {
        this.renderDefault();
      }
    }
  }

  async open(
    topicId: number,
    { force = false, modalOrigin = null }: { force?: boolean; modalOrigin?: ReaderModalOrigin | null } = {},
  ): Promise<boolean> {
    const topic = this.deps.getTopicById(topicId);
    if (!topic || !this.deps.getSettings().enabled || !this.deps.getShadowRoot()) {
      return false;
    }

    this.deps.prepareTopicOpen(topicId);
    this.deps.updateStickyOffset();
    const previousTopicId = this.snapshot.topicId;
    if (previousTopicId !== topicId) {
      this.deps.onReaderTopicDismissed?.();
    }

    if (!force && this.snapshot.topicId === topicId) {
      if (this.snapshot.loading) {
        return true;
      }
      if (this.snapshot.data) {
        this.renderDefault();
        return true;
      }
    }

    const cachedReader = force ? null : this.deps.cachedReaderData(topicId);
    if (cachedReader) {
      this.deps.getReaderAbortController()?.abort();
      this.deps.getReaderMoreAbortController()?.abort();
      this.deps.setReaderAbortController(null);
      this.deps.setReaderMoreAbortController(null);
      this.replaceState({
        topicId,
        data: cachedReader,
        loading: false,
        refreshing: false,
        loadingMore: false,
        loadMoreError: "",
        refreshError: "",
        freshPostNumbers: [],
        error: "",
        imageViewer: null,
        userPreview: null,
        nativePostAction: null,
        pollVote: null,
        modalOrigin,
      });
      this.renderDefault();
      this.maybeScheduleCreditTopicView(topic);
      return true;
    }

    this.deps.getReaderAbortController()?.abort();
    const controller = new AbortController();
    this.deps.setReaderAbortController(controller);
    this.replaceState({
      topicId,
      data: this.snapshot.data?.id === topicId ? this.snapshot.data : null,
      loading: true,
      refreshing: false,
      loadingMore: false,
      loadMoreError: "",
      refreshError: "",
      freshPostNumbers: [],
      error: "",
      imageViewer: null,
      userPreview: null,
      nativePostAction: null,
      pollVote: null,
      modalOrigin,
    });
    this.renderDefault();

    try {
      const data = await fetchTopicReader(topic, controller.signal, { skipCache: force });
      if (this.snapshot.topicId !== topicId) {
        return false;
      }

      this.replaceState({
        topicId,
        data,
        loading: false,
        refreshing: false,
        loadingMore: false,
        loadMoreError: "",
        refreshError: "",
        freshPostNumbers: [],
        error: "",
        imageViewer: null,
        userPreview: null,
        nativePostAction: null,
        pollVote: null,
        modalOrigin: this.snapshot.modalOrigin ?? modalOrigin,
      });
      this.deps.rememberReaderData(data);
      this.maybeScheduleCreditTopicView(topic);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return false;
      }
      if (this.snapshot.topicId !== topicId) {
        return false;
      }

      this.replaceState({
        topicId,
        data: null,
        loading: false,
        refreshing: false,
        loadingMore: false,
        loadMoreError: "",
        refreshError: "",
        freshPostNumbers: [],
        error: error instanceof Error ? error.message : "无法读取完整讨论",
        imageViewer: null,
        userPreview: null,
        nativePostAction: null,
        pollVote: null,
        modalOrigin: this.snapshot.modalOrigin ?? modalOrigin,
      });
    } finally {
      if (this.canRenderTopic(topicId)) {
        this.renderDefault();
      }
    }

    return this.canRenderTopic(topicId);
  }

  openImage(image: ReaderImageViewerState): void {
    if (!this.snapshot.topicId) {
      return;
    }

    this.deps.setReaderState((state) => ({
      ...state,
      imageViewer: image,
    }));
    this.renderDefault();
  }

  closeImage(): void {
    if (!this.snapshot.imageViewer) {
      return;
    }

    this.deps.setReaderState((state) => ({
      ...state,
      imageViewer: null,
    }));
    if (!this.deps.closeImageViewerWithMotion()) {
      this.renderDefault();
    }
  }

  openUserPreview(preview: ReaderUserPreviewState): void {
    if (!this.snapshot.topicId || !preview.username) {
      return;
    }

    const samePreview =
      this.snapshot.userPreview?.username === preview.username &&
      this.snapshot.userPreview?.postNumber === preview.postNumber &&
      this.snapshot.userPreview?.anchorPostNumber === preview.anchorPostNumber &&
      this.snapshot.userPreview?.anchorType === preview.anchorType;

    this.deps.getUserPreviewAbortController()?.abort();
    this.deps.setUserPreviewAbortController(null);

    this.deps.setReaderState((state) => ({
      ...state,
      userPreview: samePreview
        ? null
        : {
            ...preview,
            loading: true,
            error: "",
            profile: null,
          },
    }));
    this.deps.renderCurrent({ loading: false, error: "", preserveReaderScroll: true });

    if (!samePreview) {
      void this.hydrateUserPreview(preview);
    }
  }

  closeUserPreview(): void {
    if (!this.snapshot.userPreview) {
      return;
    }

    this.deps.getUserPreviewAbortController()?.abort();
    this.deps.setUserPreviewAbortController(null);
    this.deps.setReaderState((state) => ({
      ...state,
      userPreview: null,
    }));
    this.deps.renderCurrent({ loading: false, error: "", preserveReaderScroll: true });
  }

  updateImageViewer(action: ReaderImageViewerAction): void {
    const viewer = this.snapshot.imageViewer;
    if (!viewer) {
      return;
    }

    this.deps.setReaderState((state) => ({
      ...state,
      imageViewer: nextReaderImageViewerState(viewer, action),
    }));
    this.renderDefault();
  }

  retry(): void {
    if (this.snapshot.topicId) {
      void this.open(this.snapshot.topicId, { force: true });
    }
  }

  async refresh({ revealFresh = false }: { revealFresh?: boolean } = {}): Promise<void> {
    const topicId = this.snapshot.topicId;
    const topic = topicId ? this.deps.getTopicById(topicId) : null;
    if (!topicId || !topic || !this.deps.getSettings().enabled || this.snapshot.loading || this.snapshot.refreshing) {
      return;
    }

    const previousData = this.snapshot.data;
    if (!previousData) {
      await this.open(topicId, { force: true });
      return;
    }

    this.deps.getReaderAbortController()?.abort();
    this.deps.getReaderMoreAbortController()?.abort();
    const controller = new AbortController();
    this.deps.setReaderAbortController(controller);
    this.deps.setReaderMoreAbortController(null);
    const previousPostNumbers = new Set(previousData.posts.map((post) => post.postNumber));
    this.deps.setReaderState((state) => ({
      ...state,
      refreshing: true,
      loadingMore: false,
      loadMoreError: "",
      refreshError: "",
      freshPostNumbers: [],
      error: "",
    }));
    this.renderDefault();

    try {
      let data = mergeReaderRefreshBase(await fetchTopicReader(topic, controller.signal, { skipCache: true }), previousData);
      const selectedPostIds = missingReaderPostIdsForRefresh(data, previousData);
      if (selectedPostIds.length) {
        data = await fetchSelectedReaderPosts(data, selectedPostIds, controller.signal);
      }
      if (this.snapshot.topicId !== topicId) {
        return;
      }

      const freshPostNumbers = data.posts
        .filter((post) => !post.isOriginalPost && !previousPostNumbers.has(post.postNumber))
        .map((post) => post.postNumber);

      this.deps.setReaderState((state) => ({
        ...state,
        topicId,
        data,
        loading: false,
        refreshing: false,
        loadingMore: false,
        loadMoreError: "",
        refreshError: "",
        freshPostNumbers,
        error: "",
      }));
      this.deps.rememberReaderData(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      if (this.snapshot.topicId !== topicId) {
        return;
      }

      this.deps.setReaderState((state) => ({
        ...state,
        data: previousData,
        loading: false,
        refreshing: false,
        loadingMore: false,
        loadMoreError: "",
        refreshError: error instanceof Error ? error.message : "刷新当前帖子失败",
        freshPostNumbers: [],
        error: "",
      }));
    } finally {
      if (this.deps.getReaderAbortController() === controller) {
        this.deps.setReaderAbortController(null);
      }
      if (this.canRenderTopic(topicId)) {
        this.renderDefault();
        if (revealFresh) {
          this.deps.revealFreshPosts(this.snapshot.freshPostNumbers);
        }
      }
    }
  }

  reset(): void {
    this.deps.getReaderAbortController()?.abort();
    this.deps.getReaderMoreAbortController()?.abort();
    this.deps.getUserPreviewAbortController()?.abort();
    this.deps.setReaderAbortController(null);
    this.deps.setReaderMoreAbortController(null);
    this.deps.setUserPreviewAbortController(null);
    this.deps.onReaderTopicDismissed?.();
    this.deps.onReset();
    this.replaceState(emptyReaderState());
  }

  private maybeScheduleCreditTopicView(topic: TopicCardData): void {
    if (!this.canRenderTopic(topic.id) || !this.snapshot.data) {
      return;
    }
    this.deps.onReaderTopicDisplayed?.(topic);
  }

  private async hydrateUserPreview(preview: ReaderUserPreviewState): Promise<void> {
    const controller = new AbortController();
    this.deps.setUserPreviewAbortController(controller);

    try {
      const profile = await fetchReaderUserProfile(
        preview.username,
        {
          name: preview.name,
          avatarUrl: preview.avatarUrl,
        },
        controller.signal,
      );
      this.updateHydratedUserPreview(preview, {
        loading: false,
        error: "",
        profile,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      this.updateHydratedUserPreview(preview, {
        loading: false,
        error: "用户信息暂时不可用",
        profile: null,
      });
    } finally {
      if (this.deps.getUserPreviewAbortController() === controller) {
        this.deps.setUserPreviewAbortController(null);
      }
    }
  }

  private updateHydratedUserPreview(
    source: ReaderUserPreviewState,
    patch: Pick<ReaderUserPreviewState, "loading" | "error" | "profile">,
  ): void {
    const activePreview = this.snapshot.userPreview;
    if (!activePreview || !sameUserPreviewAnchor(activePreview, source)) {
      return;
    }

    this.deps.setReaderState((state) => ({
      ...state,
      userPreview: state.userPreview
        ? {
            ...state.userPreview,
            ...patch,
          }
        : null,
    }));
    this.renderDefault();
  }

  private renderDefault(): void {
    this.deps.renderCurrent({ loading: false, error: "", preservePageAnchor: true });
  }

  private replaceState(nextState: ReaderState): void {
    this.deps.setReaderState((previous) => preserveCreditViewTrackingState(previous, nextState));
  }

  private canRenderTopic(topicId: number): boolean {
    return Boolean(this.deps.getShadowRoot() && this.deps.getSettings().enabled && this.snapshot.topicId === topicId);
  }
}
