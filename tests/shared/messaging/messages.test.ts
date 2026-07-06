import { describe, expect, it } from "vitest";
import { RuntimeMessage, SidePanelContentMessage } from "../../../src/shared/messaging/messages";

describe("runtime messages", () => {
  it("accepts background tab open requests for validated callers", () => {
    expect(
      RuntimeMessage.safeParse({
        type: "tab.open",
        url: "https://linux.do/t/topic/2283663/12",
        active: false
      }).success
    ).toBe(true);
  });

  it("rejects non-URL tab open payloads", () => {
    expect(
      RuntimeMessage.safeParse({
        type: "tab.open",
        url: "/t/topic/2283663/12"
      }).success
    ).toBe(false);
  });

  it("accepts reply activity records for the side panel activity feed", () => {
    expect(
      RuntimeMessage.safeParse({
        type: "reply.activity.record",
        activity: {
          id: "reply:10:4",
          topicId: 10,
          topicTitle: "Reader topic",
          topicUrl: "https://linux.do/t/reader-topic/10",
          targetPostNumber: 2,
          submittedPostNumber: 4,
          submittedUrl: "https://linux.do/t/reader-topic/10/4",
          status: "synced",
          message: "回复已同步到 Reader。",
          createdAt: "2026-06-04T00:00:00.000Z"
        }
      }).success
    ).toBe(true);
  });

  it("accepts side panel search requests for Linux.do content tabs", () => {
    expect(
      SidePanelContentMessage.safeParse({
        type: "ldcv.searchTopics",
        query: "reader mode",
        page: 2
      }).success
    ).toBe(true);
  });

  it("accepts side panel topic-open requests with normalized topic payloads", () => {
    expect(
      SidePanelContentMessage.safeParse({
        type: "ldcv.openTopic",
        topicId: 10,
        topic: {
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
        }
      }).success
    ).toBe(true);
  });

  it("rejects malformed side panel search messages", () => {
    expect(
      SidePanelContentMessage.safeParse({
        type: "ldcv.searchTopics",
        query: "",
        page: 0
      }).success
    ).toBe(false);
  });
});
