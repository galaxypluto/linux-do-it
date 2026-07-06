import { describe, expect, it } from "vitest";
import { isTextEntryEvent } from "../../src/content/mount";

describe("reader keyboard routing", () => {
  it("treats composed-path inputs as text entry targets", () => {
    const input = document.createElement("input");
    const event = new KeyboardEvent("keydown", { key: "ArrowLeft" });
    Object.defineProperty(event, "composedPath", {
      value: () => [input, document.body, window]
    });

    expect(isTextEntryEvent(event)).toBe(true);
  });

  it("does not treat ordinary composed-path elements as text entry targets", () => {
    const button = document.createElement("button");
    const event = new KeyboardEvent("keydown", { key: "ArrowLeft" });
    Object.defineProperty(event, "composedPath", {
      value: () => [button, document.body, window]
    });

    expect(isTextEntryEvent(event)).toBe(false);
  });
});
