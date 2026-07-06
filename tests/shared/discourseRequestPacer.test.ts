import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DISCOURSE_REQUEST_MIN_INTERVAL_MS,
  paceDiscourseRequest,
  resetDiscourseRequestPacerForTests,
} from "../../src/shared/discourseRequestPacer";

describe("discourseRequestPacer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDiscourseRequestPacerForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetDiscourseRequestPacerForTests();
  });

  it("spaces consecutive discourse requests", async () => {
    const first = paceDiscourseRequest(1_000);
    await vi.runAllTimersAsync();
    await first;

    const second = paceDiscourseRequest(1_000);
    await vi.advanceTimersByTimeAsync(999);
    let secondDone = false;
    void second.then(() => {
      secondDone = true;
    });
    await Promise.resolve();
    expect(secondDone).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await second;
    expect(secondDone).toBe(true);
  });

  it("uses a shared default interval constant", () => {
    expect(DISCOURSE_REQUEST_MIN_INTERVAL_MS).toBeGreaterThanOrEqual(1_000);
  });
});
