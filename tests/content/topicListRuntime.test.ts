import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TopicCardData, TopicListData } from "../../src/discourse/types";
import { TopicListRuntime } from "../../src/content/topicListRuntime";
import type { TopicListNavigationRequest } from "../../src/content/newTopicApplyFlow";
import { DEFAULT_SETTINGS } from "../../src/storage/settings";

const fetchCurrentTopicList = vi.hoisted(() => vi.fn<() => Promise<TopicListData>>());

vi.mock("../../src/discourse/api", () => ({
  endpointFromMoreTopicsUrl: vi.fn(),
  fetchCurrentTopicList: vi.fn(),
  fetchTopicList: vi.fn(),
}));

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

describe("TopicListRuntime apply flow", () => {
  beforeEach(async () => {
    const api = await import("../../src/discourse/api");
    vi.mocked(api.fetchCurrentTopicList).mockReset();
    vi.mocked(api.fetchCurrentTopicList).mockImplementation(fetchCurrentTopicList);
    fetchCurrentTopicList.mockReset();
  });

  it("does not restore page anchor during the delayed reader-layout reveal after applying new topics", async () => {
    vi.useFakeTimers();
    try {
      const renderCurrent = vi.fn();
      const runtime = new TopicListRuntime({
        getSettings: () => ({
          ...DEFAULT_SETTINGS,
          layout: "reader",
        }),
        setCardMode: vi.fn(),
        renderCurrent,
        setLoadMoreLoadingState: vi.fn(),
        onResetReader: vi.fn(),
        onBeforeApplyPendingRefresh: vi.fn(),
        onPendingNoticeRootCleared: vi.fn(),
        onScheduleNavigation: vi.fn(),
        isModalReaderOverlayActive: () => false,
        canPollLatest: () => true,
      });

      fetchCurrentTopicList
        .mockResolvedValueOnce(list([1, 2, 3, 4, 5, 6, 7, 8], "/latest?page=2"))
        .mockResolvedValueOnce(list([9, 1, 2, 3, 4, 5, 6, 7, 8], "/latest?page=latest"));

      await runtime.refreshData({ reset: true });
      renderCurrent.mockClear();

      await runtime.pollLatest();
      runtime.applyPendingRefresh();

      vi.advanceTimersByTime(920);

      expect(renderCurrent).toHaveBeenCalledWith({ loading: false, error: "" });
      expect(renderCurrent).toHaveBeenCalledWith({
        loading: false,
        error: "",
        preservePageAnchor: false,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("emits a page-top navigation request and keeps reader-layout cards out of entering state", async () => {
    const renderCurrent = vi.fn();
    const onScheduleNavigation = vi.fn<(request: TopicListNavigationRequest) => void>();
    const runtime = new TopicListRuntime({
      getSettings: () => ({
        ...DEFAULT_SETTINGS,
        layout: "reader",
      }),
      setCardMode: vi.fn(),
      renderCurrent,
      setLoadMoreLoadingState: vi.fn(),
      onResetReader: vi.fn(),
      onBeforeApplyPendingRefresh: vi.fn(),
      onPendingNoticeRootCleared: vi.fn(),
      onScheduleNavigation,
      isModalReaderOverlayActive: () => false,
      canPollLatest: () => true,
    });

    fetchCurrentTopicList
      .mockResolvedValueOnce(list([1, 2], "/latest?page=2"))
      .mockResolvedValueOnce(list([3, 1, 2], "/latest?page=latest"));

    await runtime.refreshData({ reset: true });
    await runtime.pollLatest();

    expect(runtime.snapshot.pendingNewTopicCount).toBe(1);

    runtime.applyPendingRefresh();

    expect(onScheduleNavigation).toHaveBeenCalledWith({
      kind: "page-top",
      durationMs: 760,
    });
    expect(runtime.snapshot.data?.topics.map((item) => item.id)).toEqual([3, 1, 2]);
    expect(Array.from(runtime.snapshot.newTopicIds)).toEqual([3]);
    expect(runtime.snapshot.enteringTopicIds.size).toBe(0);

    runtime.acknowledgeRender();
    expect(Array.from(runtime.snapshot.newTopicIds)).toEqual([3]);
    expect(runtime.snapshot.enteringTopicIds.size).toBe(0);
  });

  it("clears stable new markers when the applied topic is opened", async () => {
    const runtime = new TopicListRuntime({
      getSettings: () => ({
        ...DEFAULT_SETTINGS,
        layout: "grid",
      }),
      setCardMode: vi.fn(),
      renderCurrent: vi.fn(),
      setLoadMoreLoadingState: vi.fn(),
      onResetReader: vi.fn(),
      onBeforeApplyPendingRefresh: vi.fn(),
      onPendingNoticeRootCleared: vi.fn(),
      onScheduleNavigation: vi.fn(),
      isModalReaderOverlayActive: () => false,
      canPollLatest: () => true,
    });

    fetchCurrentTopicList
      .mockResolvedValueOnce(list([1, 2], "/latest?page=2"))
      .mockResolvedValueOnce(list([3, 1, 2], "/latest?page=latest"));

    await runtime.refreshData({ reset: true });
    await runtime.pollLatest();
    runtime.applyPendingRefresh();

    expect(Array.from(runtime.snapshot.newTopicIds)).toEqual([3]);
    expect(Array.from(runtime.snapshot.enteringTopicIds)).toEqual([3]);

    runtime.prepareTopicOpen(3);

    expect(runtime.snapshot.newTopicIds.size).toBe(0);
    expect(runtime.snapshot.enteringTopicIds.size).toBe(0);
  });
});
