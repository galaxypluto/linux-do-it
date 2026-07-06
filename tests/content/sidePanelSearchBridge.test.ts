import { describe, expect, it, vi } from "vitest";
import { createSidePanelSearchBridge, fetchLinuxDoSearchJson } from "../../src/content/sidePanelSearchBridge";
import type { TopicCardData } from "../../src/domain/linuxdo/types";

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
  posters: []
};

describe("side panel search bridge", () => {
  it("returns a structured error for invalid messages", () => {
    const sendResponse = vi.fn();
    const listener = createSidePanelSearchBridge({
      searchTopics: vi.fn(),
      openTopic: vi.fn()
    });

    const asyncResponse = listener({ type: "unknown" }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(asyncResponse).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: "Invalid sidepanel message" });
  });

  it("searches topics and responds asynchronously", async () => {
    const sendResponse = vi.fn();
    const searchTopics = vi.fn().mockResolvedValue({ topics: [{ id: 10 }] });
    const listener = createSidePanelSearchBridge({
      searchTopics,
      openTopic: vi.fn()
    });

    const asyncResponse = listener(
      { type: "ldcv.searchTopics", query: "reader", page: 3 },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );
    await Promise.resolve();

    expect(asyncResponse).toBe(true);
    expect(searchTopics).toHaveBeenCalledWith("reader", 3);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: { topics: [{ id: 10 }] } });
  });

  it("rejects mismatched topic-open payloads", () => {
    const sendResponse = vi.fn();
    const openTopic = vi.fn();
    const listener = createSidePanelSearchBridge({
      searchTopics: vi.fn(),
      openTopic
    });

    const asyncResponse = listener(
      { type: "ldcv.openTopic", topicId: 11, topic },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(asyncResponse).toBe(false);
    expect(openTopic).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: "Topic payload id mismatch" });
  });

  it("opens validated topics", async () => {
    const sendResponse = vi.fn();
    const openTopic = vi.fn().mockResolvedValue(undefined);
    const listener = createSidePanelSearchBridge({
      searchTopics: vi.fn(),
      openTopic
    });

    const asyncResponse = listener(
      { type: "ldcv.openTopic", topicId: 10, topic },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );
    await Promise.resolve();

    expect(asyncResponse).toBe(true);
    expect(openTopic).toHaveBeenCalledWith(10, topic);
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });

  it("returns structured errors when topic open fails", async () => {
    const sendResponse = vi.fn();
    const openTopic = vi.fn().mockRejectedValue(new Error("Unable to open Reader on this page"));
    const listener = createSidePanelSearchBridge({
      searchTopics: vi.fn(),
      openTopic
    });

    const asyncResponse = listener(
      { type: "ldcv.openTopic", topicId: 10, topic },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(asyncResponse).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: "Unable to open Reader on this page" });
  });
});

describe("fetchLinuxDoSearchJson", () => {
  it("requests the Discourse search endpoint with included credentials", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ topics: [] })
    });

    await expect(fetchLinuxDoSearchJson("reader mode", 2, fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      topics: []
    });

    expect(fetchImpl).toHaveBeenCalledWith("/search.json?q=reader+mode&page=2", {
      credentials: "include",
      headers: {
        Accept: "application/json"
      }
    });
  });
});
