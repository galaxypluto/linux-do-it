import { describe, expect, it } from "vitest";
import type { TopicCardData, TopicListData } from "../../src/discourse/types";
import {
  acknowledgeTopicEntering,
  buildApplyPendingRefreshResult,
  clearTopicFromVisualState,
  createAppliedPendingTopicVisualState,
  createEmptyTopicListVisualState,
  TOPIC_UPDATE_NAVIGATION_DURATION_MS,
  TOPIC_UPDATE_REVEAL_DELAY_MS,
  withEnteringTopicIds,
} from "../../src/content/newTopicApplyFlow";

function topic(id: number): TopicCardData {
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
      score: 0,
    },
    dates: {
      createdAt: `2026-05-${String(id).padStart(2, "0")}T00:00:00.000Z`,
      activityAt: `2026-05-${String(id).padStart(2, "0")}T00:00:00.000Z`,
    },
    flags: {
      pinned: false,
      closed: false,
      archived: false,
      bookmarked: false,
      unseen: false,
    },
    posters: [],
  };
}

function list(ids: number[], moreTopicsUrl = ""): TopicListData {
  return {
    endpoint: "/latest.json",
    topics: ids.map((id) => topic(id)),
    moreTopicsUrl,
  };
}

describe("new topic apply flow", () => {
  it("returns grid visual state with stable new markers and one-shot entering ids", () => {
    const visualState = createAppliedPendingTopicVisualState([topic(5), topic(4)], "grid");

    expect(Array.from(visualState.newTopicIds)).toEqual([5, 4]);
    expect(Array.from(visualState.enteringTopicIds)).toEqual([5, 4]);
  });

  it("suppresses entering animation for reader layout while preserving new markers", () => {
    const visualState = createAppliedPendingTopicVisualState([topic(5), topic(4)], "reader");

    expect(Array.from(visualState.newTopicIds)).toEqual([5, 4]);
    expect(visualState.enteringTopicIds.size).toBe(0);
  });

  it("builds an apply result that navigates to absolute page top", () => {
    const result = buildApplyPendingRefreshResult({
      currentData: list([1, 2, 3], "/latest?page=2"),
      latestData: list([4, 3, 6], "/latest?page=latest"),
      pendingTopics: [topic(5), topic(4)],
      layout: "grid",
    });

    expect(result).not.toBeNull();
    expect(result?.data.topics.map((item) => item.id)).toEqual([5, 4, 3, 6, 1, 2]);
    expect(result?.lastUpdatedAt).toBe("已更新 2 个新话题");
    expect(result?.revealDelayMs).toBe(TOPIC_UPDATE_REVEAL_DELAY_MS);
    expect(result?.navigation).toEqual({
      kind: "page-top",
      durationMs: TOPIC_UPDATE_NAVIGATION_DURATION_MS,
    });
  });

  it("does not request navigation when there are no pending topics to apply", () => {
    const result = buildApplyPendingRefreshResult({
      currentData: list([1, 2, 3], "/latest?page=2"),
      latestData: list([4, 3, 6], "/latest?page=latest"),
      pendingTopics: [],
      layout: "grid",
    });

    expect(result?.navigation).toBeNull();
    expect(result?.lastUpdatedAt).toBe("刚刚更新");
  });
});

describe("topic visual state helpers", () => {
  it("creates and acknowledges entering state without clearing stable new markers", () => {
    const empty = createEmptyTopicListVisualState();
    const withEntering = withEnteringTopicIds(
      {
        newTopicIds: new Set([9]),
        enteringTopicIds: empty.enteringTopicIds,
      },
      [9, 10],
    );

    expect(Array.from(withEntering.newTopicIds)).toEqual([9]);
    expect(Array.from(withEntering.enteringTopicIds)).toEqual([9, 10]);

    const acknowledged = acknowledgeTopicEntering(withEntering);
    expect(Array.from(acknowledged.newTopicIds)).toEqual([9]);
    expect(acknowledged.enteringTopicIds.size).toBe(0);
  });

  it("clears a topic from both marker and entering state", () => {
    const cleared = clearTopicFromVisualState(
      {
        newTopicIds: new Set([9, 10]),
        enteringTopicIds: new Set([10]),
      },
      10,
    );

    expect(Array.from(cleared.newTopicIds)).toEqual([9]);
    expect(cleared.enteringTopicIds.size).toBe(0);
  });
});
