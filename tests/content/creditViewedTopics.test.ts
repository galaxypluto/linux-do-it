import { describe, expect, it } from "vitest";
import {
  shouldScheduleCreditTopicView,
  trimCreditViewedTopicIdSets,
} from "../../src/content/creditViewedTopics";

describe("creditViewedTopics", () => {
  it("schedules credit tracking only for topics not yet credit-viewed", () => {
    const viewed = new Set([1, 2]);

    expect(shouldScheduleCreditTopicView(1, viewed)).toBe(false);
    expect(shouldScheduleCreditTopicView(3, viewed)).toBe(true);
    expect(shouldScheduleCreditTopicView(Number.NaN, viewed)).toBe(false);
  });

  it("trims all in-memory credit viewed id sets to the configured max", () => {
    const ids = Array.from({ length: 5 }, (_, index) => index + 1);
    const base = new Set(ids);

    const trimmed = trimCreditViewedTopicIdSets(
      {
        viewed: base,
        local: base,
        pending: base,
        inFlight: base,
      },
      3,
    );

    expect(Array.from(trimmed.viewed)).toEqual([3, 4, 5]);
    expect(trimmed.local).toEqual(trimmed.viewed);
    expect(trimmed.pending).toEqual(trimmed.viewed);
    expect(trimmed.inFlight).toEqual(trimmed.viewed);
  });
});
