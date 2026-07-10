import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TopicCardData, TopicListData, TopicReaderData } from "../../src/discourse/types";
import { DEFAULT_SETTINGS } from "../../src/storage/settings";
import {
  applyReaderCommentFilters,
  closeImageViewerWithMotion,
  closeTransientPanels,
  eventPathContainsTransientPanel,
  renderApp,
  renderNativePendingNotice,
  renderNativeTopControls,
  setLoadMoreLoadingState,
  type ReaderImageViewerState,
  type ReaderUserPreviewState
} from "../../src/ui/render";
import type { ReaderState } from "../../src/ui/readerTypes";

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

interface AnimateMock {
  animations: Animation[];
  calls: unknown[][];
  targets: HTMLElement[];
  restore: () => void;
}

function installAnimateMock(): AnimateMock {
  const original = HTMLElement.prototype.animate;
  const animations: Animation[] = [];
  const calls: unknown[][] = [];
  const targets: HTMLElement[] = [];
  const animate = vi.fn(function (this: HTMLElement, ...args: unknown[]) {
    const animation = {
      cancel: vi.fn(),
      oncancel: null,
      onfinish: null
    } as Animation;
    animations.push(animation);
    calls.push(args);
    targets.push(this);
    return animation;
  });
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate
  });
  return {
    animations,
    calls,
    targets,
    restore: () => {
      if (original) {
        Object.defineProperty(HTMLElement.prototype, "animate", {
          configurable: true,
          value: original
        });
        return;
      }
      Reflect.deleteProperty(HTMLElement.prototype, "animate");
    }
  };
}

function finishAnimation(animation: Animation | undefined): void {
  animation?.onfinish?.call(animation, new Event("finish") as AnimationPlaybackEvent);
}

function mockRect(element: HTMLElement, rect: Partial<DOMRect>): void {
  element.getBoundingClientRect = () =>
    ({
      left: rect.left ?? 0,
      top: rect.top ?? 0,
      width: rect.width ?? 120,
      height: rect.height ?? 40,
      right: rect.right ?? (rect.left ?? 0) + (rect.width ?? 120),
      bottom: rect.bottom ?? (rect.top ?? 0) + (rect.height ?? 40),
      x: rect.x ?? rect.left ?? 0,
      y: rect.y ?? rect.top ?? 0,
      toJSON: () => ({})
    }) as DOMRect;
}

function emptyReaderState(): ReaderState {
  return {
    topicId: null,
    data: null,
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
    creditViewTrackingPhase: null,
    creditViewTrackingStartedAt: null,
  };
}

function topic(id: number, overrides: Partial<TopicCardData> = {}): TopicCardData {
  return {
    id,
    title: `Topic ${id}`,
    url: `/t/topic-${id}/${id}`,
    slug: `topic-${id}`,
    excerpt: `Excerpt ${id}`,
    thumbnailUrl: "",
    tags: [],
    stats: {
      replies: 1,
      views: 20,
      likes: 0,
      score: 0
    },
    dates: {
      createdAt: "2026-05-01T00:00:00.000Z",
      activityAt: "2026-05-02T00:00:00.000Z"
    },
    flags: {
      pinned: false,
      closed: false,
      archived: false,
      bookmarked: false,
      unseen: false
    },
    posters: [],
    ...overrides
  };
}

function topicList(topics: TopicCardData[]): TopicListData {
  return {
    endpoint: "/latest.json",
    topics,
    moreTopicsUrl: "/latest.json?page=1"
  };
}

function readerData(): TopicReaderData {
  return {
    id: 1,
    title: "Reader topic",
    url: "/t/topic-1/1",
    slug: "topic-1",
    stats: {
      posts: 2,
      views: 10,
      likes: 0
    },
    actions: {
      canReply: true,
      draftKey: "topic_1",
      draftSequence: 0
    },
    tags: [],
    opAuthor: {
      id: 1,
      username: "alice",
      name: "Alice",
      avatarUrl: ""
    },
    posts: [
      {
        id: 101,
        postNumber: 1,
        replyToPostNumber: null,
        author: {
          id: 1,
          username: "alice",
          name: "Alice",
          avatarUrl: ""
        },
        createdAt: "2026-05-01T00:00:00.000Z",
        html: "<p>Main</p>",
        stats: {
          likes: 0,
          reads: 0,
          replies: 1
        },
        actions: {
          canReply: true,
          canLike: true,
          liked: false,
          canBookmark: true,
          bookmarked: false
        },
        url: "/t/topic-1/1/1",
        isOriginalPost: true,
        isOriginalPoster: true
      },
      {
        id: 102,
        postNumber: 2,
        replyToPostNumber: 1,
        author: {
          id: 2,
          username: "bob",
          name: "Bob",
          avatarUrl: ""
        },
        createdAt: "2026-05-01T00:00:00.000Z",
        html: "<p>Reply</p>",
        stats: {
          likes: 0,
          reads: 0,
          replies: 0
        },
        actions: {
          canReply: true,
          canLike: true,
          liked: false,
          canBookmark: false,
          bookmarked: false
        },
        url: "/t/topic-1/1/2",
        isOriginalPost: false,
        isOriginalPoster: false
      }
    ],
    tree: [
      {
        post: {
          id: 102,
          postNumber: 2,
          replyToPostNumber: 1,
          author: {
            id: 2,
            username: "bob",
            name: "Bob",
            avatarUrl: ""
          },
          createdAt: "2026-05-01T00:00:00.000Z",
          html: "<p>Reply</p>",
          stats: {
            likes: 0,
            reads: 0,
            replies: 0
          },
          actions: {
            canReply: true,
            canLike: true,
            liked: false,
            canBookmark: false,
            bookmarked: false
          },
          url: "/t/topic-1/1/2",
          isOriginalPost: false,
          isOriginalPoster: false
        },
        children: [],
        depth: 0
      }
    ],
    postStream: [101, 102],
    loadedPostIds: [101, 102],
    hasMorePosts: false
  };
}

function renderOptions(
  root: ShadowRoot,
  overrides: Partial<Parameters<typeof renderApp>[0]> = {}
): Parameters<typeof renderApp>[0] {
  const noop = (): void => {};
  return {
    root,
    data: null,
    settings: DEFAULT_SETTINGS,
    loading: false,
    loadingMore: false,
    error: "",
    updatedAt: "刚刚",
    pendingNewTopicCount: 0,
    pendingNewTopics: [],
    pendingNoticeExpanded: false,
    pendingNoticeMinimized: false,
    useNativePendingNotice: false,
    hasMore: false,
    reader: emptyReaderState(),
    viewedTopicIds: new Set(),
    justReadTopicIds: new Set(),
    onRefresh: noop,
    onApplyPendingRefresh: noop,
    onTogglePendingPreview: noop,
    onMinimizePendingNotice: noop,
    onLoadMore: noop,
    onOpenTopic: noop,
    onReaderAdjacent: noop,
    onRefreshReader: noop,
    onLoadMoreReaderPosts: noop,
    onRetryReader: noop,
    onCloseReader: noop,
    onReaderBackdropClick: noop,
    onOpenReaderImage: noop,
    onImageViewerAction: noop,
    onCloseReaderImage: noop,
    onOpenUserPreview: noop,
    onCloseUserPreview: noop,
    onOpenPrivateMessage: noop,
    onNativePostAction: noop,
    onPollVote: noop,
    onCommentSortChange: noop,
    onSettingsChange: noop,
    ...overrides
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("reader comment filters", () => {
  it("filters loaded comments by OP flag and search term without removing nodes", () => {
    const root = document.createElement("section");
    root.innerHTML = `
      <article class="ldcv-reader-comment" data-original-poster="true">Alice update</article>
      <div class="ldcv-reader-replies">
        <article class="ldcv-reader-comment" data-original-poster="false">Bob reply</article>
      </div>
      <article class="ldcv-reader-comment" data-original-poster="true">Alice follow up</article>
    `;

    expect(applyReaderCommentFilters(root, "alice", true)).toEqual({ visible: 2, total: 3 });

    const comments = Array.from(root.querySelectorAll<HTMLElement>(".ldcv-reader-comment"));
    expect(comments.map((comment) => comment.hidden)).toEqual([false, true, false]);
    expect(root.querySelector<HTMLElement>(".ldcv-reader-replies")?.hidden).toBe(true);
  });

  it("clears the comment search through the Reader-owned clear control", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1)]),
        reader: {
          ...emptyReaderState(),
          topicId: 1,
          data: readerData()
        }
      })
    );

    const search = root.querySelector<HTMLInputElement>("[data-reader-comment-search]");
    const clear = root.querySelector<HTMLButtonElement>("[data-reader-comment-search-clear]");
    expect(search).not.toBeNull();
    expect(clear?.hidden).toBe(true);

    search!.value = "reply";
    search!.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
    expect(clear?.hidden).toBe(false);

    clear?.click();
    expect(search?.value).toBe("");
    expect(clear?.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>(".ldcv-reader-comment")?.hidden).toBe(false);
  });

  it("keeps Reader comment search and OP filter controls interactive", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const leakedClick = vi.fn();
    host.addEventListener("click", leakedClick);

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1)]),
        reader: {
          ...emptyReaderState(),
          topicId: 1,
          data: readerData()
        }
      })
    );

    const search = root.querySelector<HTMLInputElement>("[data-reader-comment-search]");
    const onlyOp = root.querySelector<HTMLInputElement>("[data-reader-only-op]");
    expect(search).not.toBeNull();
    expect(onlyOp).not.toBeNull();

    search!.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(leakedClick).not.toHaveBeenCalled();

    search!.value = "reply";
    search!.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
    expect(root.querySelector<HTMLElement>("[data-reader-filter-count]")?.textContent).toBe("1/1");

    onlyOp!.click();
    expect(onlyOp?.checked).toBe(true);
    expect(leakedClick).not.toHaveBeenCalled();
    expect(root.querySelector<HTMLElement>("[data-reader-filter-count]")?.textContent).toBe("0/1");
  });

  it("toggles the OP filter when the label text is clicked without leaking the click", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const leakedClick = vi.fn();
    host.addEventListener("click", leakedClick);

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1)]),
        reader: {
          ...emptyReaderState(),
          topicId: 1,
          data: readerData()
        }
      })
    );

    const onlyOp = root.querySelector<HTMLInputElement>("[data-reader-only-op]");
    const labelText = root.querySelector<HTMLElement>(".ldcv-reader-op-filter span");
    expect(onlyOp?.checked).toBe(false);

    labelText?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }));
    expect(onlyOp?.checked).toBe(true);
    expect(root.querySelector<HTMLElement>("[data-reader-filter-count]")?.textContent).toBe("0/1");
    expect(leakedClick).not.toHaveBeenCalled();
  });

  it("toggles each Reader comment between collapsed and expanded states", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const leakedClick = vi.fn();
    host.addEventListener("click", leakedClick);

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1)]),
        reader: {
          ...emptyReaderState(),
          topicId: 1,
          data: readerData()
        }
      })
    );

    const comment = root.querySelector<HTMLElement>(".ldcv-reader-comment");
    const toggle = root.querySelector<HTMLButtonElement>(".ldcv-reader-comment__toggle");
    expect(comment?.classList.contains("is-collapsed")).toBe(true);
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");

    toggle?.click();
    expect(comment?.classList.contains("is-expanded")).toBe(true);
    expect(comment?.classList.contains("is-collapsed")).toBe(false);
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(leakedClick).not.toHaveBeenCalled();

    toggle?.click();
    expect(comment?.classList.contains("is-expanded")).toBe(false);
    expect(comment?.classList.contains("is-collapsed")).toBe(true);
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
  });

  it("animates Reader comment expansion when the browser supports Web Animations", () => {
    const motion = installAnimateMock();
    try {
      vi.stubGlobal("ResizeObserver", ResizeObserverStub);
      const host = document.createElement("div");
      const root = host.attachShadow({ mode: "open" });

      renderApp(
        renderOptions(root, {
          data: topicList([topic(1)]),
          reader: {
            ...emptyReaderState(),
            topicId: 1,
            data: readerData()
          }
        })
      );

      const comment = root.querySelector<HTMLElement>(".ldcv-reader-comment");
      const content = root.querySelector<HTMLElement>(".ldcv-reader-comment__content");
      const toggle = root.querySelector<HTMLButtonElement>(".ldcv-reader-comment__toggle");
      expect(comment).not.toBeNull();
      expect(content).not.toBeNull();
      if (content) {
        vi.spyOn(content, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 120));
        Object.defineProperty(content, "scrollHeight", { configurable: true, value: 320 });
      }

      toggle?.click();

      expect(motion.calls).toHaveLength(1);
      expect(comment?.classList.contains("is-expanded")).toBe(true);
      expect(comment?.classList.contains("is-animating")).toBe(true);
      expect(toggle?.getAttribute("aria-expanded")).toBe("true");

      finishAnimation(motion.animations[0]);

      expect(comment?.classList.contains("is-animating")).toBe(false);
      expect(content?.style.maxHeight).toBe("");
    } finally {
      motion.restore();
    }
  });

  it("releases expanded Reader comment height when media or nested blocks change size", () => {
    const motion = installAnimateMock();
    try {
      vi.stubGlobal("ResizeObserver", ResizeObserverStub);
      const host = document.createElement("div");
      const root = host.attachShadow({ mode: "open" });
      const data = readerData();
      const richReplyHtml = `
        <p>Reply with media</p>
        <details class="ldcv-reader-details">
          <summary class="ldcv-reader-details__summary">展开内容</summary>
          <div class="ldcv-reader-details__body"><video src="movie.mp4"></video></div>
        </details>
        <img class="ldcv-reader-image" src="image.jpg" alt="">
      `;
      data.posts[1] = { ...data.posts[1]!, html: richReplyHtml };
      data.tree[0] = { ...data.tree[0]!, post: { ...data.tree[0]!.post, html: richReplyHtml } };

      renderApp(
        renderOptions(root, {
          data: topicList([topic(1)]),
          reader: {
            ...emptyReaderState(),
            topicId: 1,
            data
          }
        })
      );

      const comment = root.querySelector<HTMLElement>(".ldcv-reader-comment");
      const content = root.querySelector<HTMLElement>(".ldcv-reader-comment__content");
      const toggle = root.querySelector<HTMLButtonElement>(".ldcv-reader-comment__toggle");
      const image = root.querySelector<HTMLImageElement>(".ldcv-reader-comment__content img");
      const summary = root.querySelector<HTMLElement>(".ldcv-reader-details__summary");
      expect(comment).not.toBeNull();
      expect(content).not.toBeNull();
      if (content) {
        vi.spyOn(content, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 120));
        Object.defineProperty(content, "scrollHeight", { configurable: true, value: 320 });
      }

      toggle?.click();
      expect(comment?.classList.contains("is-animating")).toBe(true);
      expect(content?.style.maxHeight).toBe("120px");

      image?.dispatchEvent(new Event("load"));
      expect(comment?.classList.contains("is-animating")).toBe(false);
      expect(content?.style.maxHeight).toBe("");

      if (content) {
        content.style.maxHeight = "120px";
      }
      summary?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      expect(content?.style.maxHeight).toBe("");
    } finally {
      motion.restore();
    }
  });
});

describe("reader native post actions", () => {
  it("keeps prose mouse events inside Reader so text selection is not cleared by the page", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const onCloseUserPreview = vi.fn();
    const leakedClick = vi.fn();
    host.addEventListener("click", leakedClick);

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1)]),
        reader: {
          ...emptyReaderState(),
          topicId: 1,
          data: readerData()
        },
        onCloseUserPreview
      })
    );

    const paragraph = root.querySelector<HTMLElement>(".ldcv-reader-main .ldcv-reader-prose p");
    paragraph?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }));

    expect(onCloseUserPreview).not.toHaveBeenCalled();
    expect(leakedClick).not.toHaveBeenCalled();
  });

  it("toggles sanitized details content without closing transient Reader UI", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const onCloseUserPreview = vi.fn();
    const leakedClick = vi.fn();
    const data = readerData();
    data.posts[0] = {
      ...data.posts[0],
      html: `<details class="ldcv-reader-details"><summary class="ldcv-reader-details__summary">总结</summary><div class="ldcv-reader-details__body">隐藏内容</div></details>`
    };
    host.addEventListener("click", leakedClick);

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1)]),
        reader: {
          ...emptyReaderState(),
          topicId: 1,
          data
        },
        onCloseUserPreview
      })
    );

    const details = root.querySelector<HTMLDetailsElement>(".ldcv-reader-details");
    const summary = root.querySelector<HTMLElement>(".ldcv-reader-details__summary");
    expect(details?.open).toBe(false);

    summary?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }));

    expect(details?.open).toBe(true);
    expect(onCloseUserPreview).not.toHaveBeenCalled();
    expect(leakedClick).not.toHaveBeenCalled();
  });

  it("dispatches poll vote requests from sanitized Reader poll controls", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const onPollVote = vi.fn();
    const onCloseUserPreview = vi.fn();
    const data = readerData();
    data.posts[0] = {
      ...data.posts[0],
      html: `
        <section class="ldcv-reader-poll" data-reader-poll-name="poll" data-reader-poll-post-id="123">
          <button
            type="button"
            class="ldcv-reader-poll__option-button"
            data-reader-poll-vote="true"
            data-reader-poll-post-id="123"
            data-reader-poll-name="poll"
            data-reader-poll-option-id="option-a"
          >功能测试</button>
        </section>`
    };

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1)]),
        reader: {
          ...emptyReaderState(),
          topicId: 1,
          data
        },
        onCloseUserPreview,
        onPollVote
      })
    );

    root.querySelector<HTMLButtonElement>("[data-reader-poll-vote]")?.click();

    expect(onPollVote).toHaveBeenCalledWith({ postId: 123, pollName: "poll", optionId: "option-a" });
    expect(onCloseUserPreview).not.toHaveBeenCalled();
  });

  it("renders poll vote feedback and returned result data inside the matching poll", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = readerData();
    data.posts[0] = {
      ...data.posts[0],
      html: `
        <section class="ldcv-reader-poll" data-reader-poll-name="poll" data-reader-poll-post-id="123">
          <div class="ldcv-reader-poll__head">
            <div class="ldcv-reader-poll__voters" data-reader-poll-voters-label="true">0 投票人</div>
          </div>
          <div class="ldcv-reader-poll__options">
            <div class="ldcv-reader-poll__option" data-reader-poll-option-id="option-a">
              <div class="ldcv-reader-poll__option-row">
                <button
                  type="button"
                  class="ldcv-reader-poll__option-button"
                  data-reader-poll-vote="true"
                  data-reader-poll-post-id="123"
                  data-reader-poll-name="poll"
                  data-reader-poll-option-id="option-a"
                >选项 A</button>
              </div>
            </div>
          </div>
        </section>`
    };

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1)]),
        reader: {
          ...emptyReaderState(),
          topicId: 1,
          data,
          pollVote: {
            postId: 123,
            pollName: "poll",
            optionIds: ["option-a"],
            status: "success",
            message: "投票成功，已同步到原贴。",
            poll: {
              name: "poll",
              voters: 3,
              options: [{ id: "option-a", label: "选项 A", votes: 3 }]
            }
          }
        }
      })
    );

    expect(root.querySelector(".ldcv-reader-poll__feedback")?.textContent).toBe("投票成功，已同步到原贴。");
    expect(root.querySelector("[data-reader-poll-voters-label]")?.textContent).toBe("3 投票人");
    expect(root.querySelector("[data-reader-poll-option-result]")?.textContent).toBe("3 票 · 100%");
    expect(root.querySelector<HTMLButtonElement>("[data-reader-poll-vote]")?.classList.contains("is-selected")).toBe(true);
  });

  it("dispatches the selected post action and post number", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const onNativePostAction = vi.fn();

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1)]),
        reader: {
          ...emptyReaderState(),
          topicId: 1,
          data: readerData()
        },
        onNativePostAction
      })
    );

    root.querySelector<HTMLButtonElement>(".ldcv-reader-main-actions [data-reader-post-action='reply']")?.click();
    root.querySelector<HTMLButtonElement>(".ldcv-reader-main-actions [data-reader-post-action='bookmark']")?.click();
    root.querySelector<HTMLButtonElement>(".ldcv-reader-comment [data-reader-post-action='reply']")?.click();

    expect(onNativePostAction).toHaveBeenNthCalledWith(1, "reply", 1);
    expect(onNativePostAction).toHaveBeenNthCalledWith(2, "bookmark", 1);
    expect(onNativePostAction).toHaveBeenNthCalledWith(3, "reply", 2);
  });

  it("renders a Linux wait it placeholder while the native reply composer opens", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1)]),
        reader: {
          ...emptyReaderState(),
          topicId: 1,
          data: readerData(),
          nativePostAction: {
            requestId: "reply-1",
            action: "reply",
            postNumber: 1,
            status: "pending",
            message: "回复处理中..."
          }
        }
      })
    );

    expect(root.querySelector(".ldcv-native-reply-loader")?.textContent).toContain("Linux wait it");
  });

  it("renders a Linux wait it placeholder while the native private-message composer opens", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1)]),
        reader: {
          ...emptyReaderState(),
          topicId: 1,
          data: readerData(),
          nativePostAction: {
            requestId: "pm-1",
            action: "private-message",
            postNumber: 1,
            status: "pending",
            message: "私信窗口打开中..."
          }
        }
      })
    );

    expect(root.querySelector(".ldcv-native-reply-loader")?.textContent).toContain("Linux wait it");
    expect(root.querySelector(".ldcv-native-reply-loader")?.textContent).toContain("正在打开私信窗口");
  });

  it("does not render a second reply placeholder while replacing an existing native composer", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1)]),
        reader: {
          ...emptyReaderState(),
          topicId: 1,
          data: readerData(),
          nativePostAction: {
            requestId: "reply-2",
            action: "reply",
            postNumber: 1,
            status: "pending",
            message: "回复处理中...",
            replaceExisting: true
          }
        }
      })
    );

    expect(root.querySelector(".ldcv-native-reply-loader")).toBeNull();
  });
});

describe("renderApp toolbar", () => {
  it("renders the compact reading menu with icon-only view controls", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const noop = (): void => {};

    renderApp({
      root,
      data: null,
      settings: DEFAULT_SETTINGS,
      loading: false,
      loadingMore: false,
      error: "",
      updatedAt: "刚刚",
      pendingNewTopicCount: 0,
      pendingNewTopics: [],
      pendingNoticeExpanded: false,
      pendingNoticeMinimized: false,
      useNativePendingNotice: false,
      hasMore: false,
      reader: emptyReaderState(),
      viewedTopicIds: new Set(),
      justReadTopicIds: new Set(),
      onRefresh: noop,
      onApplyPendingRefresh: noop,
      onTogglePendingPreview: noop,
      onMinimizePendingNotice: noop,
      onLoadMore: noop,
      onOpenTopic: noop,
      onReaderAdjacent: noop,
      onRefreshReader: noop,
      onLoadMoreReaderPosts: noop,
      onRetryReader: noop,
      onCloseReader: noop,
      onReaderBackdropClick: noop,
      onOpenReaderImage: noop,
      onImageViewerAction: noop,
      onCloseReaderImage: noop,
      onOpenUserPreview: noop,
      onCloseUserPreview: noop,
      onOpenPrivateMessage: noop,
      onNativePostAction: noop,
      onPollVote: noop,
      onCommentSortChange: noop,
      onSettingsChange: noop
    });

    expect(root.querySelector(".ldcv-reader-trigger")?.textContent).toContain("阅读");
    expect(root.querySelector(".ldcv-reader-trigger")?.textContent).toContain("卡片");
    expect(root.querySelector("[data-density='compact']")).toBeNull();
    expect(root.querySelector<HTMLElement>("[data-toolbar-actions-host]")?.dataset.toolbarActionsVariant).toBe("toolbar");
    expect(root.querySelector(".ldcv-toolbar__actions")?.getAttribute("data-react-toolbar-actions")).toBe("true");
    expect(root.querySelector("[data-layout='grid']")?.getAttribute("aria-label")).toBe("卡片视图");
    expect(root.querySelector("[data-layout='masonry']")?.getAttribute("title")).toBe("瀑布视图");
    expect(root.querySelector("[data-layout='reader']")?.getAttribute("aria-label")).toBe("列表阅读视图");
    expect(root.querySelector("[data-action='toggle-original']")?.getAttribute("title")).toBe("原始列表");
    const settingsPanel = root.querySelector<HTMLElement>(".ldcv-toolbar-popover [data-settings-panel]");
    const settingsButton = root.querySelector<HTMLButtonElement>(".ldcv-toolbar-popover [data-action='toggle-settings']");
    expect(settingsPanel).not.toBeNull();
    expect(Array.from(root.children).some((child) => child instanceof HTMLElement && child.matches("[data-settings-panel]"))).toBe(false);
    if (settingsPanel && settingsButton) {
      if (!settingsPanel.hasAttribute("hidden")) {
        settingsButton.click();
      }
      expect(settingsPanel.hasAttribute("hidden")).toBe(true);
      settingsButton.click();
      expect(settingsPanel.hasAttribute("hidden")).toBe(false);
      settingsButton.click();
      expect(settingsPanel.hasAttribute("hidden")).toBe(true);
    }
  });

  it("keeps the settings panel mounted until the close animation finishes", () => {
    const motion = installAnimateMock();
    try {
      vi.stubGlobal("ResizeObserver", ResizeObserverStub);
      const host = document.createElement("div");
      const root = host.attachShadow({ mode: "open" });
      renderApp(renderOptions(root, { data: topicList([topic(1)]) }));

      const settingsPanel = root.querySelector<HTMLElement>(".ldcv-toolbar-popover [data-settings-panel]");
      const settingsButton = root.querySelector<HTMLButtonElement>(".ldcv-toolbar-popover [data-action='toggle-settings']");
      expect(settingsPanel?.hasAttribute("hidden")).toBe(true);

      settingsButton?.click();
      expect(settingsPanel?.hasAttribute("hidden")).toBe(false);
      expect(settingsPanel?.dataset.motionState).toBe("open");
      expect(settingsPanel?.getAttribute("aria-hidden")).toBe("false");

      settingsButton?.click();
      expect(settingsPanel?.hasAttribute("hidden")).toBe(false);
      expect(settingsPanel?.dataset.motionState).toBe("closing");
      expect(settingsPanel?.getAttribute("aria-hidden")).toBe("true");

      finishAnimation(motion.animations.at(-1));

      expect(settingsPanel?.hasAttribute("hidden")).toBe(true);
      expect(settingsPanel?.dataset.motionState).toBe("closed");
    } finally {
      motion.restore();
    }
  });

  it("keeps settings changes bound through the React settings island", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const onSettingsChange = vi.fn();

    renderApp(renderOptions(root, { data: topicList([topic(1)]), onSettingsChange }));

    root.querySelector<HTMLButtonElement>(".ldcv-toolbar-popover [data-action='toggle-settings']")?.click();
    const enabledToggle = root.querySelector<HTMLInputElement>("[data-setting-toggle='enabled']");
    expect(root.querySelector("[data-settings-panel-host]")).not.toBeNull();
    expect(enabledToggle).not.toBeNull();

    if (enabledToggle) {
      enabledToggle.checked = false;
      enabledToggle.dispatchEvent(new Event("change", { bubbles: true }));
    }

    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    closeTransientPanels(root);
  });

  it("keeps toolbar action clicks bound through the React toolbar island", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const onRefresh = vi.fn();
    const onSettingsChange = vi.fn();

    renderApp(renderOptions(root, { data: topicList([topic(1)]), onRefresh, onSettingsChange }));

    expect(root.querySelector(".ldcv-toolbar__actions[data-react-toolbar-actions='true']")).not.toBeNull();
    root.querySelector<HTMLButtonElement>(".ldcv-toolbar-popover [data-action='refresh']")?.click();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    const settingsButton = root.querySelector<HTMLButtonElement>(".ldcv-toolbar-popover [data-action='toggle-settings']");
    const settingsPanel = root.querySelector<HTMLElement>(".ldcv-toolbar-popover [data-settings-panel]");
    expect(settingsButton?.getAttribute("aria-expanded")).toBe("false");
    settingsButton?.click();
    expect(settingsButton?.getAttribute("aria-expanded")).toBe("true");
    expect(settingsPanel?.hasAttribute("hidden")).toBe(false);

    root.querySelector<HTMLButtonElement>(".ldcv-toolbar-popover [data-layout='masonry']")?.click();
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, layout: "masonry" }));

    root.querySelector<HTMLButtonElement>(".ldcv-toolbar-popover [data-action='toggle-original']")?.click();
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));

    closeTransientPanels(root);
  });

  it("surfaces pending topic actions inside the reading menu", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const noop = (): void => {};

    renderApp({
      root,
      data: null,
      settings: DEFAULT_SETTINGS,
      loading: false,
      loadingMore: false,
      error: "",
      updatedAt: "刚刚",
      pendingNewTopicCount: 3,
      pendingNewTopics: [],
      pendingNoticeExpanded: true,
      pendingNoticeMinimized: false,
      useNativePendingNotice: true,
      hasMore: false,
      reader: emptyReaderState(),
      viewedTopicIds: new Set(),
      justReadTopicIds: new Set(),
      onRefresh: noop,
      onApplyPendingRefresh: noop,
      onTogglePendingPreview: noop,
      onMinimizePendingNotice: noop,
      onLoadMore: noop,
      onOpenTopic: noop,
      onReaderAdjacent: noop,
      onRefreshReader: noop,
      onLoadMoreReaderPosts: noop,
      onRetryReader: noop,
      onCloseReader: noop,
      onReaderBackdropClick: noop,
      onOpenReaderImage: noop,
      onImageViewerAction: noop,
      onCloseReaderImage: noop,
      onOpenUserPreview: noop,
      onCloseUserPreview: noop,
      onOpenPrivateMessage: noop,
      onNativePostAction: noop,
      onPollVote: noop,
      onCommentSortChange: noop,
      onSettingsChange: noop
    });

    expect(root.querySelector(".ldcv-toolbar-pending")?.textContent).toContain("发现 3 个新话题");
    expect(root.querySelector(".ldcv-toolbar-pending [data-action='toggle-pending-preview']")?.textContent).toBe("收起");
    expect(root.querySelector(".ldcv-toolbar-pending [data-action='apply-pending-refresh']")?.textContent).toBe("更新");
    expect(root.querySelector(".ldcv-toolbar-pending")?.getAttribute("data-react-toolbar-pending-notice")).toBe("true");
    expect(root.querySelector(".ldcv-update-float")).toBeNull();
  });

  it("renders no toolbar pending summary when there are no pending topics", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const noop = (): void => {};

    renderApp({
      root,
      data: null,
      settings: DEFAULT_SETTINGS,
      loading: false,
      loadingMore: false,
      error: "",
      updatedAt: "刚刚",
      pendingNewTopicCount: 0,
      pendingNewTopics: [],
      pendingNoticeExpanded: false,
      pendingNoticeMinimized: false,
      useNativePendingNotice: true,
      hasMore: false,
      reader: emptyReaderState(),
      viewedTopicIds: new Set(),
      justReadTopicIds: new Set(),
      onRefresh: noop,
      onApplyPendingRefresh: noop,
      onTogglePendingPreview: noop,
      onMinimizePendingNotice: noop,
      onLoadMore: noop,
      onOpenTopic: noop,
      onReaderAdjacent: noop,
      onRefreshReader: noop,
      onLoadMoreReaderPosts: noop,
      onRetryReader: noop,
      onCloseReader: noop,
      onReaderBackdropClick: noop,
      onOpenReaderImage: noop,
      onImageViewerAction: noop,
      onCloseReaderImage: noop,
      onOpenUserPreview: noop,
      onCloseUserPreview: noop,
      onOpenPrivateMessage: noop,
      onNativePostAction: noop,
      onPollVote: noop,
      onCommentSortChange: noop,
      onSettingsChange: noop
    });

    expect(root.querySelector(".ldcv-toolbar-pending")).toBeNull();
  });

  it("keeps the fallback pending bubble mobile-only when native controls are unavailable", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const noop = (): void => {};
    const render = (allowFloatingPendingNotice: boolean): void =>
      renderApp({
        root,
        data: null,
        settings: DEFAULT_SETTINGS,
        loading: false,
        loadingMore: false,
        error: "",
        updatedAt: "刚刚",
        pendingNewTopicCount: 2,
        pendingNewTopics: [],
        pendingNoticeExpanded: true,
        pendingNoticeMinimized: false,
        useNativePendingNotice: false,
        allowFloatingPendingNotice,
        hasMore: false,
        reader: emptyReaderState(),
        viewedTopicIds: new Set(),
        justReadTopicIds: new Set(),
        onRefresh: noop,
        onApplyPendingRefresh: noop,
        onTogglePendingPreview: noop,
        onMinimizePendingNotice: noop,
        onLoadMore: noop,
        onOpenTopic: noop,
        onReaderAdjacent: noop,
        onRefreshReader: noop,
        onLoadMoreReaderPosts: noop,
        onRetryReader: noop,
        onCloseReader: noop,
        onReaderBackdropClick: noop,
        onOpenReaderImage: noop,
        onImageViewerAction: noop,
        onCloseReaderImage: noop,
        onOpenUserPreview: noop,
        onCloseUserPreview: noop,
        onOpenPrivateMessage: noop,
        onNativePostAction: noop,
        onPollVote: noop,
        onCommentSortChange: noop,
        onSettingsChange: noop
      });

    render(false);
    expect(root.querySelector(".ldcv-update-float")).toBeNull();

    render(true);
    expect(root.querySelector<HTMLElement>(".ldcv-update-float")?.dataset.reactFloatingPendingNotice).toBe("true");
    expect(root.querySelector(".ldcv-update-float")?.textContent).toContain("新帖");
    expect(root.querySelector(".ldcv-update-float")?.textContent).toContain("收起");
  });

  it("keeps fallback pending notice actions bound through the React island", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const onTogglePendingPreview = vi.fn();
    const onApplyPendingRefresh = vi.fn();
    const onMinimizePendingNotice = vi.fn();
    const onOpenTopic = vi.fn();
    const pendingTopic = topic(3, {
      title: "Pending <topic>",
      category: {
        id: 10,
        name: "Announcements",
        parentName: "Linux.do",
        color: "0088cc",
        textColor: "ffffff"
      }
    });

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1), topic(2)]),
        pendingNewTopicCount: 1,
        pendingNewTopics: [pendingTopic],
        pendingNoticeExpanded: true,
        allowFloatingPendingNotice: true,
        onTogglePendingPreview,
        onApplyPendingRefresh,
        onMinimizePendingNotice,
        onOpenTopic
      })
    );

    expect(root.querySelector<HTMLElement>(".ldcv-update-float")?.dataset.reactFloatingPendingNotice).toBe("true");
    expect(root.querySelector(".ldcv-update-float")?.classList.contains("is-expanded")).toBe(true);
    expect(root.querySelector(".ldcv-update-float [data-pending-topic-id='3']")?.textContent).toContain("Pending <topic>");
    expect(root.querySelector(".ldcv-update-float [data-pending-topic-id='3']")?.textContent).toContain("Linux.do / Announcements");

    root.querySelector<HTMLButtonElement>(".ldcv-update-float [data-action='toggle-pending-preview']")?.click();
    root.querySelector<HTMLButtonElement>(".ldcv-update-float [data-action='apply-pending-refresh']")?.click();
    root.querySelector<HTMLButtonElement>(".ldcv-update-float [data-action='minimize-pending-notice']")?.click();
    root.querySelector<HTMLButtonElement>(".ldcv-update-float [data-pending-topic-id='3']")?.click();

    expect(onTogglePendingPreview).toHaveBeenCalledTimes(1);
    expect(onApplyPendingRefresh).toHaveBeenCalledTimes(1);
    expect(onMinimizePendingNotice).toHaveBeenCalledTimes(1);
    expect(onOpenTopic).toHaveBeenCalledWith(3);
  });

  it("renders the minimized fallback pending notice through the React island", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1), topic(2)]),
        pendingNewTopicCount: 2,
        pendingNewTopics: [topic(3), topic(4)],
        pendingNoticeMinimized: true,
        allowFloatingPendingNotice: true
      })
    );

    const notice = root.querySelector<HTMLButtonElement>(".ldcv-update-float.is-minimized");
    expect(notice?.dataset.reactFloatingPendingNotice).toBe("true");
    expect(notice?.getAttribute("aria-label")).toBe("展开新话题提示");
    expect(notice?.textContent).toBe("新帖 2");
    expect(root.querySelector(".ldcv-update-float__list")).toBeNull();
  });

  it("marks pending topics and newly applied cards as new", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = topicList([topic(1), topic(2)]);

    renderApp(
      renderOptions(root, {
        data,
        pendingNewTopicCount: 1,
        pendingNewTopics: [topic(3)],
        pendingNoticeExpanded: true,
        allowFloatingPendingNotice: true,
        newTopicIds: new Set([2])
      })
    );

    expect(root.querySelector(".ldcv-update-float [data-pending-topic-id='3'] .ldcv-new-marker")?.textContent).toBe("new");
    expect(root.querySelector(".ldcv-card[data-topic-id='2']")?.classList.contains("is-new")).toBe(true);
    expect(root.querySelector(".ldcv-card[data-topic-id='2'] .ldcv-state.is-new")?.textContent).toBe("new");
  });

  it("marks only the entering batch for staggered card reveal", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1), topic(2), topic(3)]),
        enteringTopicIds: new Set([2, 3])
      })
    );

    expect(root.querySelector(".ldcv-card[data-topic-id='1']")?.classList.contains("is-entering")).toBe(false);
    expect(
      root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='2']")?.style.getPropertyValue("--ldcv-enter-delay")
    ).toBe("0ms");
    expect(
      root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='3']")?.style.getPropertyValue("--ldcv-enter-delay")
    ).toBe("56ms");
  });

  it("keeps reader-layout new markers without replaying card entering animation", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1), topic(2), topic(3)]),
        settings: { ...DEFAULT_SETTINGS, layout: "reader" },
        newTopicIds: new Set([2, 3]),
        enteringTopicIds: new Set()
      })
    );

    expect(root.querySelector(".ldcv-card[data-topic-id='2']")?.classList.contains("is-new")).toBe(true);
    expect(root.querySelector(".ldcv-card[data-topic-id='3']")?.classList.contains("is-new")).toBe(true);
    expect(root.querySelector(".ldcv-card[data-topic-id='2']")?.classList.contains("is-entering")).toBe(false);
    expect(root.querySelector(".ldcv-card[data-topic-id='3']")?.classList.contains("is-entering")).toBe(false);
  });

  it("re-renders card markers when newTopicIds is cleared after opening a new topic", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = topicList([topic(1), topic(2)]);

    renderApp(
      renderOptions(root, {
        data,
        newTopicIds: new Set([2]),
      })
    );
    expect(root.querySelector(".ldcv-card[data-topic-id='2']")?.classList.contains("is-new")).toBe(true);

    renderApp(
      renderOptions(root, {
        data,
        newTopicIds: new Set(),
      })
    );

    expect(root.querySelector(".ldcv-card[data-topic-id='2']")?.classList.contains("is-new")).toBe(false);
    expect(root.querySelector(".ldcv-card[data-topic-id='2'] .ldcv-state.is-new")).toBeNull();
  });

  it("re-renders card entering state when enteringTopicIds is acknowledged", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = topicList([topic(1), topic(2)]);

    renderApp(
      renderOptions(root, {
        data,
        enteringTopicIds: new Set([2]),
      })
    );
    expect(root.querySelector(".ldcv-card[data-topic-id='2']")?.classList.contains("is-entering")).toBe(true);

    renderApp(
      renderOptions(root, {
        data,
        enteringTopicIds: new Set(),
      })
    );

    expect(root.querySelector(".ldcv-card[data-topic-id='2']")?.classList.contains("is-entering")).toBe(false);
  });

  it("clears stale is-entering classes on patch-only re-render after entering is acknowledged", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = topicList([topic(1), topic(2)]);
    const pendingTopic = topic(3, { title: "Fresh topic" });

    renderApp(renderOptions(root, { data, pendingNewTopicCount: 0 }));
    const grid = root.querySelector(".ldcv-grid");
    const card = root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='2']");
    expect(grid).not.toBeNull();
    expect(card).not.toBeNull();
    if (!card) {
      return;
    }
    card.classList.add("is-entering");
    card.style.setProperty("--ldcv-enter-delay", "0ms");

    renderApp(
      renderOptions(root, {
        data,
        pendingNewTopicCount: 1,
        pendingNewTopics: [pendingTopic],
        pendingNoticeExpanded: true,
      })
    );

    expect(root.querySelector(".ldcv-grid")).toBe(grid);
    expect(card.classList.contains("is-entering")).toBe(false);
    expect(card.style.getPropertyValue("--ldcv-enter-delay")).toBe("");
  });

  it("removes is-entering after the card enter animation finishes", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = topicList([topic(1), topic(2)]);

    renderApp(
      renderOptions(root, {
        data,
        enteringTopicIds: new Set([2]),
      })
    );
    const card = root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='2']");
    expect(card?.classList.contains("is-entering")).toBe(true);
    if (!card) {
      return;
    }

    const event = new Event("animationend", { bubbles: true }) as AnimationEvent;
    Object.defineProperty(event, "animationName", { value: "ldcv-card-enter" });
    card.dispatchEvent(event);

    expect(card.classList.contains("is-entering")).toBe(false);
    expect(card.style.getPropertyValue("--ldcv-enter-delay")).toBe("");
  });

  it("patches pending notice without rebuilding the topic grid when only pending state changes", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = topicList([topic(1), topic(2)]);

    renderApp(renderOptions(root, { data, pendingNewTopicCount: 0 }));
    const grid = root.querySelector(".ldcv-grid");
    expect(grid).not.toBeNull();
    expect(root.querySelector(".ldcv-toolbar-pending")).toBeNull();

    renderApp(
      renderOptions(root, {
        data,
        pendingNewTopicCount: 2,
        pendingNewTopics: [topic(3), topic(4)],
        pendingNoticeExpanded: true,
      })
    );

    expect(root.querySelector(".ldcv-grid")).toBe(grid);
    expect(root.querySelector(".ldcv-toolbar-pending")?.textContent).toContain("发现 2 个新话题");
  });

  it("renders only the progressive visible batch while keeping the full topic count", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const topics = Array.from({ length: 12 }, (_, index) => topic(index + 1));

    renderApp(renderOptions(root, { data: topicList(topics), visibleTopicCount: 8 }));

    expect(root.querySelectorAll(".ldcv-card")).toHaveLength(8);
    expect(root.querySelector(".ldcv-toolbar-popover__head")?.textContent).toContain("12 个话题");
    expect(root.querySelector<HTMLElement>("[data-load-more-root]")?.dataset.reactTopicLoadMore).toBe("true");
    expect(root.querySelector<HTMLElement>("[data-load-more-root]")?.dataset.topicLoadMoreState).toBe("arranging");
    expect(root.querySelector("[data-load-more-root]")?.textContent).toContain("正在整理更多话题");
    expect(root.querySelector("[data-load-more-root]")?.classList.contains("is-arranging")).toBe(true);
    expect(root.querySelector(".ldcv-load-more__status i")).not.toBeNull();
  });

  it("shows an animated loading state while appending more topics", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });

    renderApp(renderOptions(root, { data: topicList([topic(1)]), hasMore: true, loadingMore: true }));

    expect(root.querySelector<HTMLElement>("[data-load-more-root]")?.dataset.reactTopicLoadMore).toBe("true");
    expect(root.querySelector<HTMLElement>("[data-load-more-root]")?.dataset.topicLoadMoreState).toBe("loading");
    expect(root.querySelector("[data-load-more-root]")?.classList.contains("is-loading")).toBe(true);
    expect(root.querySelector<HTMLButtonElement>("[data-action='load-more']")?.disabled).toBe(true);
    expect(root.querySelector("[data-action='load-more']")?.textContent).toBe("正在加载更多");
    expect(root.querySelector("[data-action='load-more'] i")).not.toBeNull();
  });

  it("keeps topic load-more clicks bound through the React island", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const onLoadMore = vi.fn();

    renderApp(renderOptions(root, { data: topicList([topic(1)]), hasMore: true, onLoadMore }));

    expect(root.querySelector<HTMLElement>("[data-load-more-root]")?.dataset.reactTopicLoadMore).toBe("true");
    expect(root.querySelector<HTMLElement>("[data-load-more-root]")?.dataset.topicLoadMoreState).toBe("idle");
    expect(root.querySelector("[data-load-more-root]")?.classList.contains("is-idle")).toBe(true);
    expect(root.querySelector<HTMLButtonElement>("[data-action='load-more']")?.disabled).toBe(false);

    root.querySelector<HTMLButtonElement>("[data-action='load-more']")?.click();

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("renders the topic load-more complete state through the React island", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });

    renderApp(renderOptions(root, { data: topicList([topic(1)]), hasMore: false }));

    expect(root.querySelector<HTMLElement>("[data-load-more-root]")?.dataset.reactTopicLoadMore).toBe("true");
    expect(root.querySelector<HTMLElement>("[data-load-more-root]")?.dataset.topicLoadMoreState).toBe("complete");
    expect(root.querySelector("[data-load-more-root]")?.classList.contains("is-complete")).toBe(true);
    expect(root.querySelector("[data-load-more-root]")?.textContent).toBe("已经到底了");
    expect(root.querySelector("[data-action='load-more']")).toBeNull();
  });

  it("switches the load-more control in place without replacing the masonry grid", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });

    renderApp(renderOptions(root, {
      data: topicList([topic(1), topic(2)]),
      settings: { ...DEFAULT_SETTINGS, layout: "masonry" },
      hasMore: true
    }));
    const grid = root.querySelector(".ldcv-grid");
    const loadMore = root.querySelector("[data-load-more-root]");

    setLoadMoreLoadingState(root, true);

    expect(root.querySelector(".ldcv-grid")).toBe(grid);
    expect(root.querySelector("[data-load-more-root]")).toBe(loadMore);
    expect(root.querySelector<HTMLElement>("[data-load-more-root]")?.dataset.reactTopicLoadMore).toBe("true");
    expect(root.querySelector<HTMLElement>("[data-load-more-root]")?.dataset.topicLoadMoreState).toBe("loading");
    expect(root.querySelector("[data-load-more-root]")?.classList.contains("is-loading")).toBe(true);
    expect(root.querySelector<HTMLButtonElement>("[data-action='load-more']")?.disabled).toBe(true);
    expect(root.querySelector("[data-action='load-more'] i")).not.toBeNull();

    setLoadMoreLoadingState(root, false);

    expect(root.querySelector(".ldcv-grid")).toBe(grid);
    expect(root.querySelector("[data-load-more-root]")?.classList.contains("is-idle")).toBe(true);
    expect(root.querySelector<HTMLElement>("[data-load-more-root]")?.dataset.topicLoadMoreState).toBe("idle");
    expect(root.querySelector<HTMLButtonElement>("[data-action='load-more']")?.disabled).toBe(false);
    expect(root.querySelector("[data-action='load-more']")?.textContent).toBe("加载更多");
  });

  it("applies masonry placement before returning from render", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const getComputedStyle = vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (element instanceof HTMLElement && element.dataset.cardGrid === "masonry") {
        return {
          getPropertyValue: (property: string) => {
            if (property === "grid-auto-rows") {
              return "4px";
            }
            if (property === "row-gap") {
              return "16px";
            }
            return "";
          }
        } as CSSStyleDeclaration;
      }
      return {} as CSSStyleDeclaration;
    });

    renderApp(renderOptions(root, { data: topicList([topic(1)]), settings: { ...DEFAULT_SETTINGS, layout: "masonry" } }));

    expect(root.querySelector<HTMLElement>(".ldcv-card")?.style.getPropertyValue("grid-row-end")).toBe("span 1");
    expect(frames).toHaveLength(1);
    frames[0](0);
    expect(root.querySelector<HTMLElement>(".ldcv-card")?.style.getPropertyValue("grid-row-end")).toBe("span 1");
    getComputedStyle.mockRestore();
  });

  it("preserves existing masonry card placement when appending an entering batch", () => {
    vi.useFakeTimers();
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (element instanceof HTMLElement && element.dataset.cardGrid === "masonry") {
        return {
          getPropertyValue: (property: string) => {
            if (property === "grid-auto-rows") {
              return "4px";
            }
            if (property === "row-gap") {
              return "16px";
            }
            return "";
          }
        } as CSSStyleDeclaration;
      }
      return {} as CSSStyleDeclaration;
    });
    const settings = { ...DEFAULT_SETTINGS, layout: "masonry" as const };
    renderApp(renderOptions(root, { data: topicList([topic(1), topic(2)]), settings }));
    const first = root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='1']");
    const second = root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='2']");
    first?.style.setProperty("grid-row-end", "span 6");
    second?.style.setProperty("grid-row-end", "span 7");

    renderApp(
      renderOptions(root, {
        data: topicList([topic(1), topic(2), topic(3)]),
        settings,
        enteringTopicIds: new Set([3])
      })
    );

    const appendedFirst = root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='1']");
    const appendedSecond = root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='2']");
    const entering = root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='3']");
    expect(
      appendedFirst?.style.getPropertyValue("grid-row-end")
    ).toBe("span 6");
    expect(
      appendedSecond?.style.getPropertyValue("grid-row-end")
    ).toBe("span 7");
    if (appendedFirst) {
      mockRect(appendedFirst, { height: 80 });
    }
    if (appendedSecond) {
      mockRect(appendedSecond, { height: 120 });
    }
    if (entering) {
      mockRect(entering, { height: 100 });
    }

    vi.advanceTimersByTime(600);

    expect(appendedFirst?.style.getPropertyValue("grid-row-end")).toBe("span 6");
    expect(appendedSecond?.style.getPropertyValue("grid-row-end")).toBe("span 7");
    expect(entering?.style.getPropertyValue("grid-row-end")).toBe("span 6");
  });

  it("closes transient reader and settings panels and recognizes panel event paths", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });

    renderApp(renderOptions(root, { data: topicList([topic(1)]) }));
    const details = root.querySelector<HTMLDetailsElement>(".ldcv-toolbar-menu");
    const settingsButton = root.querySelector<HTMLButtonElement>("[data-action='toggle-settings']");
    details?.setAttribute("open", "");
    settingsButton?.click();

    expect(root.querySelector("[data-settings-panel]")?.hasAttribute("hidden")).toBe(false);
    expect(eventPathContainsTransientPanel([root.querySelector(".ldcv-toolbar-popover")!])).toBe(true);
    expect(closeTransientPanels(root)).toBe(true);
    expect(details?.open).toBe(false);
    expect(root.querySelector("[data-settings-panel]")?.hasAttribute("hidden")).toBe(true);
  });

  it("preserves card and masonry background DOM while the modal reader is open, then refreshes read state on close", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = topicList([topic(1), topic(2)]);
    const settings = { ...DEFAULT_SETTINGS, layout: "masonry" as const };

    renderApp(renderOptions(root, { data, settings, hasMore: true, useNativePendingNotice: true }));
    const originalShell = root.querySelector<HTMLElement>(".ldcv-shell");
    const originalGrid = root.querySelector<HTMLElement>(".ldcv-grid");
    const originalLoadMore = root.querySelector<HTMLElement>("[data-load-more-root]");
    originalGrid?.setAttribute("data-stability-marker", "before-open");
    expect(originalShell).not.toBeNull();
    expect(root.querySelector(".ldcv-shell.has-native-controls")).not.toBeNull();

    renderApp(
      renderOptions(root, {
        data,
        settings,
        hasMore: true,
        useNativePendingNotice: true,
        reader: { ...emptyReaderState(), topicId: 1, loading: true },
        viewedTopicIds: new Set([1]),
        justReadTopicIds: new Set([1])
      })
    );

    expect(root.querySelector(".ldcv-shell")).toBe(originalShell);
    expect(root.querySelector(".ldcv-grid")).toBe(originalGrid);
    expect(root.querySelector("[data-load-more-root]")).toBe(originalLoadMore);
    expect(root.querySelector(".ldcv-grid")?.getAttribute("data-stability-marker")).toBe("before-open");
    expect(root.querySelector(".ldcv-card.is-selected")).not.toBeNull();
    expect(root.querySelector(".ldcv-card.is-viewed")).not.toBeNull();
    expect(root.querySelector(".ldcv-shell.has-native-controls")).not.toBeNull();
    expect(root.querySelector("[data-reader-backdrop]")).not.toBeNull();

    renderApp(
      renderOptions(root, {
        data,
        settings,
        hasMore: true,
        useNativePendingNotice: true,
        reader: { ...emptyReaderState(), topicId: 1, data: readerData() },
        viewedTopicIds: new Set([1]),
        justReadTopicIds: new Set([1])
      })
    );

    expect(root.querySelector(".ldcv-shell")).toBe(originalShell);
    expect(root.querySelector(".ldcv-grid")).toBe(originalGrid);
    expect(root.querySelector("[data-load-more-root]")).toBe(originalLoadMore);
    expect(root.querySelector(".ldcv-grid")?.getAttribute("data-stability-marker")).toBe("before-open");

    renderApp(
      renderOptions(root, {
        data,
        settings,
        hasMore: true,
        useNativePendingNotice: true,
        reader: emptyReaderState(),
        viewedTopicIds: new Set([1]),
        justReadTopicIds: new Set([1])
      })
    );

    expect(root.querySelector(".ldcv-shell")).toBe(originalShell);
    expect(root.querySelector(".ldcv-grid")).toBe(originalGrid);
    expect(root.querySelector("[data-load-more-root]")).toBe(originalLoadMore);
    expect(root.querySelector(".ldcv-grid")?.getAttribute("data-stability-marker")).toBe("before-open");
    expect(root.querySelector("[data-reader-backdrop]")).toBeNull();
    expect(root.querySelector(".ldcv-card.is-viewed")).not.toBeNull();
    expect(root.querySelector(".ldcv-card.is-just-read")).not.toBeNull();
    expect(root.querySelector(".ldcv-card .ldcv-state.is-viewed")?.textContent).toContain("已读");
    expect(root.querySelector(".ldcv-shell.has-native-controls")).not.toBeNull();
  });

  it("freezes the modal reader background while appended topics are pending behind it", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const settings = { ...DEFAULT_SETTINGS, layout: "grid" as const };
    const initialData = topicList([topic(1), topic(2)]);
    const nextData = topicList([topic(1), topic(2), topic(3)]);
    const reader = { ...emptyReaderState(), topicId: 1, data: readerData() };

    renderApp(renderOptions(root, { data: initialData, settings, reader, hasMore: true }));
    const originalShell = root.querySelector<HTMLElement>(".ldcv-shell");
    const originalGrid = root.querySelector<HTMLElement>(".ldcv-grid");
    const originalLoadMore = root.querySelector<HTMLElement>("[data-load-more-root]");
    const originalModal = root.querySelector<HTMLElement>(".ldcv-reader-modal");
    originalGrid?.setAttribute("data-stability-marker", "reader-open");

    renderApp(
      renderOptions(root, {
        data: nextData,
        settings,
        hasMore: true,
        loadingMore: true,
        visibleTopicCount: 3,
        enteringTopicIds: new Set([3]),
        reader,
        viewedTopicIds: new Set([1]),
        justReadTopicIds: new Set([1])
      })
    );

    expect(root.querySelector(".ldcv-shell")).toBe(originalShell);
    expect(root.querySelector(".ldcv-grid")).toBe(originalGrid);
    expect(root.querySelector("[data-load-more-root]")).toBe(originalLoadMore);
    expect(root.querySelector(".ldcv-reader-modal")).toBe(originalModal);
    expect(root.querySelector(".ldcv-grid")?.getAttribute("data-stability-marker")).toBe("reader-open");
    expect(root.querySelectorAll(".ldcv-card[data-topic-id]")).toHaveLength(2);

    renderApp(
      renderOptions(root, {
        data: nextData,
        settings,
        hasMore: true,
        visibleTopicCount: 3,
        enteringTopicIds: new Set([3]),
        reader: emptyReaderState(),
        viewedTopicIds: new Set([1]),
        justReadTopicIds: new Set([1])
      })
    );

    expect(root.querySelector(".ldcv-shell")).toBe(originalShell);
    expect(root.querySelector(".ldcv-grid")).toBe(originalGrid);
    expect(root.querySelector("[data-load-more-root]")).toBe(originalLoadMore);
    expect(root.querySelector(".ldcv-grid")?.getAttribute("data-stability-marker")).toBe("reader-open");
    expect(root.querySelectorAll(".ldcv-card[data-topic-id]")).toHaveLength(2);
    expect(root.querySelector("[data-reader-backdrop]")).toBeNull();
    expect(root.querySelector(".ldcv-card.is-viewed")).not.toBeNull();
  });

  it("clears stale viewed and just-read classes when card state changes", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = topicList([topic(1), topic(2)]);

    renderApp(
      renderOptions(root, {
        data,
        viewedTopicIds: new Set([1]),
        justReadTopicIds: new Set([1])
      })
    );

    const firstCard = root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='1']");
    expect(firstCard?.classList.contains("is-viewed")).toBe(true);
    expect(firstCard?.classList.contains("is-just-read")).toBe(true);

    renderApp(
      renderOptions(root, {
        data,
        viewedTopicIds: new Set(),
        justReadTopicIds: new Set()
      })
    );

    const updatedFirstCard = root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='1']");
    expect(updatedFirstCard?.classList.contains("is-viewed")).toBe(false);
    expect(updatedFirstCard?.classList.contains("is-just-read")).toBe(false);
    expect(updatedFirstCard?.querySelector(".ldcv-state")).toBeNull();
  });

  it("skips repeated card-state patch work when modal-only inputs are unchanged", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = topicList([topic(1), topic(2)]);
    const settings = { ...DEFAULT_SETTINGS, layout: "masonry" as const };

    renderApp(
      renderOptions(root, {
        data,
        settings,
        reader: { ...emptyReaderState(), topicId: 1, data: readerData() },
        viewedTopicIds: new Set([1]),
        justReadTopicIds: new Set([1])
      })
    );

    const querySelectorAllSpy = vi.spyOn(root, "querySelectorAll");
    renderApp(
      renderOptions(root, {
        data,
        settings,
        reader: { ...emptyReaderState(), topicId: 1, data: readerData() },
        viewedTopicIds: new Set([1]),
        justReadTopicIds: new Set([1])
      })
    );

    expect(querySelectorAllSpy.mock.calls.filter(([selector]) => selector === ".ldcv-card[data-topic-id]")).toHaveLength(0);
  });

  it("preserves the modal Reader DOM across background-only pending notice renders", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = topicList([topic(1), topic(2)]);
    const settings = { ...DEFAULT_SETTINGS, layout: "masonry" as const };
    const reader = {
      ...emptyReaderState(),
      topicId: 1,
      data: readerData()
    };

    renderApp(renderOptions(root, { data, settings, reader }));
    const originalModal = root.querySelector<HTMLElement>(".ldcv-reader-modal");
    const originalComment = root.querySelector<HTMLElement>(".ldcv-reader-comment");
    const toggle = root.querySelector<HTMLButtonElement>(".ldcv-reader-comment__toggle");
    toggle?.click();
    expect(originalModal).not.toBeNull();
    expect(originalComment?.classList.contains("is-expanded")).toBe(true);

    renderApp(
      renderOptions(root, {
        data,
        settings,
        reader,
        pendingNewTopicCount: 1,
        pendingNewTopics: [topic(9)],
        pendingNoticeExpanded: true
      })
    );

    expect(root.querySelector(".ldcv-reader-modal")).toBe(originalModal);
    expect(root.querySelector(".ldcv-reader-comment")).toBe(originalComment);
    expect(root.querySelector<HTMLElement>(".ldcv-reader-comment")?.classList.contains("is-expanded")).toBe(true);
    expect(root.querySelector<HTMLButtonElement>(".ldcv-reader-comment__toggle")?.getAttribute("aria-expanded")).toBe("true");

    root.querySelector<HTMLButtonElement>(".ldcv-reader-comment__toggle")?.click();
    expect(root.querySelector<HTMLElement>(".ldcv-reader-comment")?.classList.contains("is-collapsed")).toBe(true);
    expect(root.querySelector<HTMLButtonElement>(".ldcv-reader-comment__toggle")?.getAttribute("aria-expanded")).toBe("false");
  });

  it("preserves the reader view background while the image viewer opens and closes", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = topicList([topic(1), topic(2)]);
    const settings = { ...DEFAULT_SETTINGS, layout: "reader" as const };
    const reader = { ...emptyReaderState(), topicId: 1, loading: false };
    const imageViewer = {
      src: "https://linux.do/image.png",
      alt: "image",
      originalUrl: "https://linux.do/image.png",
      items: [
        {
          src: "https://linux.do/image.png",
          alt: "image",
          originalUrl: "https://linux.do/image.png"
        }
      ],
      index: 0,
      scale: 1,
      rotation: 0
    };

    renderApp(renderOptions(root, { data, settings, reader, useNativePendingNotice: true }));
    const originalShell = root.querySelector<HTMLElement>(".ldcv-shell");
    originalShell?.setAttribute("data-stability-marker", "reader-background");
    expect(originalShell).not.toBeNull();
    expect(root.querySelector(".ldcv-shell.has-native-controls")).not.toBeNull();

    renderApp(
      renderOptions(root, {
        data,
        settings,
        useNativePendingNotice: false,
        reader: { ...reader, imageViewer }
      })
    );

    expect(root.querySelector(".ldcv-shell")).toBe(originalShell);
    expect(root.querySelector(".ldcv-shell")?.getAttribute("data-stability-marker")).toBe("reader-background");
    expect(root.querySelector(".ldcv-shell.has-native-controls")).not.toBeNull();
    expect(root.querySelector("[data-image-viewer-backdrop]")).not.toBeNull();

    renderApp(
      renderOptions(root, {
        data,
        settings,
        useNativePendingNotice: false,
        reader
      })
    );

    expect(root.querySelector(".ldcv-shell")).toBe(originalShell);
    expect(root.querySelector(".ldcv-shell")?.getAttribute("data-stability-marker")).toBe("reader-background");
    expect(root.querySelector(".ldcv-shell.has-native-controls")).not.toBeNull();
    expect(root.querySelector("[data-image-viewer-backdrop]")).toBeNull();
  });

  it("animates the modal from the clicked card origin only on first open", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = topicList([topic(1)]);
    const settings = { ...DEFAULT_SETTINGS, layout: "grid" as const };
    const modalOrigin = {
      x: 420,
      y: 260,
      scaleX: 0.38,
      scaleY: 0.24
    };

    renderApp(
      renderOptions(root, {
        data,
        settings,
        reader: { ...emptyReaderState(), topicId: 1, loading: true, modalOrigin }
      })
    );

    const firstModal = root.querySelector<HTMLElement>(".ldcv-reader-modal");
    const readerCss = readFileSync(join(process.cwd(), "src/styles/reader.css"), "utf8");
    const reactReaderCss = readFileSync(join(process.cwd(), "src/styles/react-reader.css"), "utf8");
    const shellBackdrop = root.querySelector<HTMLElement>("[data-reader-shell='backdrop']");
    expect(root.querySelector("[data-react-reader-modal='true']")).not.toBeNull();
    expect(shellBackdrop?.getAttribute("data-reader-shell-state")).toBe("entering");
    expect(shellBackdrop?.getAttribute("data-reader-compose-host")).toBe("false");
    expect(root.querySelector(".ldcv-reader-backdrop.is-entering")).not.toBeNull();
    expect(firstModal?.classList.contains("ldcv-reader-shell")).toBe(true);
    expect(firstModal?.classList.contains("is-entering")).toBe(true);
    expect(firstModal?.getAttribute("data-reader-shell-state")).toBe("entering");
    // Loading is a status state: rendered through <ReaderContent /> (React),
    // not the readerContentTemplate string. See Phase 4a dual-render switch.
    expect(firstModal?.getAttribute("data-reader-template-mode")).toBe("react");
    expect(firstModal?.style.getPropertyValue("--ldcv-reader-origin-x")).toBe("420px");
    expect(firstModal?.getAttribute("style")).toContain("--ldcv-reader-origin-translate-x:");
    expect(firstModal?.style.getPropertyValue("--ldcv-reader-origin-scale-x")).toBe("0.380");
    expect(readerCss).toContain("inset: 0;");
    expect(readerCss).toContain("backdrop-filter: blur(7px)");
    expect(readerCss).toContain("translate3d(0, -18px, 0) scale(0.965)");
    expect(readerCss).not.toContain("var(--ldcv-reader-origin-translate-x");
    expect(readerCss).not.toContain("--ldcv-reader-modal-safe-left");
    expect(readerCss).not.toContain("--ldcv-reader-modal-safe-top");
    expect(reactReaderCss).toContain(".ldcv-reader-modal.ldcv-reader-shell");
    expect(reactReaderCss).toContain("data-reader-shell-state=\"closing\"");

    renderApp(
      renderOptions(root, {
        data,
        settings,
        reader: { ...emptyReaderState(), topicId: 1, loading: false, modalOrigin }
      })
    );

    expect(root.querySelector(".ldcv-reader-backdrop.is-entering")).toBeNull();
    expect(root.querySelector(".ldcv-reader-modal.is-entering")).toBeNull();
    expect(root.querySelector("[data-reader-shell='backdrop']")?.getAttribute("data-reader-shell-state")).toBe("open");
    expect(root.querySelector(".ldcv-reader-modal")?.getAttribute("data-reader-shell-state")).toBe("open");
  });

  it("renders the Reader loading/error states through React content", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });

    // Loading: topicId set, loading true
    renderApp(renderOptions(root, {
      reader: { ...emptyReaderState(), topicId: 1, loading: true }
    }));
    expect(root.querySelector(".ldcv-reader-article--status")).not.toBeNull();
    expect(root.querySelector(".ldcv-reader-article--status")?.textContent).toContain("正在读取完整讨论");
    expect(root.querySelector(".ldcv-reader-modal")?.getAttribute("data-reader-template-mode")).toBe("react");

    // Error: error present, no data
    renderApp(renderOptions(root, {
      reader: { ...emptyReaderState(), topicId: 1, error: "网络断了" }
    }));
    const errorArticle = root.querySelector(".ldcv-reader-article--status");
    expect(errorArticle?.textContent).toContain("讨论读取失败");
    expect(errorArticle?.textContent).toContain("网络断了");
    expect(root.querySelector("[data-action='retry-reader']")).not.toBeNull();
    expect(root.querySelector(".ldcv-reader-modal")?.getAttribute("data-reader-template-mode")).toBe("react");

    // Loaded state also renders through React (Phase 4b full switch)
    renderApp(renderOptions(root, {
      data: topicList([topic(1)]),
      reader: { ...emptyReaderState(), topicId: 1, data: readerData() }
    }));
    expect(root.querySelector(".ldcv-reader-modal")?.getAttribute("data-reader-template-mode")).toBe("react");
    expect(root.querySelector(".ldcv-reader-article")).not.toBeNull();
  });

  it("fades out the modal reader before closing", () => {
    const motion = installAnimateMock();
    try {
      vi.useFakeTimers();
      vi.stubGlobal("ResizeObserver", ResizeObserverStub);
      const host = document.createElement("div");
      const root = host.attachShadow({ mode: "open" });
      const onCloseReader = vi.fn();

      renderApp(
        renderOptions(root, {
          data: topicList([topic(1)]),
          reader: {
            ...emptyReaderState(),
            topicId: 1,
            data: readerData()
          },
          onCloseReader
        })
      );

      root.querySelector<HTMLButtonElement>(".ldcv-reader-modal [data-action='close-reader']")?.click();

      expect(onCloseReader).not.toHaveBeenCalled();
      expect(root.querySelector(".ldcv-reader-backdrop")?.classList.contains("is-closing")).toBe(true);
      expect(root.querySelector(".ldcv-reader-modal")?.classList.contains("is-closing")).toBe(true);
      expect(root.querySelector("[data-reader-shell='backdrop']")?.getAttribute("data-reader-shell-state")).toBe("closing");
      expect(root.querySelector(".ldcv-reader-modal")?.getAttribute("data-reader-shell-state")).toBe("closing");
      expect(motion.targets.some((target) => target.classList.contains("ldcv-reader-backdrop"))).toBe(true);
      expect(motion.targets.some((target) => target.classList.contains("ldcv-reader-modal"))).toBe(true);
      expect(JSON.stringify(motion.calls.at(-1)?.[0])).toContain("translate3d(0, -10px, 0) scale(0.965)");

      finishAnimation(motion.animations.at(-1));
      vi.runAllTimers();

      expect(onCloseReader).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      motion.restore();
    }
  });

  it("passes clicked card geometry when opening a topic", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    window.requestAnimationFrame = window.requestAnimationFrame || ((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const data = topicList([topic(1)]);
    const onOpenTopic = vi.fn();

    renderApp(renderOptions(root, { data, onOpenTopic }));

    const card = root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='1']");
    const anchor = card?.querySelector<HTMLAnchorElement>("a[href]");
    expect(card).not.toBeNull();
    expect(anchor).not.toBeNull();
    if (!card || !anchor) {
      return;
    }

    card.getBoundingClientRect = () =>
      ({
        left: 120,
        top: 80,
        width: 300,
        height: 220,
        right: 420,
        bottom: 300,
        x: 120,
        y: 80,
        toJSON: () => ({})
      }) as DOMRect;

    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));

    expect(onOpenTopic).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        x: 270,
        y: 190,
        translateX: expect.any(Number),
        translateY: expect.any(Number)
      })
    );
  });

  it("morphs an author trigger into the Reader user preview", () => {
    const motion = installAnimateMock();
    try {
      vi.stubGlobal("ResizeObserver", ResizeObserverStub);
      const host = document.createElement("div");
      const root = host.attachShadow({ mode: "open" });
      const data = topicList([topic(1)]);
      const reader: ReaderState = {
        ...emptyReaderState(),
        topicId: 1,
        data: readerData()
      };
      const onOpenUserPreview = vi.fn((preview: ReaderUserPreviewState) => {
        renderApp(
          renderOptions(root, {
            data,
            reader: {
              ...reader,
              userPreview: preview
            },
            onOpenUserPreview
          })
        );
        const previewNode = root.querySelector<HTMLElement>(".ldcv-user-preview");
        if (previewNode) {
          mockRect(previewNode, { left: 180, top: 130, width: 280, height: 130 });
        }
      });

      renderApp(renderOptions(root, { data, reader, onOpenUserPreview }));
      const author = root.querySelector<HTMLAnchorElement>("[data-reader-user-preview]");
      expect(author).not.toBeNull();
      if (!author) {
        return;
      }
      mockRect(author, { left: 80, top: 92, width: 86, height: 28 });

      author.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));

      expect(onOpenUserPreview).toHaveBeenCalledTimes(1);
      expect(root.querySelector(".ldcv-user-preview")).not.toBeNull();
      expect(motion.targets.some((target) => target.classList.contains("ldcv-user-preview"))).toBe(true);
      expect(JSON.stringify(motion.calls.at(-1)?.[0])).toContain("scale(1.012)");
    } finally {
      motion.restore();
    }
  });

  it.each(["grid", "masonry"] as const)(
    "preserves the Reader while morphing an image into the image viewer in %s layout",
    (layout) => {
      const motion = installAnimateMock();
      try {
        vi.stubGlobal("ResizeObserver", ResizeObserverStub);
        const host = document.createElement("div");
        const root = host.attachShadow({ mode: "open" });
        const data = topicList([topic(1)]);
        const settings = { ...DEFAULT_SETTINGS, layout };
        const removedShells: HTMLElement[] = [];
        const originalRemove = HTMLElement.prototype.remove;
        vi.spyOn(HTMLElement.prototype, "remove").mockImplementation(function (this: HTMLElement) {
          if (this.classList.contains("ldcv-shell")) {
            removedShells.push(this);
          }
          return originalRemove.call(this);
        });
        const imageReader = readerData();
        imageReader.posts[0] = {
          ...imageReader.posts[0],
          html: '<p><img class="ldcv-reader-image" src="https://linux.do/image.png" alt="preview"></p>'
        };
        const reader: ReaderState = {
          ...emptyReaderState(),
          topicId: 1,
          data: imageReader
        };
        let activeReader = reader;
        const onImageViewerAction = vi.fn();
        const onOpenReaderImage = vi.fn((image: ReaderImageViewerState) => {
          activeReader = {
            ...reader,
            imageViewer: image
          };
          renderApp(
            renderOptions(root, {
              data,
              settings,
              reader: activeReader,
              onOpenReaderImage,
              onImageViewerAction,
              onCloseReaderImage
            })
          );
          const viewerImage = root.querySelector<HTMLElement>(".ldcv-image-viewer__stage img");
          if (viewerImage) {
            mockRect(viewerImage, { left: 220, top: 120, width: 560, height: 420 });
          }
        });
        const onCloseReaderImage = vi.fn(() => {
          activeReader = reader;
          renderApp(
            renderOptions(root, {
              data,
              settings,
              reader: activeReader,
              onOpenReaderImage,
              onImageViewerAction,
              onCloseReaderImage
            })
          );
        });

        renderApp(renderOptions(root, { data, settings, reader, onOpenReaderImage, onImageViewerAction, onCloseReaderImage }));
        const originalShell = root.querySelector<HTMLElement>(".ldcv-shell");
        const originalModal = root.querySelector<HTMLElement>(".ldcv-reader-modal");
        const originalScroller = root.querySelector<HTMLElement>(".ldcv-reader-modal .ldcv-reader-scroll");
        expect(originalShell).not.toBeNull();
        expect(originalModal).not.toBeNull();
        expect(originalScroller).not.toBeNull();
        if (originalScroller) {
          originalScroller.scrollTop = 128;
        }
        const image = root.querySelector<HTMLElement>(".ldcv-reader-prose img.ldcv-reader-image");
        expect(image).not.toBeNull();
        if (!image) {
          return;
        }
        mockRect(image, { left: 96, top: 220, width: 160, height: 110 });

        image.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));

        expect(onOpenReaderImage).toHaveBeenCalledTimes(1);
        expect(root.querySelector("[data-image-viewer-backdrop]")).not.toBeNull();
        expect(removedShells).toHaveLength(0);
        expect(root.querySelector(".ldcv-shell")).toBe(originalShell);
        expect(root.querySelector(".ldcv-reader-modal")).toBe(originalModal);
        expect(root.querySelector<HTMLElement>(".ldcv-reader-modal .ldcv-reader-scroll")?.scrollTop).toBe(128);
        expect(motion.targets.some((target) => target.matches(".ldcv-image-viewer__stage img"))).toBe(true);
        expect(motion.targets.some((target) => target.matches("[data-image-viewer-backdrop]"))).toBe(true);

        root
          .querySelector<HTMLElement>("[data-image-viewer-backdrop]")
          ?.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -16 }));

        expect(onImageViewerAction).toHaveBeenCalledWith({ type: "wheel-zoom", deltaY: -16 });

        root.querySelector<HTMLButtonElement>("[data-action='close-image-viewer']")?.click();

        expect(onCloseReaderImage).toHaveBeenCalledTimes(1);
        expect(root.querySelector("[data-image-viewer-backdrop]")).toBeNull();
        expect(root.querySelector(".ldcv-shell")).toBe(originalShell);
        expect(root.querySelector(".ldcv-reader-modal")).toBe(originalModal);
        expect(root.querySelector<HTMLElement>(".ldcv-reader-modal .ldcv-reader-scroll")?.scrollTop).toBe(128);
      } finally {
        motion.restore();
      }
    }
  );

  it("closes the image viewer without re-rendering the Reader shell", () => {
    const motion = installAnimateMock();
    try {
      vi.stubGlobal("ResizeObserver", ResizeObserverStub);
      const host = document.createElement("div");
      const root = host.attachShadow({ mode: "open" });
      const data = topicList([topic(1)]);
      const reader: ReaderState = {
        ...emptyReaderState(),
        topicId: 1,
        data: readerData(),
        imageViewer: {
          src: "https://linux.do/image.png",
          alt: "preview",
          originalUrl: "https://linux.do/image.png",
          items: [
            {
              src: "https://linux.do/image.png",
              alt: "preview",
              originalUrl: "https://linux.do/image.png"
            }
          ],
          index: 0,
          scale: 1,
          rotation: 0
        }
      };

      renderApp(renderOptions(root, { data, reader }));
      const originalShell = root.querySelector<HTMLElement>(".ldcv-shell");
      const originalModal = root.querySelector<HTMLElement>(".ldcv-reader-modal");
      const originalScroller = root.querySelector<HTMLElement>(".ldcv-reader-modal .ldcv-reader-scroll");
      if (originalScroller) {
        originalScroller.scrollTop = 144;
      }

      expect(closeImageViewerWithMotion(root)).toBe(true);
      expect(root.querySelector("[data-image-viewer-backdrop]")).not.toBeNull();
      expect(root.querySelector("[data-image-viewer-backdrop]")?.getAttribute("data-image-viewer-closing")).toBe("true");
      expect(root.querySelector(".ldcv-shell")).toBe(originalShell);
      expect(root.querySelector(".ldcv-reader-modal")).toBe(originalModal);

      finishAnimation(motion.animations.at(-1));

      expect(root.querySelector("[data-image-viewer-backdrop]")).toBeNull();
      expect(root.querySelector(".ldcv-shell")).toBe(originalShell);
      expect(root.querySelector(".ldcv-reader-modal")).toBe(originalModal);
      expect(root.querySelector<HTMLElement>(".ldcv-reader-modal .ldcv-reader-scroll")?.scrollTop).toBe(144);
    } finally {
      motion.restore();
    }
  });

  it("morphs the minimized new-topic pill into the expanded topic notice", () => {
    const motion = installAnimateMock();
    try {
      vi.stubGlobal("ResizeObserver", ResizeObserverStub);
      const host = document.createElement("div");
      const root = host.attachShadow({ mode: "open" });
      const data = topicList([topic(1)]);
      const pendingTopic = topic(9, { title: "New topic" });
      const onTogglePendingPreview = vi.fn(() => {
        renderApp(
          renderOptions(root, {
            data,
            pendingNewTopicCount: 1,
            pendingNewTopics: [pendingTopic],
            pendingNoticeExpanded: true,
            pendingNoticeMinimized: false,
            allowFloatingPendingNotice: true,
            onTogglePendingPreview
          })
        );
        const notice = root.querySelector<HTMLElement>(".ldcv-update-float.is-expanded");
        if (notice) {
          mockRect(notice, { left: 360, top: 90, width: 420, height: 132 });
        }
      });

      renderApp(
        renderOptions(root, {
          data,
          pendingNewTopicCount: 1,
          pendingNewTopics: [pendingTopic],
          pendingNoticeExpanded: false,
          pendingNoticeMinimized: true,
          allowFloatingPendingNotice: true,
          onTogglePendingPreview
        })
      );

      const pill = root.querySelector<HTMLElement>(".ldcv-update-float.is-minimized");
      expect(pill).not.toBeNull();
      if (!pill) {
        return;
      }
      mockRect(pill, { left: 620, top: 86, width: 80, height: 40 });

      pill.click();

      expect(onTogglePendingPreview).toHaveBeenCalledTimes(1);
      expect(root.querySelector(".ldcv-update-float.is-expanded")).not.toBeNull();
      expect(motion.targets.some((target) => target.classList.contains("ldcv-update-float"))).toBe(true);
      expect(JSON.stringify(motion.calls.at(-1)?.[0])).toContain("scale(1.012)");
    } finally {
      motion.restore();
    }
  });
});

describe("renderNativePendingNotice", () => {
  it("keeps standalone native pending notice actions bound through the React island", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const onTogglePendingPreview = vi.fn();
    const onApplyPendingRefresh = vi.fn();
    const onOpenTopic = vi.fn();
    const pendingTopic = topic(9, {
      title: "Native <topic>",
      category: {
        id: 7,
        name: "Release",
        parentName: "Linux.do",
        color: "0088cc",
        textColor: "ffffff"
      }
    });

    renderNativePendingNotice(root, {
      count: 1,
      topics: [pendingTopic],
      expanded: true,
      onTogglePendingPreview,
      onApplyPendingRefresh,
      onOpenTopic
    });

    const notice = root.querySelector<HTMLElement>(".ldcv-native-notice");
    expect(notice?.dataset.reactNativePendingNotice).toBe("true");
    expect(notice?.classList.contains("is-expanded")).toBe(true);
    expect(notice?.classList.contains("has-pending")).toBe(true);
    expect(root.querySelector(".ldcv-native-notice__trigger")?.getAttribute("aria-expanded")).toBe("true");
    expect(root.querySelector(".ldcv-native-notice__trigger")?.getAttribute("aria-haspopup")).toBe("menu");
    expect(root.querySelector("[data-pending-topic-id='9']")?.getAttribute("role")).toBe("menuitem");
    expect(root.querySelector("[data-pending-topic-id='9']")?.textContent).toContain("Native <topic>");
    expect(root.querySelector("[data-pending-topic-id='9']")?.textContent).toContain("Linux.do / Release");

    root.querySelector<HTMLButtonElement>(".ldcv-native-notice__trigger")?.click();
    root.querySelector<HTMLButtonElement>(".ldcv-native-notice__update")?.click();
    root.querySelector<HTMLButtonElement>("[data-pending-topic-id='9']")?.click();

    expect(onTogglePendingPreview).toHaveBeenCalledTimes(1);
    expect(onApplyPendingRefresh).toHaveBeenCalledTimes(1);
    expect(onOpenTopic).toHaveBeenCalledWith(9);
  });

  it("renders no-pending native notice trigger through the React island", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const noop = (): void => {};

    renderNativePendingNotice(root, {
      count: 0,
      topics: [],
      expanded: true,
      onTogglePendingPreview: noop,
      onApplyPendingRefresh: noop,
      onOpenTopic: noop
    });

    const notice = root.querySelector<HTMLElement>(".ldcv-native-notice");
    const trigger = root.querySelector<HTMLButtonElement>(".ldcv-native-notice__trigger");
    expect(notice?.dataset.reactNativePendingNotice).toBe("true");
    expect(notice?.classList.contains("has-pending")).toBe(false);
    expect(notice?.classList.contains("is-expanded")).toBe(false);
    expect(trigger?.getAttribute("aria-haspopup")).toBe("false");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(trigger?.getAttribute("aria-disabled")).toBe("true");
    expect(trigger?.getAttribute("title")).toBe("暂无新话题");
    expect(root.querySelector(".ldcv-native-notice__menu")).toBeNull();
  });
});

describe("renderNativeTopControls", () => {
  it("renders fixed top new-topic and reading controls", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const noop = (): void => {};

    renderNativeTopControls(root, {
      settings: DEFAULT_SETTINGS,
      topicCount: 42,
      loading: false,
      updatedAt: "刚刚",
      count: 5,
      topics: [],
      expanded: false,
      onTogglePendingPreview: noop,
      onApplyPendingRefresh: noop,
      onOpenTopic: noop,
      onRefresh: noop,
      onSettingsChange: noop
    });

    expect(root.querySelector(".ldcv-native-notice__trigger")?.textContent).toContain("新帖");
    expect(root.querySelector<HTMLElement>(".ldcv-native-notice")?.dataset.reactNativePendingNotice).toBe("true");
    expect(root.querySelector<HTMLElement>(".ldcv-native-notice")?.dataset.reactFloatingPendingNotice).toBeUndefined();
    expect(root.querySelector(".ldcv-native-reader__trigger")?.textContent).toContain("阅读");
    expect(root.querySelector(".ldcv-native-reader__trigger")?.textContent).toContain("卡片");
    expect(root.querySelector<HTMLElement>("[data-toolbar-actions-host]")?.dataset.toolbarActionsVariant).toBe("native");
    expect(root.querySelector(".ldcv-native-reader__actions")?.getAttribute("data-react-toolbar-actions")).toBe("true");
    expect(root.querySelector(".ldcv-native-reader__actions [data-layout='grid'] span")?.textContent).toBe("卡片");
    expect(root.querySelector("[data-layout='reader']")?.getAttribute("aria-label")).toBe("列表阅读视图");
    const settingsPanel = root.querySelector<HTMLElement>(".ldcv-native-reader__menu [data-settings-panel]");
    const settingsButton = root.querySelector<HTMLButtonElement>(".ldcv-native-reader__menu [data-action='toggle-settings']");
    expect(settingsPanel).not.toBeNull();
    if (settingsPanel && settingsButton) {
      if (!settingsPanel.hasAttribute("hidden")) {
        settingsButton.click();
      }
      expect(settingsPanel.hasAttribute("hidden")).toBe(true);
      settingsButton.click();
      expect(settingsPanel.hasAttribute("hidden")).toBe(false);
      settingsButton.click();
      expect(settingsPanel.hasAttribute("hidden")).toBe(true);
    }
  });

  it("keeps native top-control actions bound through the React toolbar island", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const noop = (): void => {};
    const onRefresh = vi.fn();
    const onSettingsChange = vi.fn();

    renderNativeTopControls(root, {
      settings: DEFAULT_SETTINGS,
      topicCount: 42,
      loading: false,
      updatedAt: "刚刚",
      count: 0,
      topics: [],
      expanded: false,
      onTogglePendingPreview: noop,
      onApplyPendingRefresh: noop,
      onOpenTopic: noop,
      onRefresh,
      onSettingsChange
    });

    expect(root.querySelector(".ldcv-native-reader__actions[data-react-toolbar-actions='true']")).not.toBeNull();
    root.querySelector<HTMLButtonElement>(".ldcv-native-reader__menu [data-action='refresh']")?.click();
    expect(onRefresh).toHaveBeenCalledTimes(1);

    const settingsButton = root.querySelector<HTMLButtonElement>(".ldcv-native-reader__menu [data-action='toggle-settings']");
    const settingsPanel = root.querySelector<HTMLElement>(".ldcv-native-reader__menu [data-settings-panel]");
    expect(settingsButton?.getAttribute("aria-expanded")).toBe("false");
    settingsButton?.click();
    expect(settingsButton?.getAttribute("aria-expanded")).toBe("true");
    expect(settingsPanel?.hasAttribute("hidden")).toBe(false);

    root.querySelector<HTMLButtonElement>(".ldcv-native-reader__menu [data-layout='masonry']")?.click();
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, layout: "masonry" }));

    root.querySelector<HTMLButtonElement>(".ldcv-native-reader__menu [data-action='toggle-original']")?.click();
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));

    closeTransientPanels(root);
  });

  it("closes React-owned native pending menus without removing their DOM", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const noop = (): void => {};
    const onDismissPendingPreview = vi.fn();

    renderNativeTopControls(root, {
      settings: DEFAULT_SETTINGS,
      topicCount: 42,
      loading: false,
      updatedAt: "刚刚",
      count: 1,
      topics: [topic(9)],
      expanded: true,
      onTogglePendingPreview: noop,
      onApplyPendingRefresh: noop,
      onOpenTopic: noop,
      onRefresh: noop,
      onSettingsChange: noop,
      onDismissPendingPreview
    });

    const notice = root.querySelector<HTMLElement>(".ldcv-native-notice");
    const menu = root.querySelector<HTMLElement>(".ldcv-native-notice__menu");
    expect(notice?.dataset.reactNativePendingNotice).toBe("true");
    expect(notice?.classList.contains("is-expanded")).toBe(true);
    expect(menu).not.toBeNull();

    // jsdom toggles <details>.open on summary click but does not fire the
    // async "toggle" event that real browsers dispatch. Mirror the sequence
    // the runtime relies on via bindTransientDetailActions.
    const readerDetails = root.querySelector<HTMLDetailsElement>(".ldcv-native-reader");
    readerDetails!.open = true;
    readerDetails!.dispatchEvent(new Event("toggle"));

    expect(onDismissPendingPreview).toHaveBeenCalledTimes(1);
    expect(notice?.classList.contains("is-expanded")).toBe(false);
    expect(root.querySelector(".ldcv-native-notice__menu")).toBe(menu);
    expect(menu?.hidden).toBe(true);
  });

  it("keeps native top controls available in original view and moves update into the pending header", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const noop = (): void => {};

    renderNativeTopControls(root, {
      settings: { ...DEFAULT_SETTINGS, enabled: false },
      topicCount: 42,
      loading: false,
      updatedAt: "刚刚",
      count: 1,
      topics: [topic(9)],
      expanded: true,
      onTogglePendingPreview: noop,
      onApplyPendingRefresh: noop,
      onOpenTopic: noop,
      onRefresh: noop,
      onSettingsChange: noop
    });

    expect(root.querySelector(".ldcv-native-reader__trigger")?.textContent).toContain("原始");
    expect(root.querySelector(".ldcv-native-notice__head [data-action='apply-pending-refresh']")?.textContent).toBe("更新");
    expect(root.querySelector(".ldcv-native-notice__footer")).toBeNull();
    expect(root.querySelector("[data-pending-topic-id='9'] .ldcv-new-marker")?.textContent).toBe("new");
  });
});
