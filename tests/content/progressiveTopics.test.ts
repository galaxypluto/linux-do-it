import { describe, expect, it } from "vitest";
import {
  INITIAL_TOPIC_RENDER_BATCH,
  MAX_TOPIC_RENDER_BATCH,
  consumeSameScrollLoadMoreSuppression,
  initialVisibleTopicCount,
  loadMoreRectIntersectsViewportMargin,
  loadMoreObserverRootMargin,
  nextVisibleTopicCount,
  shouldHonorLoadMoreIntersection,
  shouldPreserveAppendPageAnchor,
  shouldScheduleAutomaticTopicReveal,
  visibleTopicCountForLayout
} from "../../src/content/progressiveTopics";

describe("progressive topic batches", () => {
  it("caps the initial visible topic batch at eight", () => {
    expect(initialVisibleTopicCount(3)).toBe(3);
    expect(initialVisibleTopicCount(12)).toBe(INITIAL_TOPIC_RENDER_BATCH);
  });

  it("reveals remaining topics in bounded batches until all are visible", () => {
    expect(nextVisibleTopicCount(8, 20)).toBe(16);
    expect(nextVisibleTopicCount(16, 20)).toBe(20);
    expect(nextVisibleTopicCount(20, 20)).toBe(20);
    expect(nextVisibleTopicCount(0, 60, 30)).toBe(MAX_TOPIC_RENDER_BATCH);
  });

  it("uses progressive reveal in masonry instead of rendering large batches at once", () => {
    expect(visibleTopicCountForLayout("masonry", 30, 0, true)).toBe(INITIAL_TOPIC_RENDER_BATCH);
    expect(visibleTopicCountForLayout("masonry", 46, 30, false)).toBe(30);
    expect(visibleTopicCountForLayout("masonry", 60, 0, true, 30)).toBe(MAX_TOPIC_RENDER_BATCH);
    expect(visibleTopicCountForLayout("grid", 30, 0, true)).toBe(INITIAL_TOPIC_RENDER_BATCH);
    expect(visibleTopicCountForLayout("reader", 30, 8, false)).toBe(8);
  });

  it("keeps card and masonry progressive reveal user-driven to avoid background scroll jumps", () => {
    expect(shouldScheduleAutomaticTopicReveal("grid")).toBe(false);
    expect(shouldScheduleAutomaticTopicReveal("reader")).toBe(true);
    expect(shouldScheduleAutomaticTopicReveal("masonry")).toBe(false);
  });

  it("preserves page anchors only for reader appends, not bottom grid or masonry reveals", () => {
    expect(shouldPreserveAppendPageAnchor("grid")).toBe(false);
    expect(shouldPreserveAppendPageAnchor("reader")).toBe(true);
    expect(shouldPreserveAppendPageAnchor("masonry")).toBe(false);
  });

  it("uses the same preload margin for masonry and card view so loading starts before the page bottom", () => {
    expect(loadMoreObserverRootMargin("grid")).toBe("320px 0px");
    expect(loadMoreObserverRootMargin("reader")).toBe("320px 0px");
    expect(loadMoreObserverRootMargin("masonry")).toBe("320px 0px");
  });

  it("honors masonry load-more intersections immediately like card view", () => {
    expect(
      shouldHonorLoadMoreIntersection({
        layout: "masonry",
        isIntersecting: true
      })
    ).toBe(true);
    expect(
      shouldHonorLoadMoreIntersection({
        layout: "masonry",
        isIntersecting: true
      })
    ).toBe(true);
    expect(
      shouldHonorLoadMoreIntersection({
        layout: "grid",
        isIntersecting: true
      })
    ).toBe(true);
    expect(
      shouldHonorLoadMoreIntersection({
        layout: "masonry",
        isIntersecting: false
      })
    ).toBe(false);
  });

  it("consumes same-scroll load-more suppression only once", () => {
    expect(consumeSameScrollLoadMoreSuppression(null, 120)).toEqual({
      suppressed: false,
      nextSuppressedScrollY: null
    });
    expect(consumeSameScrollLoadMoreSuppression(100, 103)).toEqual({
      suppressed: true,
      nextSuppressedScrollY: null
    });
    expect(consumeSameScrollLoadMoreSuppression(100, 108)).toEqual({
      suppressed: false,
      nextSuppressedScrollY: null
    });
  });

  it("checks whether the load-more sentinel is inside the observer preload margin", () => {
    expect(
      loadMoreRectIntersectsViewportMargin({
        rectTop: 1_100,
        rectBottom: 1_140,
        viewportHeight: 800,
        rootMargin: "320px 0px"
      })
    ).toBe(true);
    expect(
      loadMoreRectIntersectsViewportMargin({
        rectTop: 1_180,
        rectBottom: 1_220,
        viewportHeight: 800,
        rootMargin: "320px 0px"
      })
    ).toBe(false);
    expect(
      loadMoreRectIntersectsViewportMargin({
        rectTop: -40,
        rectBottom: -1,
        viewportHeight: 800,
        rootMargin: "0px"
      })
    ).toBe(false);
  });
});
