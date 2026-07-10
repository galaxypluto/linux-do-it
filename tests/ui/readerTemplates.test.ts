import { describe, expect, it } from "vitest";
import type { TopicCardData, TopicReaderData, TopicReaderPost, TopicReplyNode } from "../../src/discourse/types";
import { DEFAULT_SETTINGS } from "../../src/storage/settings";
import { nativeNestedTopicUrl, preferredTopicUrl, profileUrlForUsername, readerContentTemplate } from "../../src/ui/readerTemplates";
import type { ReaderTemplateSettings } from "../../src/ui/readerTemplates";

/** Convert a sort-order string or partial settings to ReaderTemplateSettings */
function ts(settings: string | Partial<ReaderTemplateSettings>): ReaderTemplateSettings {
  if (typeof settings === "string") {
    return { ...DEFAULT_SETTINGS, commentSortOrder: settings };
  }
  return { ...DEFAULT_SETTINGS, ...settings };
}
import type { ReaderState } from "../../src/ui/readerTypes";

function topic(overrides: Partial<TopicCardData> = {}): TopicCardData {
  return {
    id: 1,
    title: "Escaped <topic>",
    url: "/t/escaped-topic/1",
    slug: "escaped-topic",
    excerpt: "",
    thumbnailUrl: "",
    category: {
      id: 2,
      name: "General",
      parentName: "Parent",
      color: "aabbcc",
      textColor: "ffffff"
    },
    tags: ["reader"],
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

function post(postNumber: number, overrides: Partial<TopicReaderPost> = {}): TopicReaderPost {
  return {
    id: postNumber,
    postNumber,
    replyToPostNumber: null,
    author: {
      id: postNumber,
      username: `user${postNumber}`,
      name: `User ${postNumber}`,
      avatarUrl: `https://linux.do/avatar/${postNumber}.png`
    },
    createdAt: "2026-05-01T00:00:00.000Z",
    html: `<p>Post ${postNumber}</p>`,
    stats: {
      likes: 0,
      reads: 0,
      replies: 0
    },
    actions: {
      canReply: true,
      canLike: true,
      liked: false,
      canBookmark: postNumber === 1,
      bookmarked: false
    },
    url: `/t/topic/10/${postNumber}`,
    isOriginalPost: postNumber === 1,
    isOriginalPoster: postNumber === 1,
    ...overrides
  };
}

function node(postValue: TopicReaderPost, children: TopicReplyNode[] = []): TopicReplyNode {
  return {
    post: postValue,
    children,
    depth: 0
  };
}

function reader(overrides: Partial<ReaderState> = {}): ReaderState {
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
    ...overrides
  };
}

function readerData(overrides: Partial<TopicReaderData> = {}): TopicReaderData {
  const main = post(1, {
    author: {
      id: 1,
      username: "alice",
      name: "Alice <Admin>",
      avatarUrl: "https://linux.do/avatar/alice.png"
    },
    html: "<p>Main body</p>"
  });
  const reply = post(2, {
    replyToPostNumber: 1,
    author: {
      id: 2,
      username: "bob",
      name: "Bob",
      avatarUrl: ""
    },
    stats: {
      likes: 3,
      reads: 0,
      replies: 0
    },
    html: "<p>Reply body</p>"
  });

  return {
    id: 1,
    title: "Title <unsafe>",
    url: "/t/topic/1",
    slug: "topic",
    stats: {
      posts: 5,
      views: 100,
      likes: 7
    },
    actions: {
      canReply: true,
      draftKey: "topic_1",
      draftSequence: 0
    },
    tags: ["guide"],
    category: topic().category,
    opAuthor: main.author,
    posts: [main, reply],
    tree: [node(reply)],
    postStream: [1, 2, 3, 4, 5],
    loadedPostIds: [1, 2],
    hasMorePosts: true,
    ...overrides
  };
}

describe("reader template states", () => {
  it("renders the idle pane without a selected topic", () => {
    const doc = new DOMParser().parseFromString(readerContentTemplate(reader(), "pane", [], ts("asc")), "text/html");

    expect(doc.querySelector(".ldcv-reader-article")?.getAttribute("data-reader-variant")).toBe("pane");
    expect(doc.body.textContent).toContain("选择一个帖子开始阅读");
  });

  it("renders the loading modal with reader controls", () => {
    const doc = new DOMParser().parseFromString(
      readerContentTemplate(reader({ topicId: 1, loading: true }), "modal", [topic()], ts("asc")),
      "text/html"
    );

    expect(doc.querySelector("[data-action='close-reader']")).not.toBeNull();
    expect(doc.querySelector(".ldcv-reader-loader.is-loading")).not.toBeNull();
  });

  it("renders escaped topic data, profile anchors, collapsed comments, and pane load-more copy", () => {
    const doc = new DOMParser().parseFromString(
      readerContentTemplate(reader({ topicId: 1, data: readerData(), freshPostNumbers: [2] }), "pane", [topic()], ts("asc")),
      "text/html"
    );

    expect(doc.querySelector("h2")?.innerHTML).toBe("Title &lt;unsafe&gt;");
    expect(doc.querySelector(".ldcv-reader-author__name")?.getAttribute("href")).toBe("/u/alice");
    expect(doc.querySelector(".ldcv-reader-author__name")?.innerHTML).toContain("Alice &lt;Admin&gt;");
    expect(doc.querySelector(".ldcv-reader-open")?.getAttribute("aria-label")).toBe("原贴");
    expect(doc.querySelector(".ldcv-reader-open--icon .ldcv-reader-open__icon")).not.toBeNull();
    expect(doc.querySelector(".ldcv-reader-primary-actions .ldcv-reader-open--primary")?.getAttribute("aria-label")).toBe("原贴");
    expect(doc.querySelector(".ldcv-reader-primary-actions .ldcv-reader-open--primary")?.getAttribute("href")).toBe("/t/topic/1");
    expect(doc.querySelector(".ldcv-reader-primary-actions [data-reader-post-action='reply']")?.getAttribute("aria-label")).toBe("开始撰写对此帖子的回复");
    expect(doc.querySelector(".ldcv-reader-main-actions [data-reader-post-action='like']")?.getAttribute("aria-pressed")).toBe("false");
    expect(doc.querySelector(".ldcv-reader-main-actions [data-reader-post-action='like']")?.classList.contains("ldcv-reader-action-button--primary")).toBe(true);
    expect(doc.querySelector(".ldcv-reader-main-actions [data-reader-post-action='bookmark']")?.getAttribute("aria-label")).toBe("将主贴添加为书签");
    expect(doc.querySelector(".ldcv-reader-main-actions [data-reader-post-action='bookmark']")?.classList.contains("ldcv-reader-action-button--primary")).toBe(true);
    expect(doc.querySelector(".ldcv-reader-main-actions__post-link")?.textContent).toBe("#1");
    expect(doc.querySelector(".ldcv-reader-main-actions__post-link")?.getAttribute("href")).toBe("/t/topic/10/1");
    expect(doc.querySelector(".ldcv-reader-post__toolbar [data-reader-post-action='like']")).toBeNull();
    expect(doc.querySelector(".ldcv-reader-post__toolbar [data-reader-post-action='bookmark']")).toBeNull();
    expect(doc.querySelector(".ldcv-reader-comment")?.classList.contains("is-collapsed")).toBe(true);
    expect(doc.querySelector(".ldcv-reader-comment")?.classList.contains("is-fresh")).toBe(true);
    expect(doc.querySelector(".ldcv-reader-comment")?.getAttribute("data-original-poster")).toBe("false");
    expect(doc.querySelector(".ldcv-reader-comment [data-reader-post-action='reply']")?.getAttribute("title")).toBe("开始撰写对此帖子的回复");
    expect(doc.querySelector(".ldcv-reader-comment__tools a")?.getAttribute("href")).toBe("/t/topic/10/2");
    expect(doc.querySelector(".ldcv-reader-comment [data-reader-post-action='bookmark']")).toBeNull();
    expect(doc.querySelector("[data-reader-comment-search]")?.getAttribute("placeholder")).toBe("搜索评论");
    expect(doc.querySelector("[data-reader-comment-search-clear]")).not.toBeNull();
    expect(doc.querySelector(".ldcv-reader-head [data-reader-comment-search]")).not.toBeNull();
    expect(doc.querySelector("[data-reader-only-op]")).not.toBeNull();
    expect(doc.querySelector(".ldcv-reader-thread__tools")).toBeNull();
    expect(doc.querySelector("[data-comment-sort='asc']")?.textContent).toBe("正");
    expect(doc.querySelector("[data-comment-sort='desc']")?.getAttribute("aria-label")).toBe("倒序");
    expect(doc.querySelector(".ldcv-reader-new-badge")?.textContent).toBe("new");
    expect(doc.querySelector(".ldcv-reader-loadmore")?.textContent).toContain("首批由站点 topic JSON 返回");
    expect(doc.querySelector(".ldcv-reader-loadmore")?.textContent).toContain("滚到列表底部");
  });

  it("can expand reader comments by setting", () => {
    const doc = new DOMParser().parseFromString(
      readerContentTemplate(
        reader({ topicId: 1, data: readerData(), freshPostNumbers: [2] }),
        "pane",
        [topic()],
        ts({
          commentSortOrder: "asc",
          autoLoadReaderComments: true,
          readerPostBatchSize: 30,
          collapseLongComments: false
        })
      ),
      "text/html"
    );

    expect(doc.querySelector(".ldcv-reader-comment")?.classList.contains("is-expanded")).toBe(true);
    expect(doc.querySelector(".ldcv-reader-loadmore")?.textContent).toContain("滚到列表底部");
    expect(doc.querySelector(".ldcv-reader-loadmore")?.textContent).toContain("下一批 30 条");
  });

  it("renders confirmed native action state and disables pending writes", () => {
    const data = readerData({
      posts: [
        post(1, {
          actions: {
            canReply: true,
            canLike: true,
            liked: true,
            canBookmark: true,
            bookmarked: true
          }
        })
      ],
      tree: [],
      postStream: [1],
      loadedPostIds: [1],
      hasMorePosts: false
    });
    const doc = new DOMParser().parseFromString(
      readerContentTemplate(
        reader({
          topicId: 1,
          data,
          nativePostAction: {
            requestId: "req-1",
            action: "bookmark",
            postNumber: 1,
            status: "pending",
            message: "书签处理中..."
          }
        }),
        "pane",
        [topic()],
        ts("asc")
      ),
      "text/html"
    );

    expect(doc.querySelector("[data-reader-post-action='like']")?.classList.contains("is-active")).toBe(true);
    expect(doc.querySelector("[data-reader-post-action='like']")?.getAttribute("aria-pressed")).toBe("true");
    expect(doc.querySelector("[data-reader-post-action='like']")?.getAttribute("aria-label")).toBe("取消点赞");
    expect(doc.querySelector("[data-reader-post-action='bookmark']")?.classList.contains("is-active")).toBe(true);
    expect(doc.querySelector("[data-reader-post-action='bookmark']")?.getAttribute("aria-label")).toBe("书签处理中...");
    expect(doc.querySelector("[data-reader-post-action='bookmark']")?.hasAttribute("disabled")).toBe(true);
  });

  it("renders native fallback links in action feedback", () => {
    const doc = new DOMParser().parseFromString(
      readerContentTemplate(
        reader({
          topicId: 1,
          data: readerData({
            posts: [post(1)],
            tree: [],
            postStream: [1],
            loadedPostIds: [1]
          }),
          nativePostAction: {
            requestId: "req-1",
            action: "reply",
            postNumber: 1,
            status: "success",
            message: "回复已发送，暂时无法同步正文。",
            fallbackUrl: "https://linux.do/t/topic/1/4"
          }
        }),
        "pane",
        [topic()],
        ts("asc")
      ),
      "text/html"
    );

    const link = doc.querySelector<HTMLAnchorElement>(".ldcv-reader-action-feedback a");
    expect(link?.textContent).toBe("打开原生视图");
    expect(link?.href).toBe("https://linux.do/t/topic/1/4");
  });

  it("keeps modal replies collapsed and modal load-more copy manual", () => {
    const doc = new DOMParser().parseFromString(
      readerContentTemplate(
        reader({ topicId: 1, data: readerData() }),
        "modal",
        [topic()],
        ts({
          ...DEFAULT_SETTINGS,
          commentSortOrder: "desc",
          readerPostBatchSize: 12,
          autoLoadReaderComments: false,
        })
      ),
      "text/html"
    );

    expect(doc.querySelector(".ldcv-reader-comment")?.classList.contains("is-collapsed")).toBe(true);
    expect(doc.querySelector(".ldcv-reader-loadmore")?.textContent).toContain("点击时读取下一批 12 条");
  });
});

describe("profileUrlForUsername", () => {
  it("encodes usernames for local profile links", () => {
    expect(profileUrlForUsername("name/with space")).toBe("/u/name%2Fwith%20space");
  });
});

describe("preferredTopicUrl", () => {
  it("maps topic urls based on the configured view preference", () => {
    expect(preferredTopicUrl("/t/topic/1", "classic")).toBe("/t/topic/1");
    expect(preferredTopicUrl("/t/topic/1", "nested")).toBe("/n/topic/1");
    expect(preferredTopicUrl("https://linux.do/t/topic/1?sort=old#post_2", "nested")).toBe(
      "https://linux.do/n/topic/1?sort=old#post_2"
    );
    expect(preferredTopicUrl("/u/alice", "nested")).toBe("/u/alice");
  });
});

describe("nativeNestedTopicUrl", () => {
  it("maps topic urls to native nested topic urls without changing non-topic urls", () => {
    expect(nativeNestedTopicUrl("/t/topic/1")).toBe("/n/topic/1");
    expect(nativeNestedTopicUrl("https://linux.do/t/topic/1?sort=old#post_2")).toBe(
      "https://linux.do/n/topic/1?sort=old#post_2"
    );
    expect(nativeNestedTopicUrl("/u/alice")).toBe("/u/alice");
  });
});
