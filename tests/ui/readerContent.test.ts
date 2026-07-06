import { describe, expect, it } from "vitest";
import { collectFreshAnimationPostNumbers } from "../../src/ui/react/reader/ReaderContent";

describe("collectFreshAnimationPostNumbers", () => {
  it("only animates fresh posts that have not animated in the current reader session", () => {
    expect(
      Array.from(collectFreshAnimationPostNumbers([3, 4, 5], new Set([2, 4]))).sort((a, b) => a - b)
    ).toEqual([3, 5]);
  });

  it("returns an empty set when every fresh post has already animated once", () => {
    expect(collectFreshAnimationPostNumbers([7, 8], new Set([7, 8, 9])).size).toBe(0);
  });
});
