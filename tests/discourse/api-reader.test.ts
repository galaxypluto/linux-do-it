import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchMoreReaderPosts,
  fetchTopicReaderAtPost,
  fetchTopicReader,
  getCachedTopicReader,
  readerReadTimingPayload,
  rememberCachedTopicReader,
  syncTopicReadTimings,
  voteReaderPoll
} from "../../src/discourse/api";
import type { DiscourseTopicResponse, TopicCardData } from "../../src/discourse/types";

const topic: TopicCardData = {
  id: 10,
  title: "Reader topic",
  url: "/n/reader-topic/10",
  slug: "reader-topic",
  excerpt: "",
  thumbnailUrl: "",
  tags: ["reader"],
  stats: {
    replies: 3,
    views: 100,
    likes: 5,
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
  posters: [
    {
      id: 1,
      username: "alice",
      name: "Alice",
      avatarUrl: "https://linux.do/avatar/alice.png",
      description: "Original Poster",
      isOriginalPoster: true
    }
  ]
};

const initialPayload: DiscourseTopicResponse = {
  id: 10,
  title: "Reader topic",
  slug: "reader-topic",
  posts_count: 4,
  views: 100,
  like_count: 5,
  tags: ["reader"],
  draft_key: "topic_10",
  draft_sequence: 3,
  bookmarked: true,
  details: {
    can_create_post: true
  },
  bookmarks: [
    {
      bookmarkable_id: 100,
      bookmarkable_type: "Post",
      post_number: 1
    }
  ],
  post_stream: {
    stream: [100, 101, 102, 103],
    posts: [
      {
        id: 100,
        post_number: 1,
        user_id: 1,
        username: "alice",
        name: "Alice",
        avatar_template: "/avatar/alice/{size}.png",
        created_at: "2026-05-01T00:00:00.000Z",
        cooked: "<p>Main post</p>",
        like_count: 2,
        reads: 10,
        reply_count: 1,
        can_bookmark: true,
        actions_summary: [
          {
            id: 2,
            acted: false,
            can_act: true,
            can_undo: false
          }
        ]
      },
      {
        id: 101,
        post_number: 2,
        user_id: 2,
        username: "bob",
        name: "Bob",
        avatar_template: "/avatar/bob/{size}.png",
        created_at: "2026-05-01T01:00:00.000Z",
        cooked: "<p>First reply</p>",
        like_count: 1,
        reads: 5,
        reply_count: 1,
        can_bookmark: true,
        actions_summary: [
          {
            id: 2,
            acted: true,
            can_act: false,
            can_undo: true
          }
        ]
      },
      {
        id: 102,
        post_number: 3,
        reply_to_post_number: 2,
        user_id: 1,
        username: "alice",
        name: "Alice",
        avatar_template: "/avatar/alice/{size}.png",
        created_at: "2026-05-01T02:00:00.000Z",
        cooked: "<p>OP nested reply</p>",
        like_count: 0,
        reads: 3,
        reply_count: 0,
        actions_summary: [
          {
            id: 2,
            acted: false,
            can_act: true,
            can_undo: false
          }
        ]
      }
    ]
  }
};

const morePayload: DiscourseTopicResponse = {
  post_stream: {
    posts: [
      {
        id: 103,
        post_number: 4,
        reply_to_post_number: 3,
        user_id: 3,
        username: "carol",
        name: "Carol",
        avatar_template: "/avatar/carol/{size}.png",
        created_at: "2026-05-01T03:00:00.000Z",
        cooked: "<p>Late nested reply</p>",
        like_count: 0,
        reads: 2,
        reply_count: 0
      }
    ]
  }
};

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  } as Response;
}

describe("reader topic API normalization", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.head.innerHTML = "";
    sessionStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("builds reader posts, OP markers, loaded ids, and reply trees from topic JSON", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(initialPayload));

    const reader = await fetchTopicReader(topic, undefined, { skipCache: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/t/reader-topic/10.json",
      expect.objectContaining({ credentials: "include" })
    );
    expect(reader.posts).toHaveLength(3);
    expect(reader.url).toBe("/n/reader-topic/10");
    expect(reader.posts[0]?.url).toBe("/n/reader-topic/10/1");
    expect(reader.postStream).toEqual([100, 101, 102, 103]);
    expect(reader.loadedPostIds).toEqual([100, 101, 102]);
    expect(reader.hasMorePosts).toBe(true);
    expect(reader.actions).toEqual({ canReply: true, draftKey: "topic_10", draftSequence: 3 });
    expect(reader.posts.find((post) => post.postNumber === 1)?.actions.bookmarked).toBe(true);
    expect(reader.posts.find((post) => post.postNumber === 2)?.actions.liked).toBe(true);
    expect(reader.posts.find((post) => post.postNumber === 2)?.actions.canLike).toBe(true);
    expect(reader.opAuthor?.username).toBe("alice");
    expect(reader.posts.find((post) => post.postNumber === 3)?.isOriginalPoster).toBe(true);
    expect(reader.tree).toHaveLength(1);
    expect(reader.tree[0]?.post.postNumber).toBe(2);
    expect(reader.tree[0]?.children[0]?.post.postNumber).toBe(3);
    expect(reader.tree[0]?.children[0]?.depth).toBe(1);
  });

  it("loads a reader payload around a submitted post number without using the reader cache", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(morePayload));

    const reader = await fetchTopicReaderAtPost(topic, 4);

    expect(fetchMock).toHaveBeenCalledWith(
      "/t/reader-topic/10/4.json",
      expect.objectContaining({ credentials: "include" })
    );
    expect(reader.posts.map((post) => post.postNumber)).toContain(4);
  });

  it("loads missing posts in batches, deduplicates, sorts, and rebuilds the reply tree", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(initialPayload));
    const reader = await fetchTopicReader(topic, undefined, { skipCache: true });
    fetchMock.mockResolvedValueOnce(jsonResponse(morePayload));

    const merged = await fetchMoreReaderPosts(reader, 20);

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/t/10/posts.json?post_ids%5B%5D=103",
      expect.objectContaining({ credentials: "include" })
    );
    expect(merged.posts.map((post) => post.postNumber)).toEqual([1, 2, 3, 4]);
    expect(merged.loadedPostIds).toEqual([100, 101, 102, 103]);
    expect(merged.hasMorePosts).toBe(false);
    expect(merged.tree[0]?.post.postNumber).toBe(2);
    expect(merged.tree[0]?.children[0]?.post.postNumber).toBe(3);
    expect(merged.tree[0]?.children[0]?.children[0]?.post.postNumber).toBe(4);
    expect(merged.tree[0]?.children[0]?.children[0]?.depth).toBe(2);
    expect(merged.posts.find((post) => post.postNumber === 4)?.actions.canReply).toBe(true);
  });

  it("remembers locally confirmed native action state in the reader cache", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(initialPayload));
    const reader = await fetchTopicReader(topic, undefined, { skipCache: true });
    const updated = {
      ...reader,
      posts: reader.posts.map((post) =>
        post.postNumber === 1
          ? {
              ...post,
              actions: {
                ...post.actions,
                liked: true,
                bookmarked: true
              }
            }
          : post
      )
    };

    rememberCachedTopicReader(updated);

    const cached = getCachedTopicReader(reader.id);
    expect(cached?.posts.find((post) => post.postNumber === 1)?.actions.liked).toBe(true);
    expect(cached?.posts.find((post) => post.postNumber === 1)?.actions.bookmarked).toBe(true);
  });

  it("builds Discourse read timing payloads for loaded reader posts only", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(initialPayload));
    const reader = await fetchTopicReader(topic, undefined, { skipCache: true });

    expect(readerReadTimingPayload(reader, new Set([1, 3]))).toEqual({
      topic_id: 10,
      topic_time: 2000,
      timings: {
        "1": 1000,
        "3": 1000
      }
    });
  });

  it("posts Discourse read timings with the page csrf token", async () => {
    document.head.innerHTML = `<meta name="csrf-token" content="csrf-123">`;
    fetchMock.mockResolvedValueOnce(jsonResponse(initialPayload));
    const reader = await fetchTopicReader(topic, undefined, { skipCache: true });
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    const synced = await syncTopicReadTimings(reader, { postNumbers: new Set([1, 2]) });

    expect(synced).toBe("synced");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/t/10/timings",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-CSRF-Token": "csrf-123"
        }),
        body: JSON.stringify({
          topic_id: 10,
          topic_time: 2000,
          timings: {
            "1": 1000,
            "2": 1000
          }
        })
      })
    );
  });

  it("skips Discourse read timings when no csrf token is available", async () => {
    document.head.innerHTML = "";
    fetchMock.mockResolvedValueOnce(jsonResponse(initialPayload));
    const reader = await fetchTopicReader(topic, undefined, { skipCache: true });
    fetchMock.mockResolvedValueOnce(new Response("", { status: 403 }));

    const result = await syncTopicReadTimings(reader, { postNumbers: new Set([1]) });

    expect(result).toBe("skipped");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/session/csrf.json");
  });

  it("skips Discourse read timings for auth failures from the timings endpoint", async () => {
    document.head.innerHTML = `<meta name="csrf-token" content="csrf-123">`;
    fetchMock.mockResolvedValueOnce(jsonResponse(initialPayload));
    const reader = await fetchTopicReader(topic, undefined, { skipCache: true });
    fetchMock.mockResolvedValueOnce(new Response("", { status: 403 }));

    const result = await syncTopicReadTimings(reader, { postNumbers: new Set([1]) });

    expect(result).toBe("skipped");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/t/10/timings",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("votes in a Discourse poll with the page csrf token", async () => {
    document.head.innerHTML = `<meta name="csrf-token" content="csrf-456">`;
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        poll: {
          id: 1,
          name: "poll",
          voters: 3,
          options: [
            { id: "option-a", html: "选项 A", votes: 2 },
            { id: "option-b", html: "选项 B", votes: 1 }
          ]
        },
        vote: ["option-a"]
      })
    );

    const result = await voteReaderPoll({ postId: 123, pollName: "poll", optionIds: ["option-a"] });

    expect(result).toEqual({
      ok: true,
      selectedOptionIds: ["option-a"],
      poll: {
        name: "poll",
        voters: 3,
        options: [
          { id: "option-a", label: "选项 A", votes: 2 },
          { id: "option-b", label: "选项 B", votes: 1 }
        ]
      }
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/polls/vote",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-CSRF-Token": "csrf-456"
        }),
        body: JSON.stringify({
          post_id: 123,
          poll_name: "poll",
          options: ["option-a"]
        })
      })
    );
  });
});
