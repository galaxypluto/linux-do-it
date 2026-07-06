import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyNativeNestedTopicPostEnhancements,
  classicTopicPathFromRoute,
  extractNativeTopicPostNumber,
  nativeNavigationPostNumbers,
  nativeNestedTopicAvailable,
  nestedTopicPathFromRoute,
  nextPostNumberFromCandidates,
  type TopicPageFilterState
} from "../../src/content/topicPageEnhancer";

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.className = "";
  vi.restoreAllMocks();
});

function state(overrides: Partial<TopicPageFilterState> = {}): TopicPageFilterState {
  return {
    query: "",
    opOnly: false,
    compact: true,
    ...overrides
  };
}

function nestedTopicDom(): void {
  document.body.innerHTML = `
    <main id="main-outlet">
      <section class="nested-view">
        <article class="nested-view__op-article boxed" data-post-id="1001" data-post-number="1">
          <div class="topic-meta-data"><span class="username">Alice</span></div>
          <div class="cooked"><p>Opening native post</p></div>
          <button class="reply">Native reply</button>
        </article>
        <div class="nested-post">
          <article class="nested-post__article boxed" data-post-id="1002" data-post-number="2">
            <header class="nested-post__header"><span class="username">Bob</span></header>
            <div class="nested-post__content"><div class="cooked"><p>Plain native reply</p></div></div>
            <button class="reply">Native reply</button>
          </article>
        </div>
        <div class="nested-post">
          <article class="nested-post__article boxed" data-post-id="1003" data-post-number="3">
            <header class="nested-post__header">
              <span class="username">Alice</span>
              <span class="nested-post__op-badge">OP</span>
            </header>
            <div class="nested-post__content"><div class="cooked"><p>OP native follow up</p></div></div>
            <button class="reply">Native reply</button>
          </article>
        </div>
      </section>
    </main>
  `;
}

describe("native nested topic route helpers", () => {
  it("builds native nested and regular topic paths from the same route", () => {
    const route = { topicId: 42, slug: "topic", postNumber: 7 };

    expect(nestedTopicPathFromRoute(route)).toBe("/n/topic/42/7");
    expect(nestedTopicPathFromRoute(route, null)).toBe("/n/topic/42");
    expect(classicTopicPathFromRoute(route)).toBe("/t/topic/42/7");
    expect(classicTopicPathFromRoute(route, null)).toBe("/t/topic/42");
  });

  it("checks the native nested JSON contract before bridging", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({ roots: [], op_post: { post_number: 1 } }), {
        headers: { "content-type": "application/json" },
        status: 200
      });
    });

    await expect(nativeNestedTopicAvailable({ topicId: 42, slug: "topic", postNumber: null }, undefined, fetcher)).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      "/n/topic/42.json",
      expect.objectContaining({
        credentials: "include",
        headers: { Accept: "application/json" }
      })
    );
  });

  it("rejects unavailable or non-json nested endpoints", async () => {
    const notFound = vi.fn(async () => new Response("{}", { status: 404, headers: { "content-type": "application/json" } }));
    const html = vi.fn(async () => new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }));

    await expect(nativeNestedTopicAvailable({ topicId: 42, slug: "topic", postNumber: null }, undefined, notFound)).resolves.toBe(false);
    await expect(nativeNestedTopicAvailable({ topicId: 42, slug: "topic", postNumber: null }, undefined, html)).resolves.toBe(false);
  });
});

describe("native nested topic post enhancement", () => {
  it("extracts post numbers from nested attributes and native anchors", () => {
    document.body.innerHTML = `
      <article class="nested-post__article" data-post-number="5"></article>
      <article class="nested-post__article" id="post_6"></article>
      <article class="nested-post__article"><a class="post-date" href="/n/topic/10/7">date</a></article>
      <article class="nested-post__article"><a class="post-date" href="/t/topic/10/8">date</a></article>
    `;

    const posts = Array.from(document.querySelectorAll(".nested-post__article"));

    expect(extractNativeTopicPostNumber(posts[0]!)).toBe(5);
    expect(extractNativeTopicPostNumber(posts[1]!)).toBe(6);
    expect(extractNativeTopicPostNumber(posts[2]!)).toBe(7);
    expect(extractNativeTopicPostNumber(posts[3]!)).toBe(8);
  });

  it("filters native nested posts for search without injecting reply tree markup", () => {
    nestedTopicDom();

    const result = applyNativeNestedTopicPostEnhancements(document, state({ query: "follow" }));
    const posts = Array.from(document.querySelectorAll<HTMLElement>("[data-post-number]"));

    expect(result).toEqual({ enhanced: 3, matched: 1 });
    expect(posts.map((item) => item.dataset.ldcvPostNumber)).toEqual(["1", "2", "3"]);
    expect(posts[0]?.classList.contains("ldcv-topic-post-hidden")).toBe(true);
    expect(posts[2]?.classList.contains("ldcv-topic-post-match")).toBe(true);
    expect(document.querySelector(".ldcv-topic-op-badge")).toBeNull();
    expect(document.querySelector(".ldcv-topic-reply-target")).toBeNull();
  });

  it("uses native OP badges and the OP article for OP-only filtering", () => {
    nestedTopicDom();

    const result = applyNativeNestedTopicPostEnhancements(document, state({ opOnly: true }));

    expect(result).toEqual({ enhanced: 3, matched: 2 });
    expect(document.querySelector<HTMLElement>('[data-post-number="1"]')?.classList.contains("ldcv-topic-post-hidden")).toBe(false);
    expect(document.querySelector<HTMLElement>('[data-post-number="2"]')?.classList.contains("ldcv-topic-post-hidden")).toBe(true);
    expect(document.querySelector<HTMLElement>('[data-post-number="3"]')?.classList.contains("ldcv-topic-post-hidden")).toBe(false);
  });

  it("navigates visible native nested matches in native rendered order", () => {
    nestedTopicDom();

    expect(nativeNavigationPostNumbers(document, state({ query: "native" }))).toEqual([1, 2, 3]);
    expect(nativeNavigationPostNumbers(document, state({ opOnly: true }))).toEqual([1, 3]);
    expect(nextPostNumberFromCandidates([1, 3], 1, 1)).toBe(3);
  });
});
