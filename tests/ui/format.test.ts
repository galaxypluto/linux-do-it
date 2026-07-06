import { afterEach, describe, expect, it, vi } from "vitest";
import { formatPublishTime } from "../../src/ui/format";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatPublishTime", () => {
  it("treats same timezone calendar day as today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T07:00:00Z"));

    expect(formatPublishTime("2026-06-17T16:30:00Z", { timeZone: "Asia/Shanghai" })).toBe("今天发布");
  });

  it("follows the supplied timezone boundary for relative publish labels", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T07:00:00Z"));

    const iso = "2026-06-17T16:30:00Z";
    expect(formatPublishTime(iso, { timeZone: "UTC" })).toBe("1天前发布");
    expect(formatPublishTime(iso, { timeZone: "Asia/Shanghai" })).toBe("今天发布");
  });

  it("uses the timezone-local calendar date for older absolute publish labels", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T07:00:00Z"));

    const iso = "2026-06-09T16:30:00Z";
    expect(formatPublishTime(iso, { timeZone: "UTC" })).toBe("2026-06-09 发布");
    expect(formatPublishTime(iso, { timeZone: "Asia/Shanghai" })).toBe("2026-06-10 发布");
  });

  it("returns an empty string for invalid publish timestamps", () => {
    expect(formatPublishTime("")).toBe("");
    expect(formatPublishTime("not-a-date")).toBe("");
  });
});
