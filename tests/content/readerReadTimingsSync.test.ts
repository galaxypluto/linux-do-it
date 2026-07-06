import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachReaderReadTimingsSync,
  extractPostNumber,
} from "../../src/content/readerReadTimingsSync";

describe("readerReadTimingsSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("extracts post numbers from ldcv-post ids", () => {
    expect(extractPostNumber("ldcv-post-12")).toBe(12);
    expect(extractPostNumber("ldcv-post-0")).toBeNull();
    expect(extractPostNumber("other")).toBeNull();
  });

  it("syncs visible posts after debounce", async () => {
    const scrollRoot = document.createElement("div");
    const post = document.createElement("article");
    post.id = "ldcv-post-3";
    scrollRoot.appendChild(post);
    document.body.appendChild(scrollRoot);

    const syncPostNumbers = vi.fn().mockResolvedValue(true);
    let observerCallback: IntersectionObserverCallback | null = null;

    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn();
      root = null;
      rootMargin = "";
      thresholds: readonly number[] = [];
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    const cleanup = attachReaderReadTimingsSync({
      scrollRoot,
      syncPostNumbers,
      debounceMs: 100,
    });

    observerCallback?.(
      [
        {
          isIntersecting: true,
          target: post,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );

    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();

    expect(syncPostNumbers).toHaveBeenCalledWith(new Set([3]));

    cleanup();
    scrollRoot.remove();
    vi.unstubAllGlobals();
  });
});
