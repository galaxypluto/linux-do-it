import { describe, expect, it, vi } from "vitest";
import {
  capturePageScrollAnchor,
  captureReaderScroll,
  revealReaderPost,
  restorePageScrollAnchor,
  restoreReaderScroll,
  scrollToPageTop,
  scrollToTopicCard
} from "../../src/content/scrollState";

function shadowRootWith(html: string): ShadowRoot {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = html;
  return root;
}

function setRect(element: Element, rect: Partial<DOMRect>): void {
  element.getBoundingClientRect = () =>
    ({
      x: rect.left ?? 0,
      y: rect.top ?? 0,
      left: rect.left ?? 0,
      top: rect.top ?? 0,
      right: rect.right ?? (rect.left ?? 0) + (rect.width ?? 0),
      bottom: rect.bottom ?? (rect.top ?? 0) + (rect.height ?? 0),
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      toJSON: () => ({})
    }) as DOMRect;
}

describe("reader scroll state", () => {
  it("captures reader scroll from the active reader article", () => {
    const root = shadowRootWith(`
      <article class="ldcv-reader-article" data-reader-topic-id="42">
        <div class="ldcv-reader-scroll"></div>
      </article>
    `);
    const scroller = root.querySelector<HTMLElement>(".ldcv-reader-scroll")!;
    scroller.scrollTop = 120;
    scroller.scrollLeft = 8;

    expect(captureReaderScroll(root)).toEqual({
      topicId: 42,
      scrollTop: 120,
      scrollLeft: 8
    });
  });

  it("restores reader scroll only for the same topic and clamps the top offset", () => {
    const root = shadowRootWith(`
      <article class="ldcv-reader-article" data-reader-topic-id="42">
        <div class="ldcv-reader-scroll"></div>
      </article>
    `);
    const scroller = root.querySelector<HTMLElement>(".ldcv-reader-scroll")!;
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 500 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 300 });
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    restoreReaderScroll(root, { topicId: 42, scrollTop: 400, scrollLeft: 9 }, 42, false, requestFrame);

    expect(scroller.scrollTop).toBe(200);
    expect(scroller.scrollLeft).toBe(9);
    expect(requestFrame).toHaveBeenCalledTimes(1);

    scroller.scrollTop = 0;
    restoreReaderScroll(root, { topicId: 43, scrollTop: 120, scrollLeft: 0 }, 42, false, requestFrame);
    expect(scroller.scrollTop).toBe(0);
  });

  it("reveals a post inside the reader scroll container", () => {
    const root = shadowRootWith(`
      <article class="ldcv-reader-article" data-reader-topic-id="42">
        <div class="ldcv-reader-scroll">
          <article class="ldcv-reader-comment" id="ldcv-post-34"></article>
        </div>
      </article>
    `);
    const scroller = root.querySelector<HTMLElement>(".ldcv-reader-scroll")!;
    const post = root.querySelector<HTMLElement>("#ldcv-post-34")!;
    scroller.scrollTop = 100;
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 600 });
    setRect(scroller, { top: 100, bottom: 700, height: 600, width: 700 });
    setRect(post, { top: 900, bottom: 1020, height: 120, width: 680 });
    const scrollTo = vi.fn((options: ScrollToOptions) => {
      scroller.scrollTop = Number(options.top);
    });
    scroller.scrollTo = scrollTo;

    expect(revealReaderPost(root, 34)).toBe(true);

    expect(scrollTo).toHaveBeenCalledWith({
      top: 660,
      behavior: "smooth"
    });
    expect(scroller.scrollTop).toBe(660);
  });
});

describe("page scroll anchor", () => {
  it("captures the nearest visible card as page anchor", () => {
    const root = shadowRootWith(`
      <article class="ldcv-card" data-topic-id="1"></article>
      <article class="ldcv-card" data-topic-id="2"></article>
      <article class="ldcv-card" data-topic-id="3"></article>
    `);
    const cards = root.querySelectorAll(".ldcv-card");
    setRect(cards[0], { top: -80, bottom: -10, height: 70, width: 300 });
    setRect(cards[1], { top: 120, bottom: 220, height: 100, width: 300 });
    setRect(cards[2], { top: 40, bottom: 140, height: 100, width: 300 });

    expect(capturePageScrollAnchor(root, 500)).toEqual({
      topicId: 3,
      top: 40
    });
  });

  it("restores page position by scrolling the card back to its anchor top", () => {
    const root = shadowRootWith(`<article class="ldcv-card" data-topic-id="7"></article>`);
    const card = root.querySelector(".ldcv-card")!;
    setRect(card, { top: 155, bottom: 255, height: 100, width: 300 });
    const scrollBy = vi.fn();
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const delay = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });

    restorePageScrollAnchor(root, { topicId: 7, top: 100 }, { scrollBy, requestFrame, delay });

    expect(scrollBy).toHaveBeenCalledWith(0, 55);
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(delay).toHaveBeenCalledWith(expect.any(Function), 60);
  });

  it("animates page scroll to a requested topic card with an offset", () => {
    const root = shadowRootWith(`<article class="ldcv-card" data-topic-id="9"></article>`);
    const card = root.querySelector(".ldcv-card")!;
    setRect(card, { top: 400, bottom: 500, height: 100, width: 300 });
    const frames: FrameRequestCallback[] = [];
    const scrollTo = vi.fn();

    const result = scrollToTopicCard(root, 9, {
      durationMs: 100,
      offset: 40,
      now: () => 0,
      scrollY: () => 100,
      scrollTo,
      requestFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      }
    });

    expect(result).toBe(true);
    expect(frames).toHaveLength(1);
    frames[0](50);
    expect(scrollTo).toHaveBeenLastCalledWith(0, expect.any(Number));
    const midY = scrollTo.mock.calls[scrollTo.mock.calls.length - 1]?.[1];
    expect(midY).toBeGreaterThan(100);
    expect(midY).toBeLessThan(460);
    frames[1](100);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 460);
  });

  it("retargets the page scroll when layout shifts during the animation", () => {
    const root = shadowRootWith(`<article class="ldcv-card" data-topic-id="9"></article>`);
    const card = root.querySelector(".ldcv-card")!;
    let scrollY = 100;
    let absoluteTop = 500;
    card.getBoundingClientRect = () =>
      ({
        x: 0,
        y: absoluteTop - scrollY,
        left: 0,
        top: absoluteTop - scrollY,
        right: 300,
        bottom: absoluteTop - scrollY + 100,
        width: 300,
        height: 100,
        toJSON: () => ({})
      }) as DOMRect;
    const frames: FrameRequestCallback[] = [];
    const scrollTo = vi.fn((_: number, y: number) => {
      scrollY = y;
    });

    scrollToTopicCard(root, 9, {
      durationMs: 100,
      offset: 40,
      now: () => 0,
      scrollY: () => scrollY,
      scrollTo,
      requestFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      }
    });

    frames[0](50);
    absoluteTop = 620;
    frames[1](100);

    expect(scrollTo).toHaveBeenLastCalledWith(0, 580);
  });

  it("animates page scroll back to the absolute top", () => {
    const frames: FrameRequestCallback[] = [];
    let currentScrollY = 320;
    const scrollTo = vi.fn((_: number, y: number) => {
      currentScrollY = y;
    });

    scrollToPageTop({
      durationMs: 100,
      now: () => 0,
      scrollY: () => currentScrollY,
      scrollTo,
      requestFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      }
    });

    expect(frames).toHaveLength(1);
    frames[0](50);
    expect(scrollTo).toHaveBeenLastCalledWith(0, expect.any(Number));
    const midY = scrollTo.mock.calls[scrollTo.mock.calls.length - 1]?.[1];
    expect(midY).toBeGreaterThan(0);
    expect(midY).toBeLessThan(320);
    frames[1](100);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
  });
});
