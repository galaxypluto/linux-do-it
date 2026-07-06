import { afterEach, describe, expect, it, vi } from "vitest";
import { openLinuxDoTopicTab } from "../../../src/adapters/chrome/tabs";

describe("chrome tabs adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens Linux.do topic URLs through the runtime background message", async () => {
    const sendMessage = vi.fn((_message: unknown, callback: (response: { ok: boolean }) => void) => {
      callback({ ok: true });
    });
    vi.stubGlobal("chrome", {
      runtime: {
        lastError: undefined,
        sendMessage
      }
    });

    await expect(openLinuxDoTopicTab("https://linux.do/n/topic/2283663/12")).resolves.toBe(true);

    expect(sendMessage).toHaveBeenCalledWith(
      {
        type: "tab.open",
        url: "https://linux.do/n/topic/2283663/12",
        active: false
      },
      expect.any(Function)
    );
  });

  it("rejects non Linux.do topic URLs before contacting the extension runtime", async () => {
    const sendMessage = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: {
        lastError: undefined,
        sendMessage
      }
    });

    await expect(openLinuxDoTopicTab("https://example.com/t/topic/1")).resolves.toBe(false);

    expect(sendMessage).not.toHaveBeenCalled();
  });
});
