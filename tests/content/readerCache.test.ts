import { describe, expect, it } from "vitest";
import { ReaderMemoryCache } from "../../src/content/readerCache";
import type { TopicReaderData } from "../../src/discourse/types";

function reader(id: number): TopicReaderData {
  return {
    id,
    title: `Topic ${id}`,
    url: `/t/topic/${id}`,
    slug: `topic-${id}`,
    stats: {
      posts: 1,
      views: 0,
      likes: 0
    },
    actions: {
      canReply: true,
      draftKey: "topic_1",
      draftSequence: 0
    },
    tags: [],
    opAuthor: null,
    posts: [],
    tree: [],
    postStream: [],
    loadedPostIds: [],
    hasMorePosts: false
  };
}

describe("ReaderMemoryCache", () => {
  it("returns remembered reader data before ttl expiry", () => {
    let now = 1000;
    const cache = new ReaderMemoryCache({ ttlMs: 500, now: () => now });

    cache.remember(reader(1));
    now = 1400;

    expect(cache.get(1)?.id).toBe(1);
    expect(cache.size()).toBe(1);
  });

  it("expires stale entries and does not return them", () => {
    let now = 1000;
    const cache = new ReaderMemoryCache({ ttlMs: 500, now: () => now });

    cache.remember(reader(1));
    now = 1601;

    expect(cache.get(1)).toBeNull();
    expect(cache.size()).toBe(0);
  });

  it("refreshes recency on get and evicts the oldest entry over capacity", () => {
    const cache = new ReaderMemoryCache({ maxEntries: 2 });

    cache.remember(reader(1));
    cache.remember(reader(2));
    expect(cache.get(1)?.id).toBe(1);
    cache.remember(reader(3));

    expect(cache.ids()).toEqual([1, 3]);
    expect(cache.get(2)).toBeNull();
  });

  it("updates existing topic entries without increasing cache size", () => {
    const cache = new ReaderMemoryCache({ maxEntries: 2 });
    const updated = { ...reader(1), title: "Updated" };

    cache.remember(reader(1));
    cache.remember(updated);

    expect(cache.size()).toBe(1);
    expect(cache.get(1)?.title).toBe("Updated");
  });
});
