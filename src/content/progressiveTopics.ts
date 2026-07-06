export const INITIAL_TOPIC_RENDER_BATCH = 8;
export const MAX_TOPIC_RENDER_BATCH = 20;
const DEFAULT_LOAD_MORE_ROOT_MARGIN = "320px 0px";
const SAME_SCROLL_SUPPRESSION_TOLERANCE_PX = 4;

type TopicListLayout = "grid" | "masonry" | "reader";

export function initialVisibleTopicCount(totalTopics: number, batchSize = INITIAL_TOPIC_RENDER_BATCH): number {
  return Math.min(normalizeTopicCount(totalTopics), normalizeBatchSize(batchSize));
}

export function nextVisibleTopicCount(
  currentVisibleTopics: number,
  totalTopics: number,
  batchSize = INITIAL_TOPIC_RENDER_BATCH
): number {
  const total = normalizeTopicCount(totalTopics);
  if (total === 0) {
    return 0;
  }
  return Math.min(total, Math.max(0, Math.floor(currentVisibleTopics)) + normalizeBatchSize(batchSize));
}

export function visibleTopicCountForLayout(
  layout: TopicListLayout,
  totalTopics: number,
  currentVisibleTopics: number,
  reset: boolean,
  batchSize = INITIAL_TOPIC_RENDER_BATCH
): number {
  const total = normalizeTopicCount(totalTopics);
  return reset
    ? initialVisibleTopicCount(total, batchSize)
    : Math.min(Math.max(0, Math.floor(currentVisibleTopics), normalizeBatchSize(batchSize)), total);
}

export function shouldScheduleAutomaticTopicReveal(layout: TopicListLayout): boolean {
  return layout === "reader";
}

export function shouldPreserveAppendPageAnchor(layout: TopicListLayout): boolean {
  return layout === "reader";
}

export function loadMoreObserverRootMargin(_layout: TopicListLayout): string {
  return DEFAULT_LOAD_MORE_ROOT_MARGIN;
}

export function shouldHonorLoadMoreIntersection({
  isIntersecting
}: {
  layout: TopicListLayout;
  isIntersecting: boolean;
}): boolean {
  return isIntersecting;
}

export function consumeSameScrollLoadMoreSuppression(
  suppressedScrollY: number | null,
  currentScrollY: number
): { suppressed: boolean; nextSuppressedScrollY: number | null } {
  if (suppressedScrollY === null) {
    return { suppressed: false, nextSuppressedScrollY: null };
  }

  return Math.abs(currentScrollY - suppressedScrollY) <= SAME_SCROLL_SUPPRESSION_TOLERANCE_PX
    ? { suppressed: true, nextSuppressedScrollY: null }
    : { suppressed: false, nextSuppressedScrollY: null };
}

export function loadMoreRectIntersectsViewportMargin({
  rectTop,
  rectBottom,
  viewportHeight,
  rootMargin
}: {
  rectTop: number;
  rectBottom: number;
  viewportHeight: number;
  rootMargin: string;
}): boolean {
  const margin = verticalRootMargin(rootMargin);
  const viewport = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0;
  return rectBottom >= -margin && rectTop <= viewport + margin;
}

function normalizeTopicCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizeBatchSize(value: number): number {
  const normalized = Number.isFinite(value) && value > 0 ? Math.floor(value) : INITIAL_TOPIC_RENDER_BATCH;
  return Math.min(normalized, MAX_TOPIC_RENDER_BATCH);
}

function verticalRootMargin(rootMargin: string): number {
  const firstValue = rootMargin.trim().split(/\s+/)[0] || "0";
  const parsed = Number.parseFloat(firstValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
