import { describe, expect, it } from "vitest";
import {
  applyConfirmedReaderPostAction,
  emptyReaderState,
  mergeSubmittedReaderReply,
  mergeReaderRefreshBase,
  missingReaderPostIdsForRefresh,
  preserveCreditViewTrackingState,
} from "../../src/content/readerState";
import type { TopicReaderData, TopicReaderPost } from "../../src/discourse/types";

function post(postNumber: number, id = 100 + postNumber): TopicReaderPost {
  return {
    id,
    postNumber,
    replyToPostNumber: postNumber > 2 ? 2 : null,
    author: {
      id: postNumber,
      username: `user${postNumber}`,
      name: `User ${postNumber}`,
      avatarUrl: ""
    },
    createdAt: `2026-05-01T0${postNumber}:00:00.000Z`,
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
    url: `/t/topic/1/${postNumber}`,
    isOriginalPost: postNumber === 1,
    isOriginalPoster: postNumber === 1
  };
}

function reader(overrides: Partial<TopicReaderData> = {}): TopicReaderData {
  const posts = overrides.posts ?? [post(1), post(2)];
  return {
    id: 1,
    title: "Topic",
    url: "/t/topic/1",
    slug: "topic",
    stats: {
      posts: posts.length,
      views: 0,
      likes: 0
    },
    actions: {
      canReply: true,
      draftKey: "topic_1",
      draftSequence: 0
    },
    tags: [],
    opAuthor: posts[0]?.author ?? null,
    posts,
    tree: [],
    postStream: posts.map((item) => item.id),
    loadedPostIds: posts.map((item) => item.id),
    hasMorePosts: false,
    ...overrides
  };
}

describe("emptyReaderState", () => {
  it("creates an idle reader state without topic data or overlays", () => {
    expect(emptyReaderState()).toEqual({
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
    });
  });

  it("preserves credit view tracking fields when replacing partial reader state", () => {
    const previous = {
      ...emptyReaderState(),
      topicId: 42,
      creditViewTrackingPhase: "requesting" as const,
      creditViewTrackingStartedAt: 1_700_000_000_000,
    };

    expect(
      preserveCreditViewTrackingState(previous, {
        topicId: 42,
        data: null,
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
      }),
    ).toMatchObject({
      loading: true,
      creditViewTrackingPhase: "requesting",
      creditViewTrackingStartedAt: 1_700_000_000_000,
    });
  });
});

describe("reader native action state", () => {
  it("marks confirmed likes and bookmarks without changing unrelated posts", () => {
    const base = reader({ posts: [post(1), post(2)] });

    const liked = applyConfirmedReaderPostAction(base, 2, "like");
    const bookmarked = applyConfirmedReaderPostAction(liked, 1, "bookmark");

    expect(bookmarked.posts.find((item) => item.postNumber === 2)?.actions.liked).toBe(true);
    expect(bookmarked.posts.find((item) => item.postNumber === 1)?.actions.bookmarked).toBe(true);
    expect(bookmarked.posts.find((item) => item.postNumber === 2)?.actions.bookmarked).toBe(false);
  });

  it("clears confirmed likes and bookmarks after native toggles remove them", () => {
    const base = reader({
      posts: [
        {
          ...post(1),
          actions: {
            ...post(1).actions,
            bookmarked: true
          }
        },
        {
          ...post(2),
          actions: {
            ...post(2).actions,
            liked: true
          }
        }
      ]
    });

    const unliked = applyConfirmedReaderPostAction(base, 2, "like", false);
    const unbookmarked = applyConfirmedReaderPostAction(unliked, 1, "bookmark", false);

    expect(unbookmarked.posts.find((item) => item.postNumber === 2)?.actions.liked).toBe(false);
    expect(unbookmarked.posts.find((item) => item.postNumber === 1)?.actions.bookmarked).toBe(false);
    expect(unbookmarked.posts.find((item) => item.postNumber === 1)?.actions.canBookmark).toBe(true);
    expect(unbookmarked.posts.find((item) => item.postNumber === 2)?.actions.canLike).toBe(true);
  });
});

describe("reader refresh helpers", () => {
  it("merges only the submitted reply from a post-number refresh payload", () => {
    const previous = reader({
      posts: [post(1, 100), post(2, 101)],
      postStream: [100, 101],
      loadedPostIds: [100, 101],
      stats: { posts: 2, views: 10, likes: 1 }
    });
    const fresh = reader({
      posts: [post(1, 100), post(3, 102), post(4, 103)],
      postStream: [100, 101, 102, 103],
      loadedPostIds: [100, 102, 103],
      stats: { posts: 4, views: 12, likes: 1 }
    });

    const merged = mergeSubmittedReaderReply(previous, fresh, 4);

    expect(merged.freshPostNumbers).toEqual([4]);
    expect(merged.data.posts.map((item) => item.postNumber)).toEqual([1, 2, 4]);
    expect(merged.data.posts.find((item) => item.postNumber === 3)).toBeUndefined();
    expect(merged.data.stats.posts).toBe(4);
  });

  it("does not change reader data when the submitted post is absent from the refresh payload", () => {
    const previous = reader({ posts: [post(1, 100), post(2, 101)] });
    const fresh = reader({ posts: [post(1, 100), post(3, 102)] });

    const merged = mergeSubmittedReaderReply(previous, fresh, 4);

    expect(merged.freshPostNumbers).toEqual([]);
    expect(merged.data).toBe(previous);
  });

  it("keeps previously visible posts that are absent from the fresh topic payload", () => {
    const previous = reader({
      posts: [post(1, 100), post(2, 101), post(3, 102)],
      postStream: [100, 101, 102, 103],
      loadedPostIds: [100, 101, 102],
      hasMorePosts: true
    });
    const fresh = reader({
      posts: [post(1, 100), post(4, 103)],
      postStream: [100, 101, 102, 103],
      loadedPostIds: [100, 103],
      hasMorePosts: true
    });

    const merged = mergeReaderRefreshBase(fresh, previous);

    expect(merged.posts.map((item) => item.postNumber)).toEqual([1, 2, 3, 4]);
    expect(merged.loadedPostIds).toEqual([100, 101, 102, 103]);
    expect(merged.hasMorePosts).toBe(false);
  });

  it("ignores previously cached posts no longer visible in the fresh post stream", () => {
    const merged = mergeReaderRefreshBase(
      reader({
        posts: [post(1, 100)],
        postStream: [100],
        loadedPostIds: [100]
      }),
      reader({
        posts: [post(1, 100), post(2, 101)],
        postStream: [100, 101],
        loadedPostIds: [100, 101]
      })
    );

    expect(merged.posts.map((item) => item.postNumber)).toEqual([1]);
  });

  it("selects missing post ids based on previous completeness and new post count", () => {
    expect(
      missingReaderPostIdsForRefresh(
        reader({ postStream: [100, 101, 102], loadedPostIds: [100], stats: { posts: 3, views: 0, likes: 0 } }),
        reader({ hasMorePosts: false, stats: { posts: 1, views: 0, likes: 0 } })
      )
    ).toEqual([101, 102]);

    expect(
      missingReaderPostIdsForRefresh(
        reader({ postStream: [100, 101, 102, 103], loadedPostIds: [100], stats: { posts: 4, views: 0, likes: 0 } }),
        reader({ hasMorePosts: true, stats: { posts: 2, views: 0, likes: 0 } })
      )
    ).toEqual([102, 103]);

    expect(
      missingReaderPostIdsForRefresh(
        reader({ postStream: [100], loadedPostIds: [100], stats: { posts: 1, views: 0, likes: 0 } }),
        reader({ hasMorePosts: true, stats: { posts: 1, views: 0, likes: 0 } })
      )
    ).toEqual([]);
  });
});
