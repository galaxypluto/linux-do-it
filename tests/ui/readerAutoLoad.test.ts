import { describe, expect, it } from "vitest";
import {
  READER_AUTO_LOAD_BOTTOM_THRESHOLD_PX,
  READER_AUTO_LOAD_COOLDOWN_MS,
  isReaderScrollNearBottom,
  shouldTriggerReaderAutoLoad,
} from "../../src/ui/readerAutoLoad";

describe("readerAutoLoad", () => {
  it("detects near-bottom scroll positions", () => {
    expect(isReaderScrollNearBottom(1_000, 880, 100)).toBe(true);
    expect(isReaderScrollNearBottom(1_000, 700, 100)).toBe(false);
    expect(isReaderScrollNearBottom(1_000, 800, 100, 50)).toBe(false);
  });

  it("requires user scroll, bottom proximity, and cooldown before auto load", () => {
    const base = {
      scrollHeight: 1_000,
      scrollTop: 900,
      clientHeight: 100,
      hasScrolled: true,
      loadingMore: false,
      lastTriggeredAt: 0,
      now: 10_000,
      cooldownMs: READER_AUTO_LOAD_COOLDOWN_MS,
      bottomThresholdPx: READER_AUTO_LOAD_BOTTOM_THRESHOLD_PX,
    };

    expect(shouldTriggerReaderAutoLoad(base)).toBe(true);
    expect(shouldTriggerReaderAutoLoad({ ...base, hasScrolled: false })).toBe(false);
    expect(shouldTriggerReaderAutoLoad({ ...base, loadingMore: true })).toBe(false);
    expect(shouldTriggerReaderAutoLoad({ ...base, scrollTop: 100 })).toBe(false);
    expect(
      shouldTriggerReaderAutoLoad({
        ...base,
        lastTriggeredAt: 9_000,
        now: 10_000,
      }),
    ).toBe(false);
    expect(
      shouldTriggerReaderAutoLoad({
        ...base,
        lastTriggeredAt: 7_000,
        now: 10_000,
      }),
    ).toBe(true);
  });
});
