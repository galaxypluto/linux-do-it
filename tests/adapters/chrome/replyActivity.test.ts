import { afterEach, describe, expect, it, vi } from "vitest";
import { recordReplyActivity } from "../../../src/adapters/chrome/replyActivity";

describe("chrome reply activity adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records reply activities through the runtime background message", async () => {
    const sendMessage = vi.fn((_message: unknown, callback: (response: { ok: boolean }) => void) => {
      callback({ ok: true });
    });
    vi.stubGlobal("chrome", {
      runtime: {
        lastError: undefined,
        sendMessage
      }
    });

    await expect(
      recordReplyActivity({
        id: "reply:10:4",
        topicId: 10,
        topicTitle: "Reader topic",
        topicUrl: "https://linux.do/t/reader-topic/10",
        targetPostNumber: 2,
        submittedPostNumber: 4,
        submittedUrl: "https://linux.do/t/reader-topic/10/4",
        status: "syncing",
        message: "回复已发送，正在同步到 Reader。",
        createdAt: "2026-06-04T00:00:00.000Z"
      })
    ).resolves.toBe(true);

    expect(sendMessage).toHaveBeenCalledWith(
      {
        type: "reply.activity.record",
        activity: {
          id: "reply:10:4",
          topicId: 10,
          topicTitle: "Reader topic",
          topicUrl: "https://linux.do/t/reader-topic/10",
          targetPostNumber: 2,
          submittedPostNumber: 4,
          submittedUrl: "https://linux.do/t/reader-topic/10/4",
          status: "syncing",
          message: "回复已发送，正在同步到 Reader。",
          createdAt: "2026-06-04T00:00:00.000Z"
        }
      },
      expect.any(Function)
    );
  });
});
