import { describe, expect, it, vi } from "vitest";
import type { TopicCardData, TopicListData } from "../../src/discourse/types";
import {
  detectNewTopics,
  loadViewedTopicIds,
  mergeViewedTopicIds,
  mergeViewedTopicIdsStorage,
  mergeAppend,
  mergeLatest,
  mergePendingLatest,
  mergePendingTopicMap,
  newestTopicCreatedAtMs,
  persistViewedTopicIds,
  topicCreatedAtMs,
  loadViewedTopicIdsAsync,
  persistViewedTopicIdsAsync,
  viewedTopicIdsEqual,
  VIEWED_TOPICS_STORAGE_KEY
} from "../../src/content/topicListState";

function topic(id: number, createdAt = `2026-05-${String(id).padStart(2, "0")}T00:00:00.000Z`): TopicCardData {
  return {
    id,
    title: `Topic ${id}`,
    url: `/t/topic-${id}/${id}`,
    slug: `topic-${id}`,
    excerpt: "",
    thumbnailUrl: "",
    tags: [],
    stats: {
      replies: 0,
      views: 0,
      likes: 0,
      score: 0
    },
    dates: {
      createdAt,
      activityAt: createdAt
    },
    flags: {
      pinned: false,
      closed: false,
      archived: false,
      bookmarked: false,
      unseen: false
    },
    posters: []
  };
}

function list(ids: number[], endpoint = "/latest.json", moreTopicsUrl = ""): TopicListData {
  return {
    endpoint,
    topics: ids.map((id) => topic(id)),
    moreTopicsUrl
  };
}

function storage(raw: string | null, failSet = false): Pick<Storage, "getItem" | "setItem"> {
  let value = raw;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      if (failSet) {
        throw new Error("storage unavailable");
      }
      value = next;
    }
  };
}

describe("topic list merging", () => {
  it("prepends latest topics and preserves existing non-duplicates", () => {
    const merged = mergeLatest(list([1, 2], "/latest.json", "/latest?page=2"), list([3, 1], "/latest.json"));

    expect(merged.topics.map((item) => item.id)).toEqual([3, 1, 2]);
    expect(merged.moreTopicsUrl).toBe("/latest?page=2");
  });

  it("appends more pages while de-duplicating by topic id", () => {
    const merged = mergeAppend(list([1, 2], "/latest.json", "/latest?page=2"), list([2, 3], "/latest.json", "/latest?page=3"));

    expect(merged.topics.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(merged.topics[1].title).toBe("Topic 2");
    expect(merged.moreTopicsUrl).toBe("/latest?page=3");
  });

  it("applies pending topics ahead of latest and existing topics", () => {
    const merged = mergePendingLatest(
      list([1, 2, 3], "/latest.json", "/latest?page=2"),
      [topic(5), topic(4)],
      list([4, 3, 6], "/latest.json", "/latest?page=latest")
    );

    expect(merged.topics.map((item) => item.id)).toEqual([5, 4, 3, 6, 1, 2]);
    expect(merged.moreTopicsUrl).toBe("/latest?page=2");
  });
});

describe("new topic detection", () => {
  it("detects only unseen topics created after the baseline", () => {
    const baseline = Date.parse("2026-05-03T00:00:00.000Z");
    const pending = new Map([[4, topic(4)]]);
    const detected = detectNewTopics(
      list([1, 2]),
      {
        endpoint: "/latest.json",
        topics: [topic(1), topic(3, "2026-05-02T00:00:00.000Z"), topic(4), topic(5)],
        moreTopicsUrl: ""
      },
      pending,
      baseline
    );

    expect(detected.map((item) => item.id)).toEqual([5]);
  });

  it("merges fresh pending topics before older pending topics", () => {
    const merged = mergePendingTopicMap(new Map([[1, topic(1)], [2, topic(2)]]), [topic(3), topic(1)]);

    expect(Array.from(merged.keys())).toEqual([3, 1, 2]);
  });

  it("parses topic creation times and finds the newest valid time", () => {
    expect(topicCreatedAtMs(topic(1, "bad-date"))).toBe(0);
    expect(newestTopicCreatedAtMs([topic(1, "bad-date"), topic(2, "2026-05-10T00:00:00.000Z")])).toBe(
      Date.parse("2026-05-10T00:00:00.000Z")
    );
  });
});

describe("viewed topic storage", () => {
  it("loads valid positive numeric ids and keeps the newest bounded slice", () => {
    expect(Array.from(loadViewedTopicIds(storage(JSON.stringify([0, "2", -1, 3, "bad", 4])), "key", 2))).toEqual([
      3,
      4
    ]);
    expect(loadViewedTopicIds(storage("not json"), "key")).toEqual(new Set());
  });

  it("persists a bounded id set and returns the normalized set even if storage write fails", () => {
    const readable = storage(null);
    const normalized = persistViewedTopicIds(readable, new Set([1, 2, 3]), "key", 2);
    const failed = persistViewedTopicIds(storage(null, true), new Set([1, 2, 3]), "key", 2);

    expect(Array.from(normalized)).toEqual([2, 3]);
    expect(Array.from(loadViewedTopicIds(readable, "key"))).toEqual([2, 3]);
    expect(Array.from(failed)).toEqual([2, 3]);
  });

  it("async loads and persists via chrome.storage.local", async () => {
    let mockData: Record<string, any> = {};
    const mockGet = vi.fn(async (key: string) => ({ [key]: mockData[key] }));
    const mockSet = vi.fn(async (obj: Record<string, any>) => {
      mockData = { ...mockData, ...obj };
    });
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: mockGet,
          set: mockSet
        }
      }
    });

    const emptySet = await loadViewedTopicIdsAsync("test_key");
    expect(emptySet).toEqual(new Set());

    const normalized = await persistViewedTopicIdsAsync(new Set([1, 2, 3]), "test_key", 2);
    expect(Array.from(normalized)).toEqual([2, 3]);
    expect(mockSet).toHaveBeenCalledWith({ test_key: [2, 3] });

    const loaded = await loadViewedTopicIdsAsync("test_key");
    expect(Array.from(loaded)).toEqual([2, 3]);

    vi.unstubAllGlobals();
  });

  it("async falls back to sessionStorage on error or missing chrome", async () => {
    vi.stubGlobal("chrome", undefined);
    window.sessionStorage.removeItem("test_fallback_key");

    const emptySet = await loadViewedTopicIdsAsync("test_fallback_key");
    expect(emptySet).toEqual(new Set());

    const normalized = await persistViewedTopicIdsAsync(new Set([1, 2, 3]), "test_fallback_key", 2);
    expect(Array.from(normalized)).toEqual([2, 3]);
    expect(JSON.parse(window.sessionStorage.getItem("test_fallback_key") || "[]")).toEqual([2, 3]);

    const loaded = await loadViewedTopicIdsAsync("test_fallback_key");
    expect(Array.from(loaded)).toEqual([2, 3]);

    window.sessionStorage.removeItem("test_fallback_key");
    vi.unstubAllGlobals();
  });

  it("merges incoming ids into an existing set while preserving newest bounded order", () => {
    expect(Array.from(mergeViewedTopicIds(new Set([1, 2]), [2, 3, 4], 3))).toEqual([2, 3, 4]);
  });

  it("compares viewed topic sets structurally", () => {
    expect(viewedTopicIdsEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    expect(viewedTopicIdsEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false);
  });

  it("atomically merges ids into chrome.storage.local without duplicating existing values", async () => {
    let mockData: Record<string, any> = {
      merge_key: [1, 2]
    };
    const mockGet = vi.fn(async (key: string) => ({ [key]: mockData[key] }));
    const mockSet = vi.fn(async (obj: Record<string, any>) => {
      mockData = { ...mockData, ...obj };
    });
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: mockGet,
          set: mockSet
        }
      }
    });

    const merged = await mergeViewedTopicIdsStorage([2, 3, 4], "merge_key", 3);
    expect(Array.from(merged)).toEqual([2, 3, 4]);
    expect(mockSet).toHaveBeenCalledWith({ merge_key: [2, 3, 4] });

    mockSet.mockClear();
    const unchanged = await mergeViewedTopicIdsStorage([2, 3, 4], "merge_key", 3);
    expect(Array.from(unchanged)).toEqual([2, 3, 4]);
    expect(mockSet).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("retries against a concurrent overwrite until storage converges on the merged ids", async () => {
    let mockData: Record<string, any> = {
      merge_key: [1]
    };
    let setCalls = 0;
    const mockGet = vi.fn(async (key: string) => ({ [key]: mockData[key] }));
    const mockSet = vi.fn(async (obj: Record<string, any>) => {
      setCalls += 1;
      if (setCalls === 1) {
        mockData = { ...mockData, merge_key: [1, 3] };
        return;
      }
      mockData = { ...mockData, ...obj };
    });
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: mockGet,
          set: mockSet
        }
      }
    });

    const merged = await mergeViewedTopicIdsStorage([2], "merge_key", 10);

    expect(Array.from(merged)).toEqual([1, 3, 2]);
    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockData.merge_key).toEqual([1, 3, 2]);

    vi.unstubAllGlobals();
  });
});
