import type {
  TopicCardData,
  TopicListData
} from "../discourse/types";
import { applyMasonry, scheduleMasonry } from "../layout/masonry";
import { masonryCardTopicSelector, observeLayout } from "../layout/observers";
import type { CardLayout, CommentSortOrder, ExtensionSettings } from "../storage/settings";
import { normalizeSettings } from "../storage/settings";
import styles from "../styles/content.css?inline";
import { cardTemplate } from "./cards";
import {
  floatingPendingNoticeTemplate,
  renderFloatingPendingNotices,
  unmountFloatingPendingNotices
} from "./floatingPendingNotice";
import { escapeHtml } from "./html";
import {
  IMAGE_VIEWER_SUPPRESS_CLOSE_ATTRIBUTE,
  bindImageViewerPan,
  imageViewerItemFromElement,
  imageViewerItems,
  isImageViewerImageHit,
  normalizeImageViewerAction,
  readerImageViewerTemplate,
  type ReaderImageViewerAction,
  type ReaderImageViewerState
} from "./imageViewer";
import { imageViewerActionFromWheel } from "./imageViewerState";
import { icons } from "./icons";
import {
  nativePendingNoticeTemplate,
  renderNativePendingNotices,
  unmountNativePendingNotices
} from "./nativePendingNotice";
import {
  profileUrlForUsername,
  readerLoaderTemplate,
  type ReaderModalPresentation
} from "./readerTemplates";
import type { ReaderModalOrigin, ReaderPollVoteFeedback, ReaderPostAction, ReaderState } from "./readerTypes";
import { renderReactReaderModal, unmountReactReaderModal } from "./react/reader/renderReaderModal";
import { renderReactReaderPane, unmountReactReaderPane } from "./react/reader/renderReaderPane";
import { renderSettingsPanels, settingsPanelTemplate, unmountSettingsPanels } from "./settingsPanel";
import {
  renderTopicLoadMore,
  setTopicLoadMoreLoadingState,
  topicLoadMoreTemplate,
  unmountTopicLoadMore,
  type TopicLoadMoreState
} from "./topicLoadMore";
import {
  renderToolbarActions,
  toolbarActionsTemplate,
  unmountToolbarActions
} from "./toolbarActions";
import {
  renderToolbarPendingNotices,
  toolbarPendingTemplate,
  unmountToolbarPendingNotices
} from "./toolbarPendingNotice";
import type { ReaderUserPreviewState } from "./userPreview";

export type { ReaderImageViewerAction, ReaderImageViewerItem, ReaderImageViewerState } from "./imageViewer";
export type { NativeComposerAction, ReaderPostAction, ReaderState } from "./readerTypes";
export type { ReaderUserPreviewState } from "./userPreview";

interface RenderOptions {
  root: ShadowRoot;
  data: TopicListData | null;
  settings: ExtensionSettings;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  updatedAt: string;
  pendingNewTopicCount: number;
  pendingNewTopics: TopicCardData[];
  pendingNoticeExpanded: boolean;
  pendingNoticeMinimized: boolean;
  useNativePendingNotice?: boolean;
  allowFloatingPendingNotice?: boolean;
  visibleTopicCount?: number;
  newTopicIds?: ReadonlySet<number>;
  enteringTopicIds?: ReadonlySet<number>;
  hasMore: boolean;
  reader: ReaderState;
  viewedTopicIds: ReadonlySet<number>;
  justReadTopicIds: ReadonlySet<number>;
  onRefresh: () => void;
  onApplyPendingRefresh: () => void;
  onTogglePendingPreview: () => void;
  onMinimizePendingNotice: () => void;
  onDismissPendingPreview?: () => void;
  onLoadMore: () => void;
  onOpenTopic: (topicId: number, origin?: ReaderModalOrigin | null) => void;
  onReaderAdjacent: (direction: -1 | 1) => void;
  onRefreshReader: () => void;
  onLoadMoreReaderPosts: () => void;
  onRetryReader: () => void;
  onCloseReader: () => void;
  onReaderBackdropClick: () => void;
  onOpenReaderImage: (image: ReaderImageViewerState) => void;
  onImageViewerAction: (action: ReaderImageViewerAction) => void;
  onCloseReaderImage: () => void;
  onOpenUserPreview: (preview: ReaderUserPreviewState) => void;
  onCloseUserPreview: () => void;
  onOpenPrivateMessage: () => void;
  onNativePostAction: (action: ReaderPostAction, postNumber: number) => void;
  onPollVote: (vote: ReaderPollVoteRequest) => void;
  onCommentSortChange: (sortOrder: CommentSortOrder) => void;
  onSettingsChange: (settings: ExtensionSettings) => void;
}

export interface ReaderPollVoteRequest {
  postId: number;
  pollName: string;
  optionId: string;
}

let cleanupLayoutObserver: (() => void) | undefined;
let settingsPanelOpen = false;
const boundLoadMoreButtons = new WeakSet<HTMLElement>();
const topicCardClickDelegatedRoots = new WeakSet<ShadowRoot | HTMLElement>();
const topicCardClickCallbacks = new WeakMap<
  ShadowRoot | HTMLElement,
  (topicId: number, origin?: ReaderModalOrigin | null) => void
>();
const settingsPanelAnimations = new WeakMap<HTMLElement, Animation>();
const commentContentAnimations = new WeakMap<HTMLElement, Animation>();
const closingReaderBackdrops = new WeakSet<HTMLElement>();
const readerModalFingerprints = new WeakMap<ShadowRoot, string>();
const backgroundFingerprints = new WeakMap<ShadowRoot, string>();
const readerCardStateFingerprints = new WeakMap<ShadowRoot, string>();
const boundReaderBackdrops = new WeakSet<HTMLElement>();
const boundReaderDismissRoots = new WeakSet<ShadowRoot | HTMLElement>();
let readerTouchY: number | null = null;

const ACCORDION_MOTION_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const MORPH_MOTION_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const HOVER_CARD_MOTION_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const SETTINGS_PANEL_MOTION_MS = 190;
const COMMENT_EXPAND_MOTION_MS = 240;
const COMMENT_COLLAPSE_MOTION_MS = 190;
const READER_CLOSE_MOTION_MS = 180;
const HOVER_CARD_MOTION_MS = 260;
const IMAGE_VIEWER_MORPH_MOTION_MS = 260;
const IMAGE_VIEWER_CLOSE_MOTION_MS = 140;
const MASONRY_APPEND_STABILIZE_MS = 560;

interface MorphRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const READER_CONTROL_BOUNDARY_SELECTOR = [
  "[data-reader-comment-search]",
  "[data-reader-comment-search-clear]",
  ".ldcv-reader-op-filter",
  "[data-reader-only-op]",
  "[data-action='toggle-comment']",
  "[data-comment-sort]"
].join(",");
const READER_CONTROL_BOUNDARY_EVENTS = [
  "pointerdown",
  "mousedown",
  "mouseup",
  "click",
  "keydown",
  "keyup",
  "keypress",
  "beforeinput",
  "input",
  "change"
] as const;
const READER_PROSE_BOUNDARY_EVENTS = ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "selectstart"] as const;

const TRANSIENT_DETAIL_SELECTOR = "details.ldcv-toolbar-menu, details.ldcv-native-reader";
const TRANSIENT_PANEL_PATH_SELECTOR = [
  ".ldcv-toolbar-menu",
  ".ldcv-toolbar-popover",
  ".ldcv-reader-trigger",
  ".ldcv-native-reader",
  ".ldcv-native-reader__trigger",
  ".ldcv-native-reader__menu",
  ".ldcv-native-notice",
  ".ldcv-native-notice__trigger",
  ".ldcv-native-notice__menu",
  ".ldcv-update-float"
].join(",");

export function renderApp(options: RenderOptions): void {
  const { root, data, settings, loading, loadingMore, error } = options;
  const enteringTopicIds = options.enteringTopicIds ?? new Set<number>();
  syncEnteringCardClasses(root, enteringTopicIds);
  const modalPresentation = readerModalPresentation(root, settings, options.reader);
  const readerModalFingerprint = reactReaderModalFingerprint(data, settings, options.reader);
  const backgroundFingerprint = renderBackgroundFingerprint(options, enteringTopicIds);
  const allowModalOnlyPatch =
    isModalOnlyBackgroundRender(options, enteringTopicIds) || hasModalReaderOverlayContext(root, settings, options.reader);
  if (patchClosedModalReaderOnly(options, backgroundFingerprint, allowModalOnlyPatch)) {
    syncReaderModalFingerprint(root, null);
    return;
  }
  if (
    patchModalImageViewerOnly(options, readerModalFingerprint, backgroundFingerprint, allowModalOnlyPatch, {
      onImageViewerAction: options.onImageViewerAction,
      onCloseReaderImage: options.onCloseReaderImage
    })
  ) {
    patchReaderCardStates(root, options.reader.topicId, options.viewedTopicIds, options.justReadTopicIds);
    syncReaderModalFingerprint(root, readerModalFingerprint);
    return;
  }

  if (patchStableModalReaderOnly(options, readerModalFingerprint, backgroundFingerprint, allowModalOnlyPatch)) {
    patchReaderCardStates(root, options.reader.topicId, options.viewedTopicIds, options.justReadTopicIds);
    syncReaderModalFingerprint(root, readerModalFingerprint);
    return;
  }
  if (patchModalReaderOnly(options, modalPresentation, readerModalFingerprint, backgroundFingerprint, allowModalOnlyPatch)) {
    patchReaderCardStates(root, options.reader.topicId, options.viewedTopicIds, options.justReadTopicIds);
    syncReaderModalFingerprint(root, readerModalFingerprint);
    return;
  }

  if (patchReaderPaneOnly(options, backgroundFingerprint, allowModalOnlyPatch)) {
    return;
  }

  if (isPendingNoticeOnlyChange(options, backgroundFingerprints.get(root) ?? null)) {
    if (patchPendingNoticeOnly(options)) {
      syncBackgroundFingerprint(root, backgroundFingerprint);
      return;
    }
  }
  const masonryAppendPlacements =
    settings.layout === "masonry" && enteringTopicIds.size > 0
      ? captureMasonryCardPlacements(root, enteringTopicIds)
      : null;
  const preservedImageViewerBackground =
    settings.layout === "reader" ? detachImageViewerBackground(root, options.reader) : null;
  const preservedReactReaderModalHost = preservedImageViewerBackground
    ? null
    : detachStableReactReaderModalHost(root, readerModalFingerprint);
  const preservedReactReaderPaneHost = preservedImageViewerBackground
    ? null
    : detachReactReaderPaneHost(root, settings);
  const preservedModalBackground = preservedImageViewerBackground
    ? null
    : detachModalBackground(root, settings, options.reader);
  const useNativePendingNotice =
    (options.useNativePendingNotice ?? false) ||
    Boolean(preservedImageViewerBackground?.hadNativeControls) ||
    Boolean(preservedModalBackground?.hadNativeControls);
  if (!preservedImageViewerBackground && !preservedReactReaderModalHost) {
    unmountReactReaderModal(root);
  }
  cleanupLayoutObserver?.();
  cleanupLayoutObserver = undefined;
  unmountFloatingPendingNotices(root);
  unmountTopicLoadMore(root);
  unmountToolbarActions(root);
  unmountSettingsPanels(root);
  unmountToolbarPendingNotices(root);
  
  if (!preservedReactReaderPaneHost) {
    unmountReactReaderPane(root);
  }

  root.innerHTML = `<style>${styles}</style>${appTemplate(
    data,
    settings,
    loading,
    loadingMore,
    error,
    options.updatedAt,
    options.pendingNewTopicCount,
    options.pendingNewTopics,
    options.pendingNoticeExpanded,
    options.pendingNoticeMinimized,
    useNativePendingNotice,
    options.allowFloatingPendingNotice ?? true,
    options.hasMore,
    options.reader,
    options.viewedTopicIds,
    options.justReadTopicIds,
    options.newTopicIds ?? new Set(),
    enteringTopicIds,
    options.visibleTopicCount,
    settingsPanelOpen
  )}`;
  syncReaderCardStateFingerprint(root, options.reader.topicId, options.viewedTopicIds, options.justReadTopicIds);
  restoreMasonryCardPlacements(root, masonryAppendPlacements);
  restoreReactReaderModalHost(root, preservedReactReaderModalHost);
  restoreReactReaderPaneHost(root, preservedReactReaderPaneHost);
  if (!preservedImageViewerBackground && !preservedReactReaderModalHost) {
    renderReactReaderModal({
      root,
      reader: options.reader,
      topics: data?.topics ?? [],
      settings,
      presentation: modalPresentation,
      privateMessageComposeHost: isPrivateMessageComposeHost(root),
      onCloseReader: options.onCloseReader,
      onReaderBackdropClick: options.onReaderBackdropClick,
      onRefreshReader: options.onRefreshReader,
      onReaderAdjacent: options.onReaderAdjacent,
      onNativePostAction: options.onNativePostAction,
      onOpenUserPreview: options.onOpenUserPreview,
      onCloseUserPreview: options.onCloseUserPreview,
      onOpenReaderImage: options.onOpenReaderImage,
      onCloseReaderImage: options.onCloseReaderImage,
      onLoadMoreReaderPosts: options.onLoadMoreReaderPosts
    });
  }
  restoreModalBackground(root, preservedModalBackground);
  restoreImageViewerBackground(root, preservedImageViewerBackground);
  renderFloatingPendingNotices(root, options.pendingNewTopics);
  if (!preservedImageViewerBackground) {
    renderTopicLoadMore(root);
    renderToolbarActions(root, settings, settingsPanelOpen);
    renderSettingsPanels(root, settings, settingsPanelOpen);
    renderToolbarPendingNotices(root, options.pendingNewTopicCount, options.pendingNoticeExpanded);
  }
  // Render pane (list layout) via React if the pane host exists
  if (settings.layout === "reader") {
    renderReactReaderPane({
      root,
      reader: options.reader,
      topics: data?.topics ?? [],
      settings,
      onClose: options.onCloseReader,
      onOpenUserPreview: options.onOpenUserPreview,
      onCloseUserPreview: options.onCloseUserPreview,
      onRefreshReader: options.onRefreshReader,
      onReaderAdjacent: options.onReaderAdjacent,
      onNativePostAction: options.onNativePostAction,
      onOpenReaderImage: options.onOpenReaderImage,
      onLoadMoreReaderPosts: options.onLoadMoreReaderPosts
    });
  }
  if (preservedImageViewerBackground) {
    bindImageViewerActions(root, {
      onImageViewerAction: options.onImageViewerAction,
      onCloseReaderImage: options.onCloseReaderImage
    });
  } else {
    bindActions(options, { skipReaderModalBindings: Boolean(preservedReactReaderModalHost) });
  }
  syncReaderModalFingerprint(root, readerModalFingerprint);
  syncBackgroundFingerprint(root, backgroundFingerprint);

  const backgroundFrozen =
    Boolean(preservedImageViewerBackground) ||
    Boolean(preservedModalBackground && settings.layout !== "reader" && options.reader.topicId);
  if (!backgroundFrozen) {
    const masonryOptions = masonryAppendPlacements ? { cardSelector: ".ldcv-card.is-entering" } : undefined;
    let observedMasonryOptions: Parameters<typeof scheduleMasonry>[1] = masonryOptions;
    cleanupLayoutObserver = observeLayout(root, (trigger) => {
      if (trigger?.kind === "card") {
        scheduleMasonry(root, { cardSelector: masonryCardTopicSelector(trigger.card) });
        return;
      }
      scheduleMasonry(root, trigger?.kind === "full" ? { remeasureAll: true } : observedMasonryOptions);
    });
    if (!preservedModalBackground) {
      applyMasonry(root, masonryOptions);
      scheduleMasonry(root, masonryOptions);
      if (masonryAppendPlacements) {
        window.setTimeout(() => {
          observedMasonryOptions = undefined;
          scheduleMasonry(root);
        }, MASONRY_APPEND_STABILIZE_MS);
      }
    }
  }
}

export function setLoadMoreLoadingState(root: ShadowRoot, loadingMore: boolean): void {
  setTopicLoadMoreLoadingState(root, loadingMore);
}

export function closeTransientPanels(root: ShadowRoot | HTMLElement | null): boolean {
  let changed = false;
  root?.querySelectorAll<HTMLDetailsElement>(`${TRANSIENT_DETAIL_SELECTOR}[open]`).forEach((details) => {
    details.removeAttribute("open");
    changed = true;
  });
  if (settingsPanelOpen) {
    settingsPanelOpen = false;
    changed = true;
  }
  syncSettingsPanelState(root);
  return changed;
}

export function hasOpenTransientPanels(root: ShadowRoot | HTMLElement | null): boolean {
  return Boolean(settingsPanelOpen || root?.querySelector(`${TRANSIENT_DETAIL_SELECTOR}[open]`));
}

export function eventPathContainsTransientPanel(path: EventTarget[]): boolean {
  return path.some((node) => node instanceof Element && Boolean(node.closest(TRANSIENT_PANEL_PATH_SELECTOR)));
}

interface PreservedImageViewerBackground {
  shell: HTMLElement;
  hadNativeControls: boolean;
}

interface PreservedReactReaderModalHost {
  host: HTMLElement;
}

interface PreservedModalBackground {
  grid: HTMLElement;
  loadMore: HTMLElement | null;
  hadNativeControls: boolean;
}

function detachImageViewerBackground(root: ShadowRoot, reader: ReaderState): PreservedImageViewerBackground | null {
  const hasImageViewer =
    Boolean(reader.imageViewer) ||
    Boolean(root.querySelector("[data-image-viewer-backdrop]:not([data-image-viewer-closing='true'])"));
  if (!hasImageViewer) {
    return null;
  }

  const shell = root.querySelector<HTMLElement>(".ldcv-shell");
  if (!shell) {
    return null;
  }

  const hadNativeControls = shell.classList.contains("has-native-controls");
  shell.remove();
  return { shell, hadNativeControls };
}

function restoreImageViewerBackground(root: ShadowRoot, preserved: PreservedImageViewerBackground | null): void {
  if (!preserved) {
    return;
  }

  const nextShell = root.querySelector<HTMLElement>(".ldcv-shell");
  if (nextShell) {
    nextShell.replaceWith(preserved.shell);
    return;
  }

  const style = root.querySelector("style");
  if (style) {
    style.after(preserved.shell);
    return;
  }

  root.prepend(preserved.shell);
}

function renderBackgroundFingerprint(options: RenderOptions, enteringTopicIds: ReadonlySet<number>): string {
  return JSON.stringify({
    data: options.data
      ? {
          topics: options.data.topics.map((topic) => ({
            id: topic.id,
            title: topic.title,
            excerpt: topic.excerpt,
            thumbnailUrl: topic.thumbnailUrl,
            category: topic.category,
            tags: topic.tags,
            stats: topic.stats,
            dates: topic.dates,
            flags: topic.flags
          })),
          moreTopicsUrl: options.data.moreTopicsUrl
        }
      : null,
    settings: {
      enabled: options.settings.enabled,
      layout: options.settings.layout,
      density: options.settings.density,
      newTopicNoticeEnabled: options.settings.newTopicNoticeEnabled,
      topicUrlView: options.settings.topicUrlView,
    },
    loading: options.loading,
    loadingMore: options.loadingMore,
    error: options.error,
    updatedAt: options.updatedAt,
    pendingNewTopicCount: options.pendingNewTopicCount,
    pendingNewTopics: options.pendingNewTopics.map((topic) => topic.id),
    pendingNoticeExpanded: options.pendingNoticeExpanded,
    pendingNoticeMinimized: options.pendingNoticeMinimized,
    useNativePendingNotice: options.useNativePendingNotice ?? false,
    allowFloatingPendingNotice: options.allowFloatingPendingNotice ?? true,
    hasMore: options.hasMore,
    newTopicIds: Array.from(options.newTopicIds ?? []),
    enteringTopicIds: Array.from(enteringTopicIds),
    visibleTopicCount: options.visibleTopicCount,
    settingsPanelOpen
  });
}

function syncBackgroundFingerprint(root: ShadowRoot, fingerprint: string): void {
  backgroundFingerprints.set(root, fingerprint);
}

function isModalOnlyBackgroundRender(options: RenderOptions, enteringTopicIds: ReadonlySet<number>): boolean {
  return (
    !options.loading &&
    !options.loadingMore &&
    !options.error &&
    enteringTopicIds.size === 0 &&
    options.pendingNewTopicCount === 0 &&
    !options.pendingNoticeExpanded &&
    !options.pendingNoticeMinimized
  );
}

function hasModalReaderOverlayContext(root: ShadowRoot, settings: ExtensionSettings, reader: ReaderState): boolean {
  return (
    settings.layout !== "reader" &&
    (Boolean(reader.topicId) || Boolean(root.querySelector("[data-react-reader-modal-host], [data-reader-backdrop]")))
  );
}

function canPatchModalWithoutBackgroundRender(
  options: RenderOptions,
  fingerprint: string,
  allowStaleFingerprint: boolean
): boolean {
  const { root, settings } = options;
  if (settings.layout === "reader") {
    return false;
  }
  if (backgroundFingerprints.get(root) !== fingerprint && !allowStaleFingerprint) {
    return false;
  }
  return Boolean(root.querySelector(`.ldcv-grid[data-card-grid="${settings.layout}"]`));
}

function patchModalReaderOnly(
  options: RenderOptions,
  presentation: ReaderModalPresentation,
  readerModalFingerprint: string | null,
  backgroundFingerprint: string,
  allowStaleBackgroundFingerprint: boolean
): boolean {
  const { root, data, settings, reader } = options;
  if (
    !reader.topicId ||
    !readerModalFingerprint ||
    !canPatchModalWithoutBackgroundRender(options, backgroundFingerprint, allowStaleBackgroundFingerprint)
  ) {
    return false;
  }

  let host = root.querySelector<HTMLElement>("[data-react-reader-modal-host]");
  if (!host) {
    host = document.createElement("div");
    host.dataset.reactReaderModalHost = "";
    root.append(host);
  }
  if (host.parentNode !== root) {
    return false;
  }

  renderReactReaderModal({
    root,
    reader,
    topics: data?.topics ?? [],
    settings,
    presentation,
    privateMessageComposeHost: isPrivateMessageComposeHost(root),
    onCloseReader: options.onCloseReader,
    onReaderBackdropClick: options.onReaderBackdropClick,
    onRefreshReader: options.onRefreshReader,
    onReaderAdjacent: options.onReaderAdjacent,
    onNativePostAction: options.onNativePostAction,
    onOpenUserPreview: options.onOpenUserPreview,
    onCloseUserPreview: options.onCloseUserPreview,
    onOpenReaderImage: options.onOpenReaderImage,
    onCloseReaderImage: options.onCloseReaderImage,
    onLoadMoreReaderPosts: options.onLoadMoreReaderPosts
  });
  bindReaderModalActions(options);
  return true;
}

function patchClosedModalReaderOnly(
  options: RenderOptions,
  backgroundFingerprint: string,
  allowStaleBackgroundFingerprint: boolean
): boolean {
  const { root, reader, viewedTopicIds, justReadTopicIds } = options;
  if (
    reader.topicId ||
    !canPatchModalWithoutBackgroundRender(options, backgroundFingerprint, allowStaleBackgroundFingerprint)
  ) {
    return false;
  }

  const host = root.querySelector<HTMLElement>("[data-react-reader-modal-host]");
  const backdrop = root.querySelector<HTMLElement>("[data-reader-backdrop]");
  if (!host && !backdrop) {
    return false;
  }

  const topicId = Number(backdrop?.querySelector<HTMLElement>(".ldcv-reader-article[data-reader-topic-id]")?.dataset.readerTopicId);
  unmountReactReaderModal(root);
  readerModalFingerprints.delete(root);
  host?.remove();
  if (!host) {
    backdrop?.remove();
  }
  patchReaderCardStates(root, null, viewedTopicIds, justReadTopicIds);
  return true;
}

function patchStableModalReaderOnly(
  options: RenderOptions,
  readerModalFingerprint: string | null,
  backgroundFingerprint: string,
  allowStaleBackgroundFingerprint: boolean
): boolean {
  const { root } = options;
  if (!readerModalFingerprint) {
    return false;
  }
  if (!canPatchModalWithoutBackgroundRender(options, backgroundFingerprint, allowStaleBackgroundFingerprint)) {
    return false;
  }
  if (readerModalFingerprints.get(root) !== readerModalFingerprint) {
    return false;
  }
  return Boolean(root.querySelector("[data-react-reader-modal='true']"));
}

function patchModalImageViewerOnly(
  renderOptions: RenderOptions,
  readerModalFingerprint: string | null,
  backgroundFingerprint: string,
  allowStaleBackgroundFingerprint: boolean,
  options: {
    onImageViewerAction: (action: ReaderImageViewerAction) => void;
    onCloseReaderImage: () => void;
  }
): boolean {
  const { root, settings, reader } = renderOptions;
  if (settings.layout === "reader" || !reader.topicId || !readerModalFingerprint) {
    return false;
  }
  if (!canPatchModalWithoutBackgroundRender(renderOptions, backgroundFingerprint, allowStaleBackgroundFingerprint)) {
    return false;
  }
  if (readerModalFingerprints.get(root) !== readerModalFingerprint) {
    return false;
  }
  if (!root.querySelector("[data-react-reader-modal='true']")) {
    return false;
  }

  const existingBackdrop = root.querySelector<HTMLElement>("[data-image-viewer-backdrop]");
  if (!reader.imageViewer) {
    if (!existingBackdrop) {
      return false;
    }
    existingBackdrop.remove();
    return true;
  }

  const template = document.createElement("template");
  template.innerHTML = readerImageViewerTemplate(reader.imageViewer).trim();
  const nextBackdrop = template.content.firstElementChild;
  if (!(nextBackdrop instanceof HTMLElement)) {
    return false;
  }

  if (existingBackdrop) {
    existingBackdrop.replaceWith(nextBackdrop);
  } else {
    root.append(nextBackdrop);
  }
  bindImageViewerActions(root, options);
  return true;
}

function patchReaderPaneOnly(
  options: RenderOptions,
  backgroundFingerprint: string,
  allowStaleBackgroundFingerprint: boolean
): boolean {
  const { root, data, settings, reader } = options;
  if (settings.layout !== "reader") {
    return false;
  }

  if (backgroundFingerprints.get(root) !== backgroundFingerprint && !allowStaleBackgroundFingerprint) {
    return false;
  }

  if (!root.querySelector(".ldcv-reader__list")) {
    return false;
  }
  const host = root.querySelector<HTMLElement>("[data-react-reader-pane-host]");
  if (!host) {
    return false;
  }

  renderReactReaderPane({
    root,
    reader,
    topics: data?.topics ?? [],
    settings,
    onClose: options.onCloseReader,
    onOpenUserPreview: options.onOpenUserPreview,
    onCloseUserPreview: options.onCloseUserPreview,
    onRefreshReader: options.onRefreshReader,
    onReaderAdjacent: options.onReaderAdjacent,
    onNativePostAction: options.onNativePostAction,
    onOpenReaderImage: options.onOpenReaderImage,
    onLoadMoreReaderPosts: options.onLoadMoreReaderPosts
  });

  patchReaderCardStates(root, reader.topicId, options.viewedTopicIds, options.justReadTopicIds);

  const existingBackdrop = root.querySelector<HTMLElement>("[data-image-viewer-backdrop]");
  if (!reader.imageViewer) {
    if (existingBackdrop) {
      existingBackdrop.remove();
    }
  } else {
    const template = document.createElement("template");
    template.innerHTML = readerImageViewerTemplate(reader.imageViewer).trim();
    const nextBackdrop = template.content.firstElementChild;
    if (nextBackdrop instanceof HTMLElement) {
      if (existingBackdrop) {
        existingBackdrop.replaceWith(nextBackdrop);
      } else {
        root.append(nextBackdrop);
      }
      bindImageViewerActions(root, options);
    }
  }

  bindReaderModalActions(options);

  return true;
}

function syncEnteringCardClasses(root: ShadowRoot | HTMLElement, enteringTopicIds: ReadonlySet<number>): void {
  root.querySelectorAll<HTMLElement>(".ldcv-card.is-entering[data-topic-id]").forEach((card) => {
    const topicId = Number(card.dataset.topicId);
    if (!Number.isFinite(topicId) || !enteringTopicIds.has(topicId)) {
      card.classList.remove("is-entering");
      card.style.removeProperty("--ldcv-enter-delay");
    }
  });
}

function patchReaderCardStates(
  root: ShadowRoot,
  activeTopicId: number | null,
  viewedTopicIds: ReadonlySet<number>,
  justReadTopicIds: ReadonlySet<number>
): void {
  const fingerprint = readerCardStateFingerprint(activeTopicId, viewedTopicIds, justReadTopicIds);
  if (readerCardStateFingerprints.get(root) === fingerprint) {
    return;
  }

  root.querySelectorAll<HTMLElement>(".ldcv-card[data-topic-id]").forEach((card) => {
    const topicId = Number(card.dataset.topicId);
    if (!Number.isFinite(topicId)) {
      return;
    }

    const isSelected = topicId === activeTopicId;
    card.classList.toggle("is-selected", isSelected);

    const isViewed = viewedTopicIds.has(topicId);
    card.classList.toggle("is-viewed", isViewed);
    card.classList.toggle("is-just-read", isViewed && justReadTopicIds.has(topicId));

    const status = card.querySelector<HTMLElement>(".ldcv-card__status");
    if (status) {
      let badge = status.querySelector<HTMLElement>(".ldcv-state");
      if (isSelected) {
        if (!badge) {
          badge = document.createElement("span");
          status.appendChild(badge);
        }
        badge.className = "ldcv-state is-reading";
        badge.textContent = "正在阅读";
      } else if (isViewed) {
        if (!badge) {
          badge = document.createElement("span");
          status.appendChild(badge);
        }
        badge.className = "ldcv-state is-viewed";
        badge.textContent = "已读";
      } else if (badge) {
        badge.remove();
      }
    }
  });
  readerCardStateFingerprints.set(root, fingerprint);
}

function syncReaderCardStateFingerprint(
  root: ShadowRoot,
  activeTopicId: number | null,
  viewedTopicIds: ReadonlySet<number>,
  justReadTopicIds: ReadonlySet<number>
): void {
  readerCardStateFingerprints.set(root, readerCardStateFingerprint(activeTopicId, viewedTopicIds, justReadTopicIds));
}

function readerCardStateFingerprint(
  activeTopicId: number | null,
  viewedTopicIds: ReadonlySet<number>,
  justReadTopicIds: ReadonlySet<number>
): string {
  return [
    activeTopicId ?? "",
    Array.from(viewedTopicIds).join(","),
    Array.from(justReadTopicIds).join(",")
  ].join("|");
}

function detachStableReactReaderModalHost(
  root: ShadowRoot,
  nextFingerprint: string | null
): PreservedReactReaderModalHost | null {
  if (!nextFingerprint || readerModalFingerprints.get(root) !== nextFingerprint) {
    return null;
  }

  const host = root.querySelector<HTMLElement>("[data-react-reader-modal-host]");
  if (!host || !host.querySelector("[data-react-reader-modal='true']")) {
    return null;
  }

  host.remove();
  return { host };
}

function restoreReactReaderModalHost(root: ShadowRoot, preserved: PreservedReactReaderModalHost | null): void {
  if (!preserved) {
    return;
  }

  const nextHost = root.querySelector<HTMLElement>("[data-react-reader-modal-host]");
  if (nextHost) {
    nextHost.replaceWith(preserved.host);
    return;
  }

  root.append(preserved.host);
}

interface PreservedReactReaderPaneHost {
  host: HTMLElement;
}

function detachReactReaderPaneHost(root: ShadowRoot, settings: ExtensionSettings): PreservedReactReaderPaneHost | null {
  if (settings.layout !== "reader" || !settings.enabled) {
    return null;
  }
  const host = root.querySelector<HTMLElement>("[data-react-reader-pane-host]");
  if (!host) {
    return null;
  }
  host.remove();
  return { host };
}

function restoreReactReaderPaneHost(root: ShadowRoot, preserved: PreservedReactReaderPaneHost | null): void {
  if (!preserved) {
    return;
  }

  const nextHost = root.querySelector<HTMLElement>("[data-react-reader-pane-host]");
  if (nextHost) {
    nextHost.replaceWith(preserved.host);
  } else {
    root.append(preserved.host);
  }
}

function syncReaderModalFingerprint(root: ShadowRoot, fingerprint: string | null): void {
  if (!fingerprint) {
    readerModalFingerprints.delete(root);
    return;
  }

  readerModalFingerprints.set(root, fingerprint);
}

function detachModalBackground(
  root: ShadowRoot,
  settings: ExtensionSettings,
  reader: ReaderState
): PreservedModalBackground | null {
  if (settings.layout === "reader") {
    return null;
  }

  if (!reader.topicId) {
    return null;
  }

  const grid = root.querySelector<HTMLElement>(".ldcv-grid");
  if (!grid || grid.dataset.cardGrid !== settings.layout) {
    return null;
  }

  const hadNativeControls = root.querySelector<HTMLElement>(".ldcv-shell")?.classList.contains("has-native-controls") ?? false;
  const loadMore = root.querySelector<HTMLElement>("[data-load-more-root]");
  grid.remove();
  loadMore?.remove();
  return { grid, loadMore, hadNativeControls };
}

function restoreModalBackground(root: ShadowRoot, preserved: PreservedModalBackground | null): void {
  if (!preserved) {
    return;
  }

  const nextGrid = root.querySelector<HTMLElement>(".ldcv-grid");
  nextGrid?.replaceWith(preserved.grid);

  const nextLoadMore = root.querySelector<HTMLElement>("[data-load-more-root]");
  if (nextLoadMore && preserved.loadMore) {
    nextLoadMore.replaceWith(preserved.loadMore);
  } else if (nextLoadMore && !preserved.loadMore) {
    nextLoadMore.remove();
  } else if (!nextLoadMore && preserved.loadMore) {
    preserved.grid.after(preserved.loadMore);
  }
}

function captureMasonryCardPlacements(
  root: ShadowRoot,
  enteringTopicIds: ReadonlySet<number>
): Map<number, string> | null {
  const grid = root.querySelector<HTMLElement>(".ldcv-grid[data-card-grid='masonry']");
  if (!grid) {
    return null;
  }

  const placements = new Map<number, string>();
  grid.querySelectorAll<HTMLElement>(".ldcv-card[data-topic-id]").forEach((card) => {
    const topicId = Number(card.dataset.topicId);
    const gridRowEnd = card.style.getPropertyValue("grid-row-end");
    if (Number.isFinite(topicId) && !enteringTopicIds.has(topicId) && gridRowEnd) {
      placements.set(topicId, gridRowEnd);
    }
  });

  return placements.size > 0 ? placements : null;
}

function restoreMasonryCardPlacements(root: ShadowRoot, placements: ReadonlyMap<number, string> | null): void {
  if (!placements) {
    return;
  }

  const grid = root.querySelector<HTMLElement>(".ldcv-grid[data-card-grid='masonry']");
  if (!grid) {
    return;
  }

  grid.querySelectorAll<HTMLElement>(".ldcv-card[data-topic-id]").forEach((card) => {
    const topicId = Number(card.dataset.topicId);
    const gridRowEnd = Number.isFinite(topicId) ? placements.get(topicId) : undefined;
    if (gridRowEnd) {
      card.style.setProperty("grid-row-end", gridRowEnd);
    }
  });
}

function appTemplate(
  data: TopicListData | null,
  settings: ExtensionSettings,
  loading: boolean,
  loadingMore: boolean,
  error: string,
  updatedAt: string,
  pendingNewTopicCount: number,
  pendingNewTopics: TopicCardData[],
  pendingNoticeExpanded: boolean,
  pendingNoticeMinimized: boolean,
  useNativePendingNotice: boolean,
  allowFloatingPendingNotice: boolean,
  hasMore: boolean,
  reader: ReaderState,
  viewedTopicIds: ReadonlySet<number>,
  justReadTopicIds: ReadonlySet<number>,
  newTopicIds: ReadonlySet<number>,
  enteringTopicIds: ReadonlySet<number>,
  visibleTopicCount: number | undefined,
  settingsOpen: boolean
): string {
  const topicCount = data?.topics.length ?? 0;
  const currentViewLabel = settings.enabled ? layoutLabel(settings.layout) : "原始";
  return `
    <section class="ldcv-shell ${settings.density === "compact" ? "is-compact" : ""} ${
      settings.layout === "reader" ? "is-reader" : ""
    } ${useNativePendingNotice ? "has-native-controls" : ""} ${pendingNewTopicCount > 0 ? "has-pending-notice" : ""}">
      <div class="ldcv-toolbar" role="toolbar" aria-label="Linux.do card view toolbar">
        <details class="ldcv-toolbar-menu">
          <summary class="ldcv-reader-trigger" title="阅读器控制" aria-label="阅读器控制">
            <span class="ldcv-reader-trigger__icon">${icons.reader}</span>
            <span>阅读</span>
            <em>${currentViewLabel}</em>
          </summary>
          <div class="ldcv-toolbar-popover" role="group" aria-label="阅读器控制">
            <div class="ldcv-toolbar-popover__head">
              <strong>Linux.do 阅读器</strong>
              <span>${loading ? "正在读取话题" : `${topicCount} 个话题${updatedAt ? ` · ${updatedAt}` : ""}`}</span>
            </div>
            ${toolbarPendingTemplate(pendingNewTopicCount, pendingNoticeExpanded)}
            ${toolbarActionsTemplate(settings, settingsOpen, "toolbar")}
            ${settingsPanelTemplate(settings, settingsOpen)}
          </div>
        </details>
      </div>
      ${error ? `<div class="ldcv-banner" role="status">${escapeHtml(error)}</div>` : ""}
      ${
      loading
          ? loadingTemplate()
          : data && data.topics.length > 0
            ? cardsTemplate(
                data.topics,
                settings,
                loadingMore,
                hasMore,
                reader,
                viewedTopicIds,
                justReadTopicIds,
                newTopicIds,
                enteringTopicIds,
                visibleTopicCount
              )
            : emptyTemplate()
      }
    </section>
    ${
      pendingNewTopicCount > 0 && allowFloatingPendingNotice && !useNativePendingNotice
        ? floatingPendingNoticeTemplate(pendingNewTopicCount, pendingNewTopics, pendingNoticeExpanded, pendingNoticeMinimized)
        : ""
    }
    ${settings.layout !== "reader" && reader.topicId ? reactReaderModalHostTemplate() : ""}
    ${reader.imageViewer ? readerImageViewerTemplate(reader.imageViewer) : ""}
    ${nativeReplyLoadingTemplate(reader)}
  `;
}

function nativeReplyLoadingTemplate(reader: ReaderState): string {
  const feedback = reader.nativePostAction;
  if (
    !feedback ||
    (feedback.action !== "reply" && feedback.action !== "private-message") ||
    feedback.status !== "pending" ||
    feedback.replaceExisting
  ) {
    return "";
  }

  const isPrivateMessage = feedback.action === "private-message";
  const windowLabel = isPrivateMessage ? "私信" : "回复";
  return `
    <aside class="ldcv-native-reply-loader" role="status" aria-live="polite" aria-label="正在打开 Linux.do ${windowLabel}窗口">
      ${readerLoaderTemplate({
        mode: "loading",
        command: "Linux wait it",
        title: `正在打开${windowLabel}窗口`,
        description: "正在交给 Linux.do 原生编辑器"
      })}
    </aside>
  `;
}

function layoutLabel(layout: CardLayout): string {
  if (layout === "masonry") {
    return "瀑布";
  }
  if (layout === "reader") {
    return "列表";
  }
  return "卡片";
}

export interface PendingNoticeOptions {
  count: number;
  topics: TopicCardData[];
  expanded: boolean;
  onTogglePendingPreview: () => void;
  onApplyPendingRefresh: () => void;
  onOpenTopic: (topicId: number) => void;
  onDismissPendingPreview?: () => void;
}

export function renderNativePendingNotice(root: ShadowRoot, options: PendingNoticeOptions): void {
  unmountNativePendingNotices(root);
  unmountToolbarActions(root);
  unmountSettingsPanels(root);
  unmountToolbarPendingNotices(root);
  root.innerHTML = `<style>${nativePendingNoticeStyles}</style>${nativePendingNoticeTemplate(
    options.count,
    options.topics,
    options.expanded
  )}`;
  renderNativePendingNotices(root, options.topics);
  bindPendingNoticeActions(root, options);
}

export interface NativeTopControlsOptions extends PendingNoticeOptions {
  settings: ExtensionSettings;
  topicCount: number;
  loading: boolean;
  updatedAt: string;
  onRefresh: () => void;
  onSettingsChange: (settings: ExtensionSettings) => void;
}

export function renderNativeTopControls(root: ShadowRoot, options: NativeTopControlsOptions): void {
  unmountNativePendingNotices(root);
  unmountToolbarActions(root);
  unmountSettingsPanels(root);
  unmountToolbarPendingNotices(root);
  root.innerHTML = `<style>${nativePendingNoticeStyles}</style>${nativeTopControlsTemplate(options)}`;
  renderNativePendingNotices(root, options.topics);
  renderToolbarActions(root, options.settings, settingsPanelOpen);
  renderSettingsPanels(root, options.settings, settingsPanelOpen);
  bindPendingNoticeActions(root, options);
  bindTopControlActions(root, {
    settings: options.settings,
    onRefresh: options.onRefresh,
    onSettingsChange: options.onSettingsChange,
    onDismissPendingPreview: options.onDismissPendingPreview
  });
  bindTransientDetailActions(root, options.onDismissPendingPreview);
  bindSettingsControls(root, options.settings, options.onSettingsChange);
}

function nativeTopControlsTemplate(options: NativeTopControlsOptions): string {
  return `
    <div class="ldcv-native-controls">
      ${options.settings.newTopicNoticeEnabled ? nativePendingNoticeTemplate(options.count, options.topics, options.expanded) : ""}
      ${nativeReaderControlTemplate(options)}
    </div>
  `;
}

function nativeReaderControlTemplate(options: NativeTopControlsOptions): string {
  const { settings, loading, topicCount, updatedAt } = options;
  const currentViewLabel = settings.enabled ? layoutLabel(settings.layout) : "原始";
  return `
    <details class="ldcv-native-reader">
      <summary class="ldcv-native-reader__trigger" title="阅读器控制" aria-label="阅读器控制">
        <span class="ldcv-native-reader__icon">${icons.reader}</span>
        <span>阅读</span>
        <strong>${currentViewLabel}</strong>
      </summary>
      <div class="ldcv-native-reader__menu" role="group" aria-label="阅读器控制">
        <div class="ldcv-native-reader__head">
          <strong>Linux.do 阅读器</strong>
          <span>${loading ? "正在读取话题" : `${topicCount} 个话题${updatedAt ? ` · ${updatedAt}` : ""}`}</span>
        </div>
        ${toolbarActionsTemplate(settings, settingsPanelOpen, "native")}
        ${settingsPanelTemplate(settings, settingsPanelOpen)}
      </div>
    </details>
  `;
}

function bindPendingNoticeActions(root: ShadowRoot | HTMLElement, options: PendingNoticeOptions): void {
  root
    .querySelectorAll<HTMLElement>("[data-action='toggle-pending-preview']")
    .forEach((button) =>
      button.addEventListener("click", () => {
        const origin = morphRectFromElement(button);
        options.onTogglePendingPreview();
        animatePendingNoticeHoverCard(root, origin);
      })
    );
  root
    .querySelectorAll<HTMLElement>("[data-action='apply-pending-refresh']")
    .forEach((button) => button.addEventListener("click", options.onApplyPendingRefresh));
  root.querySelectorAll<HTMLButtonElement>("[data-pending-topic-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const topicId = Number(button.dataset.pendingTopicId);
      if (Number.isFinite(topicId)) {
        options.onOpenTopic(topicId);
      }
    });
  });
}

const nativePendingNoticeStyles = `
  :host {
    --surface: var(--secondary, Canvas);
    --border: var(--primary-low, color-mix(in srgb, CanvasText 18%, transparent));
    --text: var(--primary, CanvasText);
    --muted: var(--primary-medium, color-mix(in srgb, CanvasText 58%, transparent));
    --accent: var(--tertiary, #1ca8dd);
    color-scheme: inherit;
    align-self: center;
    box-sizing: border-box;
    display: inline-flex;
    flex: 0 0 auto;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    height: auto;
    line-height: 1;
    max-height: 48px;
    min-height: 0;
    position: relative;
    vertical-align: middle;
  }

  :host *,
  :host *::before,
  :host *::after {
    box-sizing: border-box;
  }

  .ldcv-native-notice {
    display: inline-flex;
    position: relative;
  }

  .ldcv-native-controls {
    align-items: center;
    display: inline-flex;
    gap: 8px;
    position: relative;
  }

  .ldcv-native-reader {
    display: inline-flex;
    position: relative;
  }

  .ldcv-native-reader__trigger::-webkit-details-marker {
    display: none;
  }

  .ldcv-native-reader__trigger::marker {
    content: "";
  }

  .ldcv-native-notice__trigger,
  .ldcv-native-reader__trigger {
    align-items: center;
    background-color: var(--ldcv-native-notice-background, var(--surface));
    border: 1px solid var(--ldcv-native-notice-border-color, var(--border));
    border-radius: var(--ldcv-native-notice-radius, 7px);
    box-shadow: var(--ldcv-native-notice-box-shadow, none);
    color: var(--ldcv-native-notice-color, var(--text));
    cursor: pointer;
    display: inline-flex;
    font-family: var(--ldcv-native-notice-font-family, inherit);
    font-size: var(--ldcv-native-notice-font-size, 16px);
    font-weight: var(--ldcv-native-notice-font-weight, 650);
    letter-spacing: var(--ldcv-native-notice-letter-spacing, normal);
    line-height: var(--ldcv-native-notice-line-height, normal);
    gap: 7px;
    height: var(--ldcv-native-notice-height, 38px);
    justify-content: center;
    max-height: 48px;
    min-height: 30px;
    min-width: var(--ldcv-native-notice-min-width, 70px);
    padding: var(--ldcv-native-notice-padding-y, 8px) var(--ldcv-native-notice-padding-x, 14px);
    transition: var(--ldcv-native-notice-transition, none);
    white-space: nowrap;
  }

  .ldcv-native-notice__trigger:hover,
  .ldcv-native-notice.is-expanded .ldcv-native-notice__trigger,
  .ldcv-native-reader[open] .ldcv-native-reader__trigger,
  .ldcv-native-reader__trigger:hover {
    background-color: var(--ldcv-native-notice-background, var(--surface));
    border-color: var(--ldcv-native-notice-hover-border-color, var(--tertiary, var(--ldcv-native-notice-border-color, var(--border))));
    box-shadow: var(--ldcv-native-notice-hover-box-shadow, var(--ldcv-native-notice-box-shadow, none));
    color: var(--ldcv-native-notice-color, var(--text));
  }

  .ldcv-native-notice__trigger[aria-disabled="true"] {
    cursor: default;
  }

  .ldcv-native-notice__trigger strong,
  .ldcv-native-reader__trigger strong {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    border-radius: 999px;
    color: var(--accent);
    font-size: 12px;
    min-width: 20px;
    padding: 3px 6px;
    text-align: center;
  }

  .ldcv-native-reader__icon {
    align-items: center;
    color: var(--accent);
    display: inline-flex;
    justify-content: center;
  }

  .ldcv-native-reader__trigger svg {
    fill: currentColor;
    height: 18px;
    width: 18px;
  }

  .ldcv-native-notice__menu,
  .ldcv-native-reader__menu {
    background: color-mix(in srgb, var(--surface) 96%, var(--text) 4%);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: 8px;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.28);
    color: var(--text);
    min-width: 320px;
    padding: 10px;
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    transform-origin: top right;
    will-change: opacity, transform;
    width: min(420px, calc(100vw - 32px));
    z-index: 2147483646;
  }

  .ldcv-native-reader__menu {
    display: grid;
    gap: 10px;
    min-width: 360px;
  }

  .ldcv-native-notice__head {
    align-items: start;
    display: flex;
    gap: 10px;
    justify-content: space-between;
    padding: 2px 2px 8px;
  }

  .ldcv-native-reader__head {
    display: grid;
    gap: 3px;
    padding: 2px;
  }

  .ldcv-native-notice__head strong,
  .ldcv-native-notice__head span,
  .ldcv-native-reader__head strong,
  .ldcv-native-reader__head span {
    display: block;
    line-height: 1.35;
  }

  .ldcv-native-notice__head strong,
  .ldcv-native-reader__head strong {
    font-size: 13px;
    font-weight: 780;
  }

  .ldcv-native-notice__head span,
  .ldcv-native-notice__list em,
  .ldcv-native-reader__head span {
    color: var(--muted);
    font-size: 11px;
  }

  .ldcv-native-notice__list {
    border-top: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
    display: grid;
    gap: 2px;
    max-height: 260px;
    overflow: auto;
    padding-top: 8px;
  }

  .ldcv-native-notice__list button {
    background: transparent;
    border: 0;
    border-radius: 6px;
    color: inherit;
    cursor: pointer;
    display: block;
    font: inherit;
    min-width: 0;
    padding: 7px 8px;
    text-align: left;
    width: 100%;
  }

  .ldcv-native-notice__list button:hover {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .ldcv-native-notice__list span,
  .ldcv-native-notice__list em {
    display: block;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ldcv-native-notice__list span {
    color: var(--text);
    font-size: 12px;
    font-weight: 720;
  }

  .ldcv-native-notice__update {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 42%, transparent);
    border-radius: 7px;
    color: var(--accent);
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 760;
    min-height: 30px;
    padding: 0 12px;
  }

  .ldcv-new-marker {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    border-radius: 999px;
    color: var(--accent);
    display: inline-flex;
    font-size: 10px;
    font-style: normal;
    font-weight: 780;
    line-height: 1;
    margin-right: 6px;
    padding: 3px 5px;
    text-transform: uppercase;
  }

  .ldcv-native-reader__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .ldcv-native-reader__actions button {
    align-items: center;
    background: color-mix(in srgb, var(--surface) 94%, var(--text) 6%);
    border: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
    border-radius: 7px;
    color: var(--text);
    cursor: pointer;
    display: inline-flex;
    font: inherit;
    font-size: 12px;
    font-weight: 760;
    gap: 5px;
    justify-content: center;
    min-height: 34px;
    padding: 0 10px;
  }

  .ldcv-native-reader__actions button:hover,
  .ldcv-native-reader__actions button.is-active {
    border-color: color-mix(in srgb, var(--accent) 46%, transparent);
  }

  .ldcv-native-reader__actions button.is-active {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    color: var(--accent);
  }

  .ldcv-native-reader__actions svg {
    fill: currentColor;
    height: 17px;
    width: 17px;
  }

  .ldcv-settings-panel {
    background: color-mix(in srgb, var(--surface) 97%, var(--text) 3%);
    border: 1px solid var(--border);
    border-radius: 8px;
    max-height: min(58vh, 520px);
    overflow: auto;
    padding: 10px;
  }

  .ldcv-settings-panel[hidden] {
    display: none;
  }

  .ldcv-settings-grid {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(auto-fit, minmax(188px, 1fr));
  }

  .ldcv-setting {
    align-items: center;
    border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
    border-radius: 7px;
    display: flex;
    gap: 10px;
    justify-content: space-between;
    min-height: 46px;
    min-width: 0;
    padding: 8px 10px;
  }

  .ldcv-setting__label {
    align-items: center;
    display: inline-flex;
    gap: 8px;
    min-width: 0;
  }

  .ldcv-setting__label i {
    align-items: center;
    background: color-mix(in srgb, var(--accent) 13%, transparent);
    border-radius: 7px;
    color: var(--accent);
    display: inline-flex;
    flex: 0 0 auto;
    height: 28px;
    justify-content: center;
    width: 28px;
  }

  .ldcv-setting__label svg {
    fill: currentColor;
    height: 16px;
    width: 16px;
  }

  .ldcv-setting strong {
    color: var(--text);
    font-size: 13px;
    font-style: normal;
    font-weight: 740;
    line-height: 1.25;
  }

  .ldcv-setting em {
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  }

  .ldcv-setting select,
  .ldcv-setting input[type="number"] {
    background: color-mix(in srgb, var(--surface) 94%, var(--text) 6%);
    border: 1px solid color-mix(in srgb, var(--text) 16%, transparent);
    border-radius: 7px;
    color: var(--text);
    flex: 0 0 auto;
    font: inherit;
    font-size: 12px;
    font-weight: 650;
    height: 34px;
    min-width: 88px;
    padding: 0 10px;
  }

  .ldcv-setting input[type="number"] {
    width: 88px;
  }

  .ldcv-setting--switch input[type="checkbox"] {
    appearance: none;
    background: color-mix(in srgb, var(--text) 18%, transparent);
    border: 1px solid color-mix(in srgb, var(--text) 22%, transparent);
    border-radius: 999px;
    cursor: pointer;
    flex: 0 0 auto;
    height: 24px;
    position: relative;
    width: 44px;
  }

  .ldcv-setting--switch input[type="checkbox"]::after {
    background: var(--surface);
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    content: "";
    height: 18px;
    left: 2px;
    position: absolute;
    top: 2px;
    transition: transform 160ms ease;
    width: 18px;
  }

  .ldcv-setting--switch input[type="checkbox"]:checked {
    background: color-mix(in srgb, var(--accent) 70%, var(--surface) 30%);
    border-color: color-mix(in srgb, var(--accent) 84%, transparent);
  }

  .ldcv-setting--switch input[type="checkbox"]:checked::after {
    transform: translateX(20px);
  }
`;

function cardsTemplate(
  topics: TopicCardData[],
  settings: ExtensionSettings,
  loadingMore: boolean,
  hasMore: boolean,
  reader: ReaderState,
  viewedTopicIds: ReadonlySet<number>,
  justReadTopicIds: ReadonlySet<number>,
  newTopicIds: ReadonlySet<number>,
  enteringTopicIds: ReadonlySet<number>,
  visibleTopicCount = topics.length
): string {
  const visibleTopics = topics.slice(0, Math.min(Math.max(visibleTopicCount, 0), topics.length));
  const hasHiddenTopics = visibleTopics.length < topics.length;
  let enteringIndex = 0;
  const loadMoreState: TopicLoadMoreState = hasHiddenTopics
    ? "arranging"
    : loadingMore
      ? "loading"
      : hasMore
        ? "idle"
        : "complete";
  const grid = `
    <div class="ldcv-grid" data-card-grid="${settings.layout}">
      ${visibleTopics
        .map((topic, index) => {
          const entering = enteringTopicIds.has(topic.id);
          const enterDelayMs = entering ? enteringIndex++ * 56 : undefined;
          return cardTemplate(topic, index, settings.layout, {
            selected: reader.topicId === topic.id,
            viewed: viewedTopicIds.has(topic.id) || topic.flags.read === true,
            justRead: justReadTopicIds.has(topic.id),
            newTopic: newTopicIds.has(topic.id),
            entering,
            enterDelayMs
          }, settings.topicUrlView);
        })
        .join("")}
    </div>
  `;
  const loadMore = topicLoadMoreTemplate(loadMoreState);

  if (settings.layout === "reader") {
    return `
      <div class="ldcv-reader">
        <div class="ldcv-reader__list">
          ${grid}
          ${loadMore}
        </div>
        <aside class="ldcv-reader-pane" aria-label="话题阅读器">
          <div data-react-reader-pane-host></div>
        </aside>
      </div>
    `;
  }

  return `
    ${grid}
    ${loadMore}
  `;
}

function reactReaderModalHostTemplate(): string {
  return `<div data-react-reader-modal-host></div>`;
}

function reactReaderModalFingerprint(
  data: TopicListData | null,
  settings: ExtensionSettings,
  reader: ReaderState
): string | null {
  if (settings.layout === "reader" || !reader.topicId) {
    return null;
  }

  return JSON.stringify({
    topicId: reader.topicId,
    topicIds: (data?.topics ?? []).map((topic) => topic.id),
    settings: {
      commentSortOrder: settings.commentSortOrder,
      topicUrlView: settings.topicUrlView,
      autoLoadReaderComments: settings.autoLoadReaderComments,
      readerPostBatchSize: settings.readerPostBatchSize,
      collapseLongComments: settings.collapseLongComments,
      creditTopicViewDwellSeconds: settings.creditTopicViewDwellSeconds,
    },
    reader: {
      loading: reader.loading,
      refreshing: reader.refreshing,
      loadingMore: reader.loadingMore,
      loadMoreError: reader.loadMoreError,
      refreshError: reader.refreshError,
      freshPostNumbers: reader.freshPostNumbers,
      error: reader.error,
      data: reader.data
        ? {
            id: reader.data.id,
            title: reader.data.title,
            stats: reader.data.stats,
            actions: reader.data.actions,
            loadedPostIds: reader.data.loadedPostIds,
            postStream: reader.data.postStream,
            hasMorePosts: reader.data.hasMorePosts,
            posts: reader.data.posts.map((post) => ({
              id: post.id,
              postNumber: post.postNumber,
              replyToPostNumber: post.replyToPostNumber,
              html: post.html,
              stats: post.stats,
              actions: post.actions,
              isOriginalPost: post.isOriginalPost,
              isOriginalPoster: post.isOriginalPoster
            }))
          }
        : null,
      userPreview: reader.userPreview,
      nativePostAction: reader.nativePostAction,
      pollVote: reader.pollVote,
      creditViewTrackingPhase: reader.creditViewTrackingPhase ?? null,
      creditViewTrackingStartedAt: reader.creditViewTrackingStartedAt ?? null,
    }
  });
}

function readerModalPresentation(
  root: ShadowRoot,
  settings: ExtensionSettings,
  reader: ReaderState
): ReaderModalPresentation {
  if (settings.layout === "reader" || !reader.topicId || !reader.modalOrigin) {
    return {};
  }

  const previousModal = root.querySelector<HTMLElement>(".ldcv-reader-modal");
  const previousTopicId = Number(
    previousModal?.querySelector<HTMLElement>(".ldcv-reader-article[data-reader-topic-id]")?.dataset.readerTopicId
  );
  return {
    entering: previousModal ? previousTopicId !== reader.topicId : true,
    origin: reader.modalOrigin
  };
}

function loadingTemplate(): string {
  return `
    <div class="ldcv-skeleton-grid" aria-hidden="true">
      ${Array.from({ length: 6 })
        .map(() => `<div class="ldcv-skeleton"><span></span><strong></strong><p></p><p></p></div>`)
        .join("")}
    </div>
  `;
}

function emptyTemplate(): string {
  return `
    <div class="ldcv-empty">
      <strong>没有找到可展示的话题</strong>
      <span>这个页面可能不是 Discourse 话题列表，或者当前列表暂时为空。</span>
    </div>
  `;
}

function bindActions(options: RenderOptions, bindOptions: { skipReaderModalBindings?: boolean } = {}): void {
  const {
    root,
    settings,
    onRefresh,
    onSettingsChange,
    onOpenTopic,
    onReaderAdjacent,
    onRefreshReader,
    onLoadMoreReaderPosts,
    onRetryReader,
    onCloseReader,
    onReaderBackdropClick,
    onApplyPendingRefresh,
    onTogglePendingPreview,
    onMinimizePendingNotice,
    onDismissPendingPreview,
    onOpenReaderImage,
    onCloseReaderImage,
    onOpenUserPreview,
    onCloseUserPreview,
    onOpenPrivateMessage,
    onNativePostAction,
    onPollVote,
    onCommentSortChange
  } = options;
  const skipReaderModalBindings = Boolean(bindOptions.skipReaderModalBindings);

  // Toolbar/settings/pending-notice actions: unified capture-phase delegation.
  // Uses WeakMap to keep callbacks fresh across renders while remaining
  // idempotent via WeakSet (same pattern as Phase 5c Reader modal binders).
  bindToolbarActionsDelegation(root, {
    settings,
    onRefresh,
    onSettingsChange,
    onDismissPendingPreview,
    onApplyPendingRefresh,
    onTogglePendingPreview,
    onMinimizePendingNotice,
    onOpenTopic
  });
  const loadMoreButton = root.querySelector<HTMLElement>("[data-action='load-more']");
  if (loadMoreButton && !boundLoadMoreButtons.has(loadMoreButton)) {
    boundLoadMoreButtons.add(loadMoreButton);
    loadMoreButton.addEventListener("click", options.onLoadMore);
  }
  if (!skipReaderModalBindings) {
    bindReaderModalActions(options);
  }

  bindTopicCardClickDelegation(root, onOpenTopic);
  if (!mouseMoveDelegatedRoots.has(root)) {
    mouseMoveDelegatedRoots.add(root);
    root.addEventListener("mousemove", (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !(event instanceof MouseEvent)) {
        return;
      }
      const card = target.closest<HTMLElement>(".ldcv-card");
      if (!card) {
        return;
      }
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    }, { passive: true });
  }
  if (!cardEnterAnimationDelegatedRoots.has(root)) {
    cardEnterAnimationDelegatedRoots.add(root);
    root.addEventListener("animationend", (event) => {
      if ((event as AnimationEvent).animationName !== "ldcv-card-enter") {
        return;
      }
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.classList.contains("ldcv-card")) {
        return;
      }
      target.classList.remove("is-entering");
      target.style.removeProperty("--ldcv-enter-delay");
    }, { passive: true });
  }

  // Handle image load animation
  if (!imgLoadDelegatedRoots.has(root)) {
    imgLoadDelegatedRoots.add(root);
    root.addEventListener(
      "load",
      (event) => {
        if (event.target instanceof HTMLImageElement) {
          const img = event.target;
          if (img.src) {
            loadedImageUrls.add(img.src);
          }
          img.classList.remove("ldcv-img-loading");
        }
      },
      { capture: true, passive: true }
    );
    root.addEventListener(
      "error",
      (event) => {
        if (event.target instanceof HTMLImageElement) {
          event.target.classList.remove("ldcv-img-loading");
        }
      },
      { capture: true, passive: true }
    );

    // Observe dynamic DOM changes to apply loading animation to new images
    const imgObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            const imgs = node.tagName === "IMG" ? [node as HTMLImageElement] : Array.from(node.querySelectorAll("img"));
            imgs.forEach((img) => {
              setupImageLoadingState(img);
            });
          }
        });
      });
    });
    imgObserver.observe(root, { childList: true, subtree: true });
  }

  // Pre-mark already complete images, and hide/prepare loading ones
  root.querySelectorAll("img").forEach((img) => {
    setupImageLoadingState(img);
  });
}

function setupImageLoadingState(img: HTMLImageElement): void {
  if (img.closest(".ldcv-image-viewer") || isEmojiImage(img)) {
    img.classList.remove("ldcv-img-loading", "ldcv-img-transitioning");
    return;
  }

  const src = img.src || "";
  if (src && loadedImageUrls.has(src)) {
    img.classList.remove("ldcv-img-loading", "ldcv-img-transitioning");
  } else {
    if (img.complete) {
      if (src) {
        loadedImageUrls.add(src);
      }
      img.classList.add("ldcv-img-loading", "ldcv-img-transitioning");
      setTimeout(() => {
        img.classList.remove("ldcv-img-loading");
      }, 20);
    } else {
      img.classList.add("ldcv-img-loading", "ldcv-img-transitioning");
    }
  }
}

function isEmojiImage(img: HTMLImageElement): boolean {
  const className = img.className || "";
  const alt = img.alt || "";
  const src = img.src || "";
  return (
    /\b(emoji|twemoji|emoticon|smiley)\b/i.test(className) ||
    /^:[\w+-]+:$/.test(alt.trim()) ||
    /emoji/i.test(src)
  );
}

// MouseMove delegation for card hover glow. Idempotent via WeakSet.
const mouseMoveDelegatedRoots = new WeakSet<ShadowRoot | HTMLElement>();
const cardEnterAnimationDelegatedRoots = new WeakSet<ShadowRoot | HTMLElement>();
const imgLoadDelegatedRoots = new WeakSet<ShadowRoot | HTMLElement>();
const loadedImageUrls = new Set<string>();

// Unified capture-phase delegation for toolbar/settings/pending-notice actions.
// Idempotent via WeakSet. Callbacks kept fresh via WeakMap.
const toolbarClickDelegatedRoots = new WeakSet<ShadowRoot | HTMLElement>();
const toolbarChangeDelegatedRoots = new WeakSet<ShadowRoot | HTMLElement>();
const toolbarDetailDelegatedRoots = new WeakSet<ShadowRoot | HTMLElement>();
const toolbarCallbacks = new WeakMap<ShadowRoot | HTMLElement, {
  settings: ExtensionSettings;
  onRefresh: () => void;
  onSettingsChange: (settings: ExtensionSettings) => void;
  onDismissPendingPreview?: () => void;
  onApplyPendingRefresh: () => void;
  onTogglePendingPreview: () => void;
  onMinimizePendingNotice: () => void;
  onOpenTopic: (topicId: number, origin?: ReaderModalOrigin | null) => void;
}>();

function bindToolbarActionsDelegation(
  root: ShadowRoot | HTMLElement,
  callbacks: {
    settings: ExtensionSettings;
    onRefresh: () => void;
    onSettingsChange: (settings: ExtensionSettings) => void;
    onDismissPendingPreview?: () => void;
    onApplyPendingRefresh: () => void;
    onTogglePendingPreview: () => void;
    onMinimizePendingNotice: () => void;
    onOpenTopic: (topicId: number, origin?: ReaderModalOrigin | null) => void;
  }
): void {
  toolbarCallbacks.set(root, callbacks);

  // Click delegation (capture phase)
  if (!toolbarClickDelegatedRoots.has(root)) {
    toolbarClickDelegatedRoots.add(root);
    root.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const cb = toolbarCallbacks.get(root);
      if (!cb) return;

      const actionEl = target.closest<HTMLElement>("[data-action]");
      const action = actionEl?.dataset.action;

      if (action === "refresh") {
        event.preventDefault();
        event.stopPropagation();
        cb.onRefresh();
        return;
      }
      if (action === "toggle-settings") {
        event.preventDefault();
        event.stopPropagation();
        cb.onDismissPendingPreview?.();
        closePendingNoticeDom(root);
        const open = toggleSettingsPanel(root);
        root.querySelectorAll<HTMLButtonElement>("[data-action='toggle-settings']").forEach((btn) => {
          btn.classList.toggle("is-active", open);
          btn.setAttribute("aria-expanded", open ? "true" : "false");
        });
        return;
      }
      if (action === "toggle-original") {
        event.preventDefault();
        event.stopPropagation();
        cb.onSettingsChange({ ...cb.settings, enabled: false });
        return;
      }
      if (action === "apply-pending-refresh") {
        event.preventDefault();
        event.stopPropagation();
        cb.onApplyPendingRefresh();
        return;
      }
      if (action === "toggle-pending-preview") {
        event.preventDefault();
        event.stopPropagation();
        const origin = morphRectFromElement(actionEl!);
        cb.onTogglePendingPreview();
        animatePendingNoticeHoverCard(root, origin);
        return;
      }
      if (action === "minimize-pending-notice") {
        event.preventDefault();
        event.stopPropagation();
        cb.onMinimizePendingNotice();
        return;
      }

      // Layout buttons (data-layout, not data-action)
      const layoutEl = target.closest<HTMLElement>("[data-layout]");
      if (layoutEl) {
        event.preventDefault();
        event.stopPropagation();
        const layout = normalizeLayout(layoutEl.dataset.layout);
        if (layout === cb.settings.layout && cb.settings.enabled) return;
        cb.onSettingsChange({ ...cb.settings, enabled: true, layout });
        return;
      }

      // Pending topic click
      const pendingTopicEl = target.closest<HTMLElement>("[data-pending-topic-id]");
      if (pendingTopicEl) {
        event.preventDefault();
        event.stopPropagation();
        const topicId = Number(pendingTopicEl.dataset.pendingTopicId);
        if (Number.isFinite(topicId)) {
          cb.onOpenTopic(topicId);
        }
        return;
      }
    }, true);
  }

  // Change delegation for settings inputs (capture phase)
  if (!toolbarChangeDelegatedRoots.has(root)) {
    toolbarChangeDelegatedRoots.add(root);
    root.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const cb = toolbarCallbacks.get(root);
      if (!cb) return;

      const toggle = target.closest<HTMLInputElement>("[data-setting-toggle]");
      if (toggle) {
        const key = toggle.dataset.settingToggle;
        if (!isBooleanSettingKey(key)) return;
        cb.onSettingsChange(normalizeSettings({ ...cb.settings, [key]: toggle.checked }));
        return;
      }
      const select = target.closest<HTMLSelectElement>("[data-setting-select]");
      if (select) {
        const key = select.dataset.settingSelect;
        if (!isSelectSettingKey(key)) return;
        cb.onSettingsChange(normalizeSettings({ ...cb.settings, [key]: select.value }));
        return;
      }
      const number = target.closest<HTMLInputElement>("[data-setting-number]");
      if (number) {
        const key = number.dataset.settingNumber;
        if (!isNumberSettingKey(key)) return;
        cb.onSettingsChange(normalizeSettings({ ...cb.settings, [key]: Number(number.value) }));
        return;
      }
    }, true);
  }

  // Toggle delegation for transient details (capture phase)
  if (!toolbarDetailDelegatedRoots.has(root)) {
    toolbarDetailDelegatedRoots.add(root);
    root.addEventListener("toggle", (event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement)) return;
      if (!details.matches(TRANSIENT_DETAIL_SELECTOR)) return;
      const cb = toolbarCallbacks.get(root);
      if (!cb) return;

      if (!details.open) {
        if (settingsPanelOpen) {
          settingsPanelOpen = false;
          syncSettingsPanelState(root);
        }
        return;
      }
      cb.onDismissPendingPreview?.();
      closePendingNoticeDom(root);
      root.querySelectorAll<HTMLDetailsElement>(TRANSIENT_DETAIL_SELECTOR).forEach((other) => {
        if (other !== details) {
          other.removeAttribute("open");
        }
      });
    }, true);
  }
}

// Event delegation for user-preview clicks. Attached once per root (idempotent
// via WeakSet) to avoid listener accumulation on React-patched DOM nodes.
const userPreviewDelegatedRoots = new WeakSet<ShadowRoot | HTMLElement>();

function bindReaderUserPreviewDelegation(root: ShadowRoot, options: RenderOptions): void {
  if (userPreviewDelegatedRoots.has(root)) {
    return;
  }
  userPreviewDelegatedRoots.add(root);

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const anchor = target.closest<HTMLAnchorElement>("[data-reader-user-preview]");
    if (!anchor) {
      return;
    }
    const username = anchor.dataset.readerUsername || "";
    const name = anchor.dataset.readerName || username;
    const avatarUrl = anchor.dataset.readerAvatarUrl || "";
    const postNumber = Number(anchor.dataset.readerPostNumber);
    const anchorPostNumber = Number(
      anchor.dataset.readerAnchorPostNumber || anchor.closest<HTMLElement>(".ldcv-reader-comment")?.dataset.postNumber
    );
    const anchorType = anchor.dataset.readerPreviewAnchor === "reply-target" ? "reply-target" : "author";
    if (!username || !Number.isFinite(postNumber)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const origin = morphRectFromElement(anchor);
    options.onOpenUserPreview({
      username,
      name,
      avatarUrl,
      href: anchor.getAttribute("href") || profileUrlForUsername(username),
      postNumber,
      anchorPostNumber: Number.isFinite(anchorPostNumber) ? anchorPostNumber : postNumber,
      anchorType,
      loading: true,
      error: "",
      profile: null,
      offsetLeft: anchor.offsetLeft,
    });
    animateHoverCardFromRect(root.querySelector<HTMLElement>(".ldcv-user-preview"), origin);
  });
}

const imageLinkDelegatedRoots = new WeakSet<ShadowRoot | HTMLElement>();

function bindReaderImageDelegation(root: ShadowRoot, options: RenderOptions): void {
  if (imageLinkDelegatedRoots.has(root)) {
    return;
  }
  imageLinkDelegatedRoots.add(root);

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const element = target.closest<HTMLElement>(".ldcv-reader-prose .ldcv-reader-image-link, .ldcv-reader-prose img.ldcv-reader-image");
    if (!element) {
      return;
    }

    const currentItem = imageViewerItemFromElement(element);
    if (!currentItem) {
      return;
    }
    const items = imageViewerItems(root);
    const index = Math.max(items.findIndex((item) => item.src === currentItem.src), 0);
    const origin = element.getBoundingClientRect();

    event.preventDefault();
    event.stopPropagation();
    options.onOpenReaderImage({
      ...currentItem,
      items: items.length ? items : [currentItem],
      index,
      scale: 1,
      rotation: 0
    });
    
    // Animate morph if the image viewer container exists
    const imageViewer = root.querySelector<HTMLElement>(".ldcv-image-viewer");
    if (imageViewer) {
      animateImageViewerMorph(root, origin);
    }
  }, { capture: true });
}

// Event delegation for close-user-preview and private-message buttons inside
// the user preview overlay. Idempotent via WeakSet (same pattern as
// bindReaderUserPreviewDelegation). Works for both template and React paths.
const previewActionDelegatedRoots = new WeakSet<ShadowRoot | HTMLElement>();

function bindReaderPreviewActionDelegation(
  root: ShadowRoot,
  onCloseUserPreview: () => void,
  onOpenPrivateMessage: () => void
): void {
  if (previewActionDelegatedRoots.has(root)) {
    return;
  }
  previewActionDelegatedRoots.add(root);

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const closeButton = target.closest<HTMLButtonElement>("[data-action='close-user-preview']");
    if (closeButton) {
      event.preventDefault();
      event.stopPropagation();
      onCloseUserPreview();
      return;
    }
    const pmButton = target.closest<HTMLButtonElement>("[data-action='private-message']");
    if (pmButton && !pmButton.disabled) {
      event.preventDefault();
      event.stopPropagation();
      onOpenPrivateMessage();
    }
  });
}

// Event delegation for toggle-comment. Idempotent via WeakSet. Works for both
// template and React paths — toggles .is-expanded/.is-collapsed classes directly,
// matching the template's setReaderCommentExpanded behavior.
const toggleCommentDelegatedRoots = new WeakSet<ShadowRoot | HTMLElement>();

function bindReaderToggleCommentDelegation(root: ShadowRoot | HTMLElement): void {
  if (toggleCommentDelegatedRoots.has(root)) {
    return;
  }
  toggleCommentDelegatedRoots.add(root);

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-action='toggle-comment']");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const comment = button.closest<HTMLElement>(".ldcv-reader-comment");
    const expanded = !(comment?.classList.contains("is-expanded") ?? false);
    if (comment) {
      setReaderCommentExpanded(comment, expanded);
    }
    updateCommentToggleButton(button, expanded);
  }, true); // capture phase: runs before React's bubble-phase stopPropagation
}

// Event delegation for poll vote buttons. Capture phase + idempotent WeakSet.
const pollVoteDelegatedRoots = new WeakSet<ShadowRoot | HTMLElement>();

function bindReaderPollVoteDelegation(
  root: ShadowRoot | HTMLElement,
  onPollVote: (vote: { postId: number; pollName: string; optionId: string }) => void
): void {
  if (pollVoteDelegatedRoots.has(root)) {
    return;
  }
  pollVoteDelegatedRoots.add(root);

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-reader-poll-vote]");
    if (!button || button.disabled) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const postId = Number(button.dataset.readerPollPostId);
    const pollName = button.dataset.readerPollName || "";
    const optionId = button.dataset.readerPollOptionId || "";
    if (!Number.isFinite(postId) || !pollName || !optionId) {
      return;
    }
    onPollVote({ postId, pollName, optionId });
  }, true);
}

// Event delegation for comment sort buttons. Capture phase + idempotent WeakSet.
const commentSortDelegatedRoots = new WeakSet<ShadowRoot | HTMLElement>();
const commentSortCallbacks = new WeakMap<ShadowRoot | HTMLElement, (sortOrder: CommentSortOrder) => void>();

function bindReaderCommentSortDelegation(
  root: ShadowRoot | HTMLElement,
  currentSortOrder: CommentSortOrder,
  onCommentSortChange: (sortOrder: CommentSortOrder) => void
): void {
  // Always update the callback + current sort so it stays fresh across renders
  commentSortCallbacks.set(root, onCommentSortChange);

  if (commentSortDelegatedRoots.has(root)) {
    return;
  }
  commentSortDelegatedRoots.add(root);

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-comment-sort]");
    if (!button) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const sortOrder = normalizeCommentSortOrder(button.dataset.commentSort);
    if (!sortOrder) {
      return;
    }
    commentSortCallbacks.get(root)?.(sortOrder);
  }, true);
}

function bindReaderModalActions(options: RenderOptions): void {
  const {
    root,
    settings,
    onReaderAdjacent,
    onRefreshReader,
    onLoadMoreReaderPosts,
    onRetryReader,
    onCloseReader,
    onReaderBackdropClick,
    onOpenReaderImage,
    onOpenUserPreview,
    onCloseUserPreview,
    onOpenPrivateMessage,
    onNativePostAction,
    onPollVote,
    onCommentSortChange
  } = options;

  // Both modal and pane now render via React. Check for either host.
  const reactReaderHost = Boolean(
    root.querySelector("[data-react-reader-modal-host], [data-react-reader-pane-host]")
  );

  // Event-boundary and filter binders run for both template and React paths.
  // They are safe to re-run: stopPropagation is idempotent, and comment filters
  // use addEventListener on inputs that React patches (not replaces).
  bindReaderControlEventBoundaries(root);
  bindReaderProseEventBoundaries(root);
  bindReaderCopyCodeDelegation(root);
  bindReaderCommentFilters(root);
  applyReaderPollVoteFeedback(root, options.reader.pollVote);
  // load-more-reader, retry-reader, refresh-reader, reader-move: now handled by
  // React (ReaderContent renders these buttons with React onClick or delegation).
  // Skip per-element binding for React-owned content.
  const reactReaderModal = hasReactReaderModal(root);
  if (!reactReaderModal) {
    root.querySelectorAll<HTMLElement>("[data-action='close-reader']").forEach((button) => {
      button.addEventListener("click", () => closeReaderWithMotion(root, onCloseReader));
    });
  }
  // comment-sort: capture-phase delegation (same pattern as toggle-comment/poll-vote).
  bindReaderCommentSortDelegation(root, settings.commentSortOrder, onCommentSortChange);
  // User-preview, preview-actions, toggle-comment: capture-phase delegation.
  bindReaderUserPreviewDelegation(root, options);
  bindReaderPreviewActionDelegation(root, onCloseUserPreview, onOpenPrivateMessage);
  bindReaderToggleCommentDelegation(root);
  // post-action per-element binder: only for non-React paths (pane used to need it).
  // Now that pane is also React, this is dead code — React PostAction has onClick.
  // Poll vote: capture-phase delegation.
  bindReaderPollVoteDelegation(root, onPollVote);
  root.querySelectorAll<HTMLDetailsElement>(".ldcv-reader-details:not([data-details-bound])").forEach((details) => {
    details.dataset.detailsBound = "true";
    details.querySelector<HTMLElement>(".ldcv-reader-details__summary")?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextOpen = !details.open;
      details.open = nextOpen;
      if (nextOpen) {
        expandReaderCommentForElement(details);
      }
    });
  });
  bindReaderCommentMediaExpansion(root);
  const readerBackdrop = root.querySelector<HTMLElement>("[data-reader-backdrop]");
  if (readerBackdrop && !boundReaderBackdrops.has(readerBackdrop)) {
    boundReaderBackdrops.add(readerBackdrop);
    if (!reactReaderModal) {
      readerBackdrop.addEventListener("click", (event) => {
        if (event.target === event.currentTarget) {
          if (isPrivateMessageComposeHost(root)) {
            onReaderBackdropClick();
            return;
          }
          closeReaderWithMotion(root, onReaderBackdropClick);
        }
      });
    }
    readerBackdrop.addEventListener("wheel", containReaderWheel, { passive: false });
    readerBackdrop.addEventListener("touchstart", trackReaderTouchStart, { passive: true });
    readerBackdrop.addEventListener("touchmove", containReaderTouchMove, { passive: false });
  }
  if (!boundReaderDismissRoots.has(root)) {
    boundReaderDismissRoots.add(root);
    root.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      if (eventPathContainsSelector(event, READER_CONTROL_BOUNDARY_SELECTOR)) {
        return;
      }
      if (eventPathContainsSelector(event, ".ldcv-reader-prose, .ldcv-reader-details, .ldcv-reader-poll")) {
        return;
      }
      if (event.target.closest("[data-reader-user-preview], .ldcv-user-preview")) {
        return;
      }
      if (hasNonCollapsedReaderSelection(root)) {
        return;
      }
      onCloseUserPreview();
    });
  }

  bindReaderImageDelegation(root, options);
}

function hasReactReaderModal(root: ShadowRoot | HTMLElement): boolean {
  return Boolean(root.querySelector("[data-react-reader-modal='true']"));
}

function bindImageViewerActions(
  root: ShadowRoot,
  options: {
    onImageViewerAction: (action: ReaderImageViewerAction) => void;
    onCloseReaderImage: () => void;
  }
): void {
  const { onImageViewerAction, onCloseReaderImage } = options;
  root.querySelector<HTMLElement>("[data-action='close-image-viewer']")?.addEventListener("click", onCloseReaderImage);
  root.querySelectorAll<HTMLButtonElement>("[data-image-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) {
        return;
      }
      onImageViewerAction(normalizeImageViewerAction(button.dataset.imageAction));
    });
  });
  const imageViewerBackdrop = root.querySelector<HTMLElement>("[data-image-viewer-backdrop]");
  imageViewerBackdrop?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      onCloseReaderImage();
    }
  });
  imageViewerBackdrop?.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const action = imageViewerActionFromWheel(event.deltaY);
      if (action) {
        onImageViewerAction(action);
      }
    },
    { passive: false }
  );
  imageViewerBackdrop?.addEventListener(
    "touchmove",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
    },
    { passive: false }
  );
  const imageViewerStage = root.querySelector<HTMLElement>("[data-image-viewer-stage]");
  imageViewerStage?.addEventListener("click", (event) => {
    const image = imageViewerStage.querySelector<HTMLImageElement>("img");
    if (imageViewerStage.hasAttribute(IMAGE_VIEWER_SUPPRESS_CLOSE_ATTRIBUTE)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.target instanceof HTMLImageElement || (image && isImageViewerImageHit(event, image))) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.target === event.currentTarget) {
      onCloseReaderImage();
    }
  });
  bindImageViewerPan(root, () => onImageViewerAction("toggle-zoom"));
}

function bindTopicCardClickDelegation(
  root: ShadowRoot | HTMLElement,
  onOpenTopic: (topicId: number, origin?: ReaderModalOrigin | null) => void
): void {
  topicCardClickCallbacks.set(root, onOpenTopic);

  if (topicCardClickDelegatedRoots.has(root)) {
    return;
  }

  topicCardClickDelegatedRoots.add(root);
  root.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !(event instanceof MouseEvent)) {
        return;
      }

      const onOpen = topicCardClickCallbacks.get(root);
      if (!onOpen) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>(".ldcv-card[data-topic-id] a[href]");
      if (!anchor) {
        return;
      }

      if (target.closest("[data-reader-user-preview]")) {
        event.preventDefault();
        return;
      }

      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      if (hasNonCollapsedReaderSelection(root)) {
        return;
      }

      const card = anchor.closest<HTMLElement>(".ldcv-card[data-topic-id]");
      const topicId = Number(card?.dataset.topicId);
      if (!card || !Number.isFinite(topicId)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onOpen(topicId, readerModalOriginFromElement(card));
    },
    true
  );
}

function readerModalOriginFromElement(element: HTMLElement): ReaderModalOrigin | null {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const targetWidth = Math.min(980, Math.max(360, window.innerWidth - 64));
  const targetHeight = Math.min(window.innerHeight * 0.88, 940, Math.max(360, window.innerHeight - 48));
  const computed = window.getComputedStyle(element);
  const borderRadius = Number.parseFloat(computed.borderTopLeftRadius) || 8;
  return {
    x: centerX,
    y: centerY,
    translateX: centerX - window.innerWidth / 2,
    translateY: centerY - window.innerHeight / 2,
    width: rect.width,
    height: rect.height,
    borderRadius,
    scaleX: rect.width / targetWidth,
    scaleY: rect.height / targetHeight
  };
}

function resolveLiveSettings(
  root: ShadowRoot | HTMLElement,
  fallback: ExtensionSettings,
): ExtensionSettings {
  return toolbarCallbacks.get(root)?.settings ?? fallback;
}

function bindSettingsControls(
  root: ShadowRoot | HTMLElement,
  settings: ExtensionSettings,
  onSettingsChange: (settings: ExtensionSettings) => void
): void {
  root.querySelectorAll<HTMLInputElement>("[data-setting-toggle]").forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.settingToggle;
      if (!isBooleanSettingKey(key)) {
        return;
      }
      const current = resolveLiveSettings(root, settings);
      onSettingsChange(normalizeSettings({ ...current, [key]: input.checked }));
    });
  });
  root.querySelectorAll<HTMLSelectElement>("[data-setting-select]").forEach((select) => {
    select.addEventListener("change", () => {
      const key = select.dataset.settingSelect;
      if (!isSelectSettingKey(key)) {
        return;
      }
      const current = resolveLiveSettings(root, settings);
      onSettingsChange(normalizeSettings({ ...current, [key]: select.value }));
    });
  });
  root.querySelectorAll<HTMLInputElement>("[data-setting-number]").forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.settingNumber;
      if (!isNumberSettingKey(key)) {
        return;
      }
      const current = resolveLiveSettings(root, settings);
      onSettingsChange(normalizeSettings({ ...current, [key]: Number(input.value) }));
    });
  });
}

function bindTopControlActions(
  root: ShadowRoot | HTMLElement,
  options: {
    settings: ExtensionSettings;
    onRefresh: () => void;
    onSettingsChange: (settings: ExtensionSettings) => void;
    onDismissPendingPreview?: () => void;
  }
): void {
  const { settings, onRefresh, onSettingsChange, onDismissPendingPreview } = options;
  root.querySelectorAll<HTMLElement>("[data-action='refresh']").forEach((button) => {
    button.addEventListener("click", onRefresh);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-action='toggle-settings']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      onDismissPendingPreview?.();
      closePendingNoticeDom(root);
      const open = toggleSettingsPanel(root);
      root.querySelectorAll<HTMLButtonElement>("[data-action='toggle-settings']").forEach((settingsButton) => {
        settingsButton.classList.toggle("is-active", open);
        settingsButton.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  });
  root.querySelectorAll<HTMLElement>("[data-action='toggle-original']").forEach((button) => {
    button.addEventListener("click", () => {
      onSettingsChange({ ...settings, enabled: false });
    });
  });
  root.querySelectorAll<HTMLElement>("[data-layout]").forEach((button) => {
    button.addEventListener("click", () => {
      const layout = normalizeLayout(button.dataset.layout);
      if (layout === settings.layout && settings.enabled) {
        return;
      }
      onSettingsChange({ ...settings, enabled: true, layout });
    });
  });
}

function bindTransientDetailActions(root: ShadowRoot | HTMLElement, onDismissPendingPreview?: () => void): void {
  root.querySelectorAll<HTMLDetailsElement>(TRANSIENT_DETAIL_SELECTOR).forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open) {
        if (settingsPanelOpen) {
          settingsPanelOpen = false;
          syncSettingsPanelState(root);
        }
        return;
      }

      onDismissPendingPreview?.();
      closePendingNoticeDom(root);
      root.querySelectorAll<HTMLDetailsElement>(TRANSIENT_DETAIL_SELECTOR).forEach((other) => {
        if (other !== details) {
          other.removeAttribute("open");
        }
      });
    });
  });
}

function closePendingNoticeDom(root: ShadowRoot | HTMLElement): void {
  root.querySelectorAll<HTMLElement>(".ldcv-native-notice.is-expanded, .ldcv-update-float.is-expanded").forEach((notice) => {
    notice.classList.remove("is-expanded");
  });
  root.querySelectorAll<HTMLElement>(".ldcv-update-float[data-react-floating-pending-notice='true'] .ldcv-update-float__list").forEach((menu) => {
    menu.hidden = true;
  });
  root.querySelectorAll<HTMLElement>(".ldcv-native-notice[data-react-native-pending-notice='true'] .ldcv-native-notice__menu").forEach((menu) => {
    menu.hidden = true;
  });
  root.querySelectorAll<HTMLElement>(".ldcv-native-notice:not([data-react-native-pending-notice='true']) .ldcv-native-notice__menu, .ldcv-update-float:not([data-react-floating-pending-notice='true']) .ldcv-update-float__list").forEach((menu) => {
    menu.remove();
  });
}

function toggleSettingsPanel(root: ShadowRoot | HTMLElement | null): boolean {
  settingsPanelOpen = !settingsPanelOpen;
  syncSettingsPanelState(root);
  return settingsPanelOpen;
}

function syncSettingsPanelState(root: ShadowRoot | HTMLElement | null): void {
  if (!root) {
    return;
  }

  root.querySelectorAll<HTMLElement>("[data-settings-panel]").forEach((panel) => {
    setSettingsPanelMotionState(panel, settingsPanelOpen);
  });
  root.querySelectorAll<HTMLButtonElement>("[data-action='toggle-settings']").forEach((button) => {
    button.classList.toggle("is-active", settingsPanelOpen);
    button.setAttribute("aria-expanded", settingsPanelOpen ? "true" : "false");
  });
}

export function closeReaderWithMotion(root: ShadowRoot | HTMLElement | null, onCloseReader: () => void): void {
  const backdrop = root?.querySelector<HTMLElement>("[data-reader-backdrop]");
  if (!backdrop || closingReaderBackdrops.has(backdrop) || !supportsElementMotion(backdrop)) {
    onCloseReader();
    return;
  }

  const modal = backdrop.querySelector<HTMLElement>(".ldcv-reader-modal");
  closingReaderBackdrops.add(backdrop);
  backdrop.classList.add("is-closing");
  modal?.classList.add("is-closing");

  backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: READER_CLOSE_MOTION_MS,
    easing: "ease-out"
  });

  const modalAnimation = modal?.animate(
    [
      { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
      { opacity: 0, transform: "translate3d(0, -10px, 0) scale(0.965)" }
    ],
    {
      duration: READER_CLOSE_MOTION_MS,
      easing: "ease-out"
    }
  );

  if (!modalAnimation) {
    window.setTimeout(onCloseReader, READER_CLOSE_MOTION_MS);
    return;
  }

  modalAnimation.onfinish = () => {
    closingReaderBackdrops.delete(backdrop);
    onCloseReader();
  };
}

export function closeImageViewerWithMotion(root: ShadowRoot | HTMLElement | null): boolean {
  const backdrop = root?.querySelector<HTMLElement>("[data-image-viewer-backdrop]");
  if (!backdrop) {
    return false;
  }

  if (backdrop.dataset.imageViewerClosing === "true") {
    return true;
  }

  backdrop.dataset.imageViewerClosing = "true";
  backdrop.style.pointerEvents = "none";

  const removeBackdrop = (): void => {
    backdrop.remove();
  };

  if (!supportsElementMotion(backdrop)) {
    removeBackdrop();
    return true;
  }

  const image = backdrop.querySelector<HTMLElement>(".ldcv-image-viewer__stage img");
  image?.animate(
    [{ opacity: 1 }, { opacity: 0.86 }],
    {
      duration: IMAGE_VIEWER_CLOSE_MOTION_MS,
      easing: "ease-out"
    }
  );

  const backdropAnimation = backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: IMAGE_VIEWER_CLOSE_MOTION_MS,
    easing: "ease-out"
  });
  let finished = false;
  const finish = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    removeBackdrop();
  };
  window.setTimeout(finish, IMAGE_VIEWER_CLOSE_MOTION_MS + 40);
  backdropAnimation.onfinish = finish;
  return true;
}

function animatePendingNoticeHoverCard(root: ShadowRoot | HTMLElement, origin: MorphRect | null): void {
  const target =
    root.querySelector<HTMLElement>(".ldcv-update-float.is-expanded") ||
    root.querySelector<HTMLElement>(".ldcv-native-notice__menu");
  animateHoverCardFromRect(target, origin);
}

function animateImageViewerMorph(root: ShadowRoot | HTMLElement, origin: MorphRect | null): void {
  const backdrop = root.querySelector<HTMLElement>("[data-image-viewer-backdrop]");
  const image = root.querySelector<HTMLElement>(".ldcv-image-viewer__stage img");
  animateMorphFromRect(image, origin, {
    durationMs: IMAGE_VIEWER_MORPH_MOTION_MS,
    opacityFrom: 0.82,
    opacityTo: 1,
    scaleFloor: 0.18
  });
  if (!backdrop || !supportsElementMotion(backdrop)) {
    return;
  }
  backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: IMAGE_VIEWER_MORPH_MOTION_MS,
    easing: "ease-out"
  });
}

function animateMorphFromRect(
  target: HTMLElement | null,
  origin: MorphRect | null,
  {
    durationMs,
    opacityFrom,
    opacityTo,
    scaleFloor
  }: {
    durationMs: number;
    opacityFrom: number;
    opacityTo: number;
    scaleFloor: number;
  }
): void {
  if (!target || !origin || !supportsElementMotion(target)) {
    return;
  }

  const targetRect = target.getBoundingClientRect();
  if (targetRect.width <= 0 || targetRect.height <= 0) {
    return;
  }

  const originCenterX = origin.left + origin.width / 2;
  const originCenterY = origin.top + origin.height / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const scaleX = Math.max(origin.width / targetRect.width, scaleFloor);
  const scaleY = Math.max(origin.height / targetRect.height, scaleFloor);

  target.animate(
    [
      {
        opacity: opacityFrom,
        transform: `translate3d(${Math.round(originCenterX - targetCenterX)}px, ${Math.round(
          originCenterY - targetCenterY
        )}px, 0) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`
      },
      {
        opacity: opacityTo,
        transform: "translate3d(0, 0, 0) scale(1)"
      }
    ],
    {
      duration: durationMs,
      easing: MORPH_MOTION_EASING
    }
  );
}

function animateHoverCardFromRect(target: HTMLElement | null, origin: MorphRect | null): void {
  if (!target || !supportsElementMotion(target)) {
    return;
  }

  const targetRect = target.getBoundingClientRect();
  if (targetRect.width <= 0 || targetRect.height <= 0) {
    return;
  }

  const originCenterX = origin ? origin.left + origin.width / 2 : targetRect.left + targetRect.width / 2;
  const originCenterY = origin ? origin.top + origin.height / 2 : targetRect.top - 8;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;
  const translateX = clampMotionDelta(originCenterX - targetCenterX, 24);
  const translateY = clampMotionDelta(originCenterY - targetCenterY, 18);

  target.animate(
    [
      {
        filter: "blur(1px)",
        opacity: 0,
        transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(0.96)`
      },
      {
        filter: "blur(0)",
        offset: 0.72,
        opacity: 1,
        transform: "translate3d(0, -2px, 0) scale(1.012)"
      },
      {
        filter: "blur(0)",
        opacity: 1,
        transform: "translate3d(0, 0, 0) scale(1)"
      }
    ],
    {
      duration: HOVER_CARD_MOTION_MS,
      easing: HOVER_CARD_MOTION_EASING
    }
  );
}

function clampMotionDelta(value: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(Math.min(Math.max(value, -max), max));
}

function morphRectFromElement(element: Element): MorphRect | null {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

function isPrivateMessageComposeHost(root: ShadowRoot | HTMLElement): boolean {
  return root instanceof ShadowRoot && root.host instanceof HTMLElement && root.host.classList.contains("ldcv-private-message-compose-host");
}

function setSettingsPanelMotionState(panel: HTMLElement, open: boolean): void {
  settingsPanelAnimations.get(panel)?.cancel();
  settingsPanelAnimations.delete(panel);

  panel.setAttribute("aria-hidden", open ? "false" : "true");

  if (!supportsElementMotion(panel)) {
    panel.dataset.motionState = open ? "open" : "closed";
    panel.toggleAttribute("hidden", !open);
    return;
  }

  if (open) {
    const wasHidden = panel.hasAttribute("hidden");
    panel.removeAttribute("hidden");
    panel.dataset.motionState = "open";
    if (!wasHidden) {
      return;
    }

    const targetHeight = measuredElementHeight(panel);
    const animation = panel.animate(
      [
        { maxHeight: "0px", opacity: 0, transform: "translateY(-4px) scale(0.985)" },
        { maxHeight: `${targetHeight}px`, opacity: 1, transform: "translateY(0) scale(1)" }
      ],
      {
        duration: SETTINGS_PANEL_MOTION_MS,
        easing: ACCORDION_MOTION_EASING
      }
    );
    settingsPanelAnimations.set(panel, animation);
    animation.onfinish = () => {
      if (settingsPanelAnimations.get(panel) !== animation) {
        return;
      }
      settingsPanelAnimations.delete(panel);
    };
    return;
  }

  if (panel.hasAttribute("hidden")) {
    panel.dataset.motionState = "closed";
    return;
  }

  const startHeight = measuredElementHeight(panel);
  panel.dataset.motionState = "closing";
  const animation = panel.animate(
    [
      { maxHeight: `${startHeight}px`, opacity: 1, transform: "translateY(0) scale(1)" },
      { maxHeight: "0px", opacity: 0, transform: "translateY(-4px) scale(0.985)" }
    ],
    {
      duration: SETTINGS_PANEL_MOTION_MS,
      easing: ACCORDION_MOTION_EASING
    }
  );
  settingsPanelAnimations.set(panel, animation);
  animation.onfinish = () => {
    if (settingsPanelAnimations.get(panel) !== animation) {
      return;
    }
    settingsPanelAnimations.delete(panel);
    if (!settingsPanelOpen) {
      panel.dataset.motionState = "closed";
      panel.setAttribute("hidden", "");
    }
  };
}

function setReaderCommentExpanded(comment: HTMLElement, expanded: boolean): void {
  const content = comment.querySelector<HTMLElement>(".ldcv-reader-comment__content");
  if (!content) {
    comment.classList.toggle("is-expanded", expanded);
    comment.classList.toggle("is-collapsed", !expanded);
    return;
  }

  commentContentAnimations.get(content)?.cancel();
  commentContentAnimations.delete(content);

  const startHeight = measuredElementHeight(content);
  comment.classList.toggle("is-expanded", expanded);
  comment.classList.toggle("is-collapsed", !expanded);

  if (!supportsElementMotion(content)) {
    cleanupReaderCommentMotion(comment, content);
    return;
  }

  const targetHeight = expanded ? content.scrollHeight : collapsedCommentHeight(content);
  if (Math.abs(targetHeight - startHeight) < 1) {
    cleanupReaderCommentMotion(comment, content);
    return;
  }

  content.style.maxHeight = `${startHeight}px`;
  comment.classList.add("is-animating");

  const animation = content.animate(
    [
      { maxHeight: `${startHeight}px`, opacity: expanded ? 0.96 : 1 },
      { maxHeight: `${targetHeight}px`, opacity: expanded ? 1 : 0.96 }
    ],
    {
      duration: expanded ? COMMENT_EXPAND_MOTION_MS : COMMENT_COLLAPSE_MOTION_MS,
      easing: ACCORDION_MOTION_EASING
    }
  );
  commentContentAnimations.set(content, animation);
  animation.onfinish = () => {
    if (commentContentAnimations.get(content) !== animation) {
      return;
    }
    commentContentAnimations.delete(content);
    cleanupReaderCommentMotion(comment, content);
  };
}

function cleanupReaderCommentMotion(comment: HTMLElement, content: HTMLElement): void {
  comment.classList.remove("is-animating");
  content.style.removeProperty("max-height");
}

function bindReaderCommentMediaExpansion(root: ShadowRoot): void {
  root
    .querySelectorAll<HTMLElement>(
      ".ldcv-reader-comment__content img, .ldcv-reader-comment__content video, .ldcv-reader-comment__content iframe"
    )
    .forEach((media) => {
      const release = () => releaseExpandedReaderCommentHeight(media);
      media.addEventListener("load", release, { once: true });
      media.addEventListener("error", release, { once: true });
      media.addEventListener("loadedmetadata", release, { once: true });
      if (media instanceof HTMLImageElement && media.complete) {
        release();
      }
    });
}

function expandReaderCommentForElement(element: Element): void {
  const comment = element.closest<HTMLElement>(".ldcv-reader-comment");
  if (!comment) {
    return;
  }

  if (!comment.classList.contains("is-expanded")) {
    setReaderCommentExpanded(comment, true);
    const toggle = comment.querySelector<HTMLButtonElement>("[data-action='toggle-comment']");
    if (toggle) {
      updateCommentToggleButton(toggle, true);
    }
  }
  releaseExpandedReaderCommentHeight(element);
}

function releaseExpandedReaderCommentHeight(element: Element): void {
  const comment = element.closest<HTMLElement>(".ldcv-reader-comment.is-expanded");
  const content = comment?.querySelector<HTMLElement>(".ldcv-reader-comment__content");
  if (!comment || !content) {
    return;
  }

  commentContentAnimations.get(content)?.cancel();
  commentContentAnimations.delete(content);
  cleanupReaderCommentMotion(comment, content);
}

function collapsedCommentHeight(content: HTMLElement): number {
  const computed = window.getComputedStyle(content);
  const fontSize = Number.parseFloat(computed.fontSize);
  const fallback = Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 10.4 : 164;
  return Math.min(content.scrollHeight || fallback, fallback);
}

function measuredElementHeight(element: HTMLElement): number {
  const measured = element.getBoundingClientRect().height;
  if (measured > 0) {
    return measured;
  }
  return element.scrollHeight;
}

function supportsElementMotion(element: HTMLElement): boolean {
  return typeof element.animate === "function" && !prefersReducedMotion();
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function containReaderWheel(event: WheelEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  const scroller = target?.closest<HTMLElement>(".ldcv-reader-scroll");
  if (!scroller) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  event.stopPropagation();
  if (event.deltaY === 0) {
    return;
  }

  const canScroll = scroller.scrollHeight > scroller.clientHeight;
  const atTop = scroller.scrollTop <= 0;
  const atBottom = Math.ceil(scroller.scrollTop + scroller.clientHeight) >= scroller.scrollHeight;
  if (!canScroll || (event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
    event.preventDefault();
  }
}

function trackReaderTouchStart(event: TouchEvent): void {
  readerTouchY = event.touches[0]?.clientY ?? null;
}

function containReaderTouchMove(event: TouchEvent): void {
  const currentY = event.touches[0]?.clientY;
  const previousY = readerTouchY;
  readerTouchY = currentY ?? null;

  const target = event.target instanceof Element ? event.target : null;
  const scroller = target?.closest<HTMLElement>(".ldcv-reader-scroll");
  if (!scroller || typeof currentY !== "number" || typeof previousY !== "number") {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  event.stopPropagation();
  const deltaY = previousY - currentY;
  const canScroll = scroller.scrollHeight > scroller.clientHeight;
  const atTop = scroller.scrollTop <= 0;
  const atBottom = Math.ceil(scroller.scrollTop + scroller.clientHeight) >= scroller.scrollHeight;
  if (!canScroll || (deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
    event.preventDefault();
  }
}

function normalizeLayout(value: string | undefined): CardLayout {
  if (value === "masonry" || value === "reader") {
    return value;
  }
  return "grid";
}

function normalizeCommentSortOrder(value: string | undefined): CommentSortOrder {
  return value === "desc" ? "desc" : "asc";
}

function normalizeReaderPostAction(value: string | undefined): ReaderPostAction | null {
  if (value === "reply" || value === "like" || value === "bookmark" || value === "flag") {
    return value;
  }
  return null;
}

function updateCommentToggleButton(button: HTMLButtonElement, expanded: boolean): void {
  const title = expanded ? "收起评论" : "展开评论";
  button.innerHTML = icons.chevronDown;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.setAttribute("aria-expanded", expanded ? "true" : "false");
}

function applyReaderPollVoteFeedback(root: ShadowRoot, feedback: ReaderPollVoteFeedback | null): void {
  if (!feedback) {
    return;
  }

  const selectedOptionIds = new Set(feedback.optionIds);
  root.querySelectorAll<HTMLElement>(".ldcv-reader-poll").forEach((poll) => {
    if (
      Number(poll.dataset.readerPollPostId) !== feedback.postId ||
      (poll.dataset.readerPollName || "") !== feedback.pollName
    ) {
      return;
    }

    poll.querySelectorAll<HTMLButtonElement>("[data-reader-poll-vote]").forEach((button) => {
      const selected = selectedOptionIds.has(button.dataset.readerPollOptionId || "");
      button.classList.toggle("is-selected", selected);
      button.disabled = feedback.status === "pending";
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });

    if (feedback.poll) {
      applyReaderPollResult(poll, feedback.poll, selectedOptionIds);
    }

    const feedbackNode = poll.querySelector<HTMLElement>("[data-reader-poll-feedback]") ?? document.createElement("div");
    feedbackNode.className = `ldcv-reader-poll__feedback is-${feedback.status}`;
    feedbackNode.setAttribute("data-reader-poll-feedback", "true");
    feedbackNode.setAttribute("role", "status");
    feedbackNode.textContent = feedback.message;
    if (!feedbackNode.parentElement) {
      poll.appendChild(feedbackNode);
    }
  });
}

function applyReaderPollResult(
  poll: HTMLElement,
  result: NonNullable<ReaderPollVoteFeedback["poll"]>,
  selectedOptionIds: ReadonlySet<string>
): void {
  const totalVotes = result.options.reduce((sum, option) => sum + option.votes, 0);
  poll.dataset.readerPollVoters = String(result.voters);
  const votersLabel = poll.querySelector<HTMLElement>("[data-reader-poll-voters-label]");
  if (votersLabel) {
    votersLabel.textContent = formatReaderPollVoterCount(result.voters);
  }

  result.options.forEach((option) => {
    const optionNode = Array.from(poll.querySelectorAll<HTMLElement>("[data-reader-poll-option-id]")).find(
      (node) => node.dataset.readerPollOptionId === option.id
    );
    if (!optionNode) {
      return;
    }

    optionNode.dataset.readerPollOptionVotes = String(option.votes);
    optionNode.classList.toggle("is-selected", selectedOptionIds.has(option.id));
    const percent = readerPollOptionPercent(option.votes, totalVotes);
    const resultNode =
      optionNode.querySelector<HTMLElement>("[data-reader-poll-option-result]") ?? document.createElement("span");
    resultNode.className = "ldcv-reader-poll__option-result";
    resultNode.setAttribute("data-reader-poll-option-result", "true");
    resultNode.textContent = `${option.votes} 票 · ${percent}`;
    if (!resultNode.parentElement) {
      optionNode.querySelector<HTMLElement>(".ldcv-reader-poll__option-row")?.appendChild(resultNode);
    }

    const bar =
      optionNode.querySelector<HTMLElement>("[data-reader-poll-option-bar]") ??
      createReaderPollBar(optionNode.ownerDocument);
    bar.style.width = percent;
    if (!bar.parentElement) {
      const barHost = document.createElement("div");
      barHost.className = "ldcv-reader-poll__bar";
      barHost.setAttribute("aria-hidden", "true");
      barHost.appendChild(bar);
      optionNode.appendChild(barHost);
    }
  });
}

function createReaderPollBar(documentRef: Document): HTMLElement {
  const bar = documentRef.createElement("span");
  bar.setAttribute("data-reader-poll-option-bar", "true");
  return bar;
}

function readerPollOptionPercent(votes: number, totalVotes: number): string {
  if (totalVotes <= 0) {
    return "0%";
  }
  return `${Math.round((votes / totalVotes) * 100)}%`;
}

function formatReaderPollVoterCount(voters: number): string {
  return `${Math.max(0, voters)} 投票人`;
}

function bindReaderControlEventBoundaries(root: ShadowRoot): void {
  root.querySelectorAll<HTMLElement>(READER_CONTROL_BOUNDARY_SELECTOR).forEach((element) => {
    READER_CONTROL_BOUNDARY_EVENTS.forEach((eventType) => {
      element.addEventListener(eventType, stopReaderControlEvent);
    });
  });
}

function bindReaderCopyCodeDelegation(root: ShadowRoot): void {
  root.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const button = event.target.closest<HTMLButtonElement>("[data-reader-copy-code='true']");
    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const codeBlock = button.closest(".ldcv-reader-code-block");
    const code = codeBlock?.querySelector("code");
    if (!code || !code.textContent) {
      return;
    }

    navigator.clipboard.writeText(code.textContent).then(() => {
      const originalText = button.textContent || "复制";
      button.textContent = "已复制";
      setTimeout(() => {
        if (button.textContent === "已复制") {
          button.textContent = originalText;
        }
      }, 2000);
    }).catch(() => {
      button.textContent = "复制失败";
    });
  }, { capture: true });
}

function bindReaderProseEventBoundaries(root: ShadowRoot): void {
  root.querySelectorAll<HTMLElement>(".ldcv-reader-prose").forEach((element) => {
    READER_PROSE_BOUNDARY_EVENTS.forEach((eventType) => {
      element.addEventListener(eventType, stopReaderControlEvent);
    });
  });
}

function stopReaderControlEvent(event: Event): void {
  event.stopPropagation();
}

function eventPathContainsSelector(event: Event, selector: string): boolean {
  return event.composedPath().some((target) => target instanceof Element && Boolean(target.closest(selector)));
}

function hasNonCollapsedReaderSelection(root: ShadowRoot | HTMLElement): boolean {
  const getSelectionFromRoot = (root as ShadowRoot & { getSelection?: () => Selection | null }).getSelection;
  const selection = typeof getSelectionFromRoot === "function" ? getSelectionFromRoot.call(root) : document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  return node === root || root.contains(node);
}



function bindReaderCommentFilters(root: ShadowRoot): void {
  const search = root.querySelector<HTMLInputElement>("[data-reader-comment-search]");
  const clear = root.querySelector<HTMLButtonElement>("[data-reader-comment-search-clear]");
  const onlyOp = root.querySelector<HTMLInputElement>("[data-reader-only-op]");
  const onlyOpLabel = onlyOp?.closest<HTMLElement>(".ldcv-reader-op-filter") ?? null;
  if (!search && !onlyOp) {
    return;
  }

  const apply = (): void => {
    const term = (search?.value || "").trim().toLowerCase();
    const opOnly = Boolean(onlyOp?.checked);
    const result = applyReaderCommentFilters(root, term, opOnly);

    const count = root.querySelector<HTMLElement>("[data-reader-filter-count]");
    if (count) {
      count.textContent = term || opOnly ? `${result.visible}/${result.total}` : "";
    }
    if (clear) {
      clear.hidden = !search?.value;
    }
  };

  search?.addEventListener("input", apply);
  search?.addEventListener("click", () => {
    search.focus();
  });
  clear?.addEventListener("click", () => {
    if (!search) {
      return;
    }
    search.value = "";
    apply();
    search.focus();
  });
  onlyOpLabel?.addEventListener("click", (event) => {
    if (!onlyOp || event.target === onlyOp) {
      return;
    }
    event.preventDefault();
    onlyOp.checked = !onlyOp.checked;
    apply();
  });
  onlyOp?.addEventListener("click", apply);
  onlyOp?.addEventListener("change", apply);
  apply();
}

export function applyReaderCommentFilters(
  root: ParentNode,
  term: string,
  opOnly: boolean
): { visible: number; total: number } {
  const normalizedTerm = term.trim().toLowerCase();
  const comments = Array.from(root.querySelectorAll<HTMLElement>(".ldcv-reader-comment"));
  let visible = 0;

  comments.forEach((comment) => {
    const matchesOp = !opOnly || comment.dataset.originalPoster === "true";
    const matchesTerm = !normalizedTerm || (comment.textContent || "").toLowerCase().includes(normalizedTerm);
    const hidden = !(matchesOp && matchesTerm);
    comment.hidden = hidden;
    if (!hidden) {
      visible += 1;
    }
  });

  root.querySelectorAll<HTMLElement>(".ldcv-reader-replies").forEach((group) => {
    group.hidden = !Array.from(group.querySelectorAll<HTMLElement>(".ldcv-reader-comment")).some((comment) => !comment.hidden);
  });

  return {
    visible,
    total: comments.length
  };
}

function isBooleanSettingKey(value: string | undefined): value is keyof Pick<
  ExtensionSettings,
  "enabled" | "autoLoadReaderComments" | "newTopicNoticeEnabled" | "collapseLongComments"
> {
  return (
    value === "enabled" ||
    value === "autoLoadReaderComments" ||
    value === "newTopicNoticeEnabled" ||
    value === "collapseLongComments"
  );
}

function isSelectSettingKey(value: string | undefined): value is keyof Pick<
  ExtensionSettings,
  "layout" | "density" | "commentSortOrder" | "topicUrlView"
> {
  return value === "layout" || value === "density" || value === "commentSortOrder" || value === "topicUrlView";
}

function isNumberSettingKey(value: string | undefined): value is keyof Pick<
  ExtensionSettings,
  | "readerPostBatchSize"
  | "newTopicCheckIntervalSeconds"
  | "creditTopicViewDwellSeconds"
  | "creditViewedTopicStorageMax"
> {
  return (
    value === "readerPostBatchSize"
    || value === "newTopicCheckIntervalSeconds"
    || value === "creditTopicViewDwellSeconds"
    || value === "creditViewedTopicStorageMax"
  );
}

function isPendingNoticeOnlyChange(
  options: RenderOptions,
  lastFingerprint: string | null
): boolean {
  if (!lastFingerprint) {
    return false;
  }
  try {
    const last = JSON.parse(lastFingerprint);
    const current = JSON.parse(renderBackgroundFingerprint(options, options.enteringTopicIds ?? new Set()));

    const pendingKeys = [
      "pendingNewTopicCount",
      "pendingNewTopics",
      "pendingNoticeExpanded",
      "pendingNoticeMinimized",
    ] as const;
    const keysToExclude = [...pendingKeys, "updatedAt"];

    for (const key of Object.keys(current)) {
      if (keysToExclude.includes(key)) {
        continue;
      }
      if (JSON.stringify(current[key]) !== JSON.stringify(last[key])) {
        return false;
      }
    }

    return pendingKeys.some((key) => JSON.stringify(current[key]) !== JSON.stringify(last[key]));
  } catch {
    return false;
  }
}

function patchPendingNoticeOnly(options: RenderOptions): boolean {
  const { root, settings, pendingNewTopicCount, pendingNewTopics, pendingNoticeExpanded, pendingNoticeMinimized, reader, viewedTopicIds, justReadTopicIds } = options;
  if (settings.layout === "reader") {
    return false;
  }

  const grid = root.querySelector(`.ldcv-grid[data-card-grid="${settings.layout}"]`);
  if (!grid) {
    return false;
  }

  patchReaderCardStates(root, reader.topicId, viewedTopicIds, justReadTopicIds);
  syncReaderCardStateFingerprint(root, reader.topicId, viewedTopicIds, justReadTopicIds);

  const popover = root.querySelector(".ldcv-toolbar-popover");
  let toolbarNoticeHost = root.querySelector<HTMLElement>("[data-toolbar-pending-notice-root]");
  if (pendingNewTopicCount > 0) {
    const nextHtml = toolbarPendingTemplate(pendingNewTopicCount, pendingNoticeExpanded).trim();
    const template = document.createElement("template");
    template.innerHTML = nextHtml;
    const nextNode = template.content.firstElementChild as HTMLElement;

    if (!toolbarNoticeHost && popover) {
      if (nextNode) {
        const sibling = popover.querySelector("[data-toolbar-actions-host]");
        if (sibling) {
          popover.insertBefore(nextNode, sibling);
        } else {
          popover.append(nextNode);
        }
        toolbarNoticeHost = nextNode;
      }
    } else if (toolbarNoticeHost && nextNode) {
      toolbarNoticeHost.className = nextNode.className;
      for (const attr of Array.from(nextNode.attributes)) {
        if (attr.name !== "style") {
          toolbarNoticeHost.setAttribute(attr.name, attr.value);
        }
      }
    }
  } else {
    if (toolbarNoticeHost) {
      unmountToolbarPendingNotices(root);
      toolbarNoticeHost.remove();
    }
  }

  let floatingNoticeHost = root.querySelector<HTMLElement>("[data-floating-pending-notice-root]");
  const allowFloatingPendingNotice = options.allowFloatingPendingNotice ?? true;
  const useNativePendingNotice = options.useNativePendingNotice ?? false;
  const showFloating = pendingNewTopicCount > 0 && allowFloatingPendingNotice && !useNativePendingNotice;
  if (showFloating) {
    const nextHtml = floatingPendingNoticeTemplate(
      pendingNewTopicCount,
      pendingNewTopics,
      pendingNoticeExpanded,
      pendingNoticeMinimized
    ).trim();
    const template = document.createElement("template");
    template.innerHTML = nextHtml;
    const nextNode = template.content.firstElementChild as HTMLElement;

    if (floatingNoticeHost) {
      const currentTagName = floatingNoticeHost.tagName.toLowerCase();
      const nextTagName = nextNode ? nextNode.tagName.toLowerCase() : "";

      if (currentTagName !== nextTagName) {
        unmountFloatingPendingNotices(root);
        const section = root.querySelector("section");
        if (nextNode) {
          if (section && section.nextSibling) {
            root.insertBefore(nextNode, section.nextSibling);
          } else {
            root.append(nextNode);
          }
          floatingNoticeHost.remove();
          floatingNoticeHost = nextNode;
        }
      } else if (nextNode) {
        floatingNoticeHost.className = nextNode.className;
        for (const attr of Array.from(nextNode.attributes)) {
          if (attr.name !== "style") {
            floatingNoticeHost.setAttribute(attr.name, attr.value);
          }
        }
      }
    } else if (nextNode) {
      const section = root.querySelector("section");
      if (section && section.nextSibling) {
        root.insertBefore(nextNode, section.nextSibling);
      } else {
        root.append(nextNode);
      }
      floatingNoticeHost = nextNode;
    }
  } else {
    if (floatingNoticeHost) {
      unmountFloatingPendingNotices(root);
      floatingNoticeHost.remove();
    }
  }

  renderFloatingPendingNotices(root, pendingNewTopics);
  renderToolbarPendingNotices(root, pendingNewTopicCount, pendingNoticeExpanded);

  return true;
}
