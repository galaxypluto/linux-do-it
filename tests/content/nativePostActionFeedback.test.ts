import { describe, expect, it } from "vitest";
import {
  shouldAutoDismissNativePostActionFeedback,
  shouldClearComposerOpenedFeedback
} from "../../src/content/nativePostActionFeedback";
import type { ReaderPostActionFeedback } from "../../src/ui/readerTypes";

function feedback(overrides: Partial<ReaderPostActionFeedback>): ReaderPostActionFeedback {
  return {
    requestId: "req-1",
    action: "like",
    postNumber: 1,
    status: "success",
    message: "已完成",
    ...overrides
  };
}

describe("native post action feedback lifecycle", () => {
  it("auto-dismisses success feedback only", () => {
    expect(shouldAutoDismissNativePostActionFeedback(feedback({ status: "success" }))).toBe(true);
    expect(
      shouldAutoDismissNativePostActionFeedback(
        feedback({ status: "success", fallbackUrl: "https://linux.do/t/topic/1/4" })
      )
    ).toBe(false);
    expect(shouldAutoDismissNativePostActionFeedback(feedback({ status: "error" }))).toBe(false);
    expect(shouldAutoDismissNativePostActionFeedback(feedback({ status: "timeout" }))).toBe(false);
    expect(shouldAutoDismissNativePostActionFeedback(feedback({ status: "unsupported" }))).toBe(false);
  });

  it("clears opened composer feedback when the native composer closes", () => {
    expect(shouldClearComposerOpenedFeedback(feedback({ action: "reply", status: "success" }))).toBe(true);
    expect(shouldClearComposerOpenedFeedback(feedback({ action: "reply", status: "error" }))).toBe(false);
    expect(shouldClearComposerOpenedFeedback(feedback({ action: "bookmark", status: "success" }))).toBe(false);
    expect(shouldClearComposerOpenedFeedback(feedback({ action: "private-message", status: "success" }))).toBe(true);
    expect(shouldClearComposerOpenedFeedback(feedback({ action: "private-message", status: "error" }))).toBe(false);
  });
});
