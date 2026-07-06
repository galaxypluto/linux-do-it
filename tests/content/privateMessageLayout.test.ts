import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRIVATE_MESSAGE_LAYOUT_GRACE_MS,
  PrivateMessageLayoutController
} from "../../src/content/privateMessageLayout";
import { PRIVATE_MESSAGE_HOST_CLASS, PRIVATE_MESSAGE_LAYOUT_CLASS } from "../../src/content/pageStyle";

function setRect(element: Element, rect: Partial<DOMRect>): void {
  element.getBoundingClientRect = () =>
    ({
      x: rect.left ?? 0,
      y: rect.top ?? 0,
      left: rect.left ?? 0,
      top: rect.top ?? 0,
      right: rect.right ?? (rect.left ?? 0) + (rect.width ?? 0),
      bottom: rect.bottom ?? (rect.top ?? 0) + (rect.height ?? 0),
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      toJSON: () => ({})
    }) as DOMRect;
}

describe("PrivateMessageLayoutController", () => {
  let rootHost: HTMLElement;
  let readerSurface: HTMLElement;

  beforeEach(() => {
    rootHost = document.createElement("section");
    readerSurface = document.createElement("article");
    document.body.append(rootHost, readerSurface);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    vi.spyOn(Date, "now").mockReturnValue(1000);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1400 });
  });

  afterEach(() => {
    document.documentElement.className = "";
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("activates layout, adds host class, and writes reader geometry variables", () => {
    setRect(readerSurface, { left: 760, top: 120, width: 520, height: 620 });
    const controller = new PrivateMessageLayoutController({
      rootHost: () => rootHost,
      readerSurface: () => readerSurface,
      canDock: () => true,
      shouldUseReaderGeometry: () => true
    });

    controller.activate();

    expect(document.documentElement.classList.contains(PRIVATE_MESSAGE_LAYOUT_CLASS)).toBe(true);
    expect(rootHost.classList.contains(PRIVATE_MESSAGE_HOST_CLASS)).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--ldcv-private-message-left")).toBe("102px");
    expect(document.documentElement.style.getPropertyValue("--ldcv-private-message-left-reserve")).toBe("760px");
    expect(rootHost.style.getPropertyValue("--ldcv-private-message-left-reserve")).toBe("760px");
    expect(document.documentElement.style.getPropertyValue("--ldcv-private-message-top")).toBe("120px");
    expect(document.documentElement.style.getPropertyValue("--ldcv-private-message-height")).toBe("620px");
  });

  it("schedules a final visibility check after the native composer opening grace window", () => {
    setRect(readerSurface, { left: 760, top: 120, width: 520, height: 620 });
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    const controller = new PrivateMessageLayoutController({
      rootHost: () => rootHost,
      readerSurface: () => readerSurface,
      canDock: () => true,
      shouldUseReaderGeometry: () => true
    });

    controller.activate();

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), PRIVATE_MESSAGE_LAYOUT_GRACE_MS + 120);
  });

  it("reserves space through the composer right edge when the composer is not flush left", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1800 });
    setRect(readerSurface, { left: 1040, top: 80, width: 520, height: 620 });
    const controller = new PrivateMessageLayoutController({
      rootHost: () => rootHost,
      readerSurface: () => readerSurface,
      canDock: () => true,
      shouldUseReaderGeometry: () => true
    });

    controller.activate();

    expect(document.documentElement.style.getPropertyValue("--ldcv-private-message-left")).toBe("382px");
    expect(document.documentElement.style.getPropertyValue("--ldcv-private-message-width")).toBe("640px");
    expect(document.documentElement.style.getPropertyValue("--ldcv-private-message-left-reserve")).toBe("1040px");
    expect(rootHost.style.getPropertyValue("--ldcv-private-message-left-reserve")).toBe("1040px");
  });

  it("uses the measured native composer right edge when the site renders it wider than requested", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1800 });
    setRect(rootHost, { left: 240, top: 0, right: 1720, bottom: 900, width: 1480, height: 900 });
    setRect(readerSurface, { left: 1040, top: 80, width: 520, height: 620 });
    const composer = document.createElement("div");
    composer.id = "reply-control";
    composer.className = "open";
    document.body.appendChild(composer);
    setRect(composer, { left: 260, top: 80, right: 1160, bottom: 700, width: 900, height: 620 });
    const controller = new PrivateMessageLayoutController({
      rootHost: () => rootHost,
      readerSurface: () => readerSurface,
      canDock: () => true,
      shouldUseReaderGeometry: () => true
    });

    controller.activate();

    expect(document.documentElement.style.getPropertyValue("--ldcv-private-message-left-reserve")).toBe("1178px");
    expect(rootHost.style.getPropertyValue("--ldcv-private-message-left-reserve")).toBe("1178px");
    expect(document.documentElement.style.getPropertyValue("--ldcv-private-message-local-reserve")).toBe("938px");
    expect(rootHost.style.getPropertyValue("--ldcv-private-message-local-reserve")).toBe("938px");
  });

  it("clamps reader reserve to the extension root right edge", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1800 });
    setRect(rootHost, { left: 300, top: 0, right: 1320, bottom: 900, width: 1020, height: 900 });
    setRect(readerSurface, { left: 1040, top: 80, width: 520, height: 620 });
    const composer = document.createElement("div");
    composer.id = "reply-control";
    composer.className = "open";
    document.body.appendChild(composer);
    setRect(composer, { left: 260, top: 80, right: 1160, bottom: 700, width: 900, height: 620 });
    const controller = new PrivateMessageLayoutController({
      rootHost: () => rootHost,
      readerSurface: () => readerSurface,
      canDock: () => true,
      shouldUseReaderGeometry: () => true
    });

    controller.activate();

    expect(document.documentElement.style.getPropertyValue("--ldcv-private-message-left-reserve")).toBe("982px");
    expect(rootHost.style.getPropertyValue("--ldcv-private-message-left-reserve")).toBe("982px");
    expect(rootHost.style.getPropertyValue("--ldcv-private-message-local-reserve")).toBe("682px");
  });

  it("keeps non-reader layout active without reader geometry variables", () => {
    const controller = new PrivateMessageLayoutController({
      rootHost: () => rootHost,
      readerSurface: () => null,
      canDock: () => true,
      shouldUseReaderGeometry: () => false
    });

    controller.activate();

    expect(document.documentElement.classList.contains(PRIVATE_MESSAGE_LAYOUT_CLASS)).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--ldcv-private-message-left")).toBe("");
  });

  it("detects visible native composers outside the extension root only", () => {
    const outside = document.createElement("div");
    outside.id = "reply-control";
    outside.className = "open";
    const inside = document.createElement("div");
    inside.className = "composer-popup";
    rootHost.appendChild(inside);
    document.body.appendChild(outside);
    setRect(outside, { left: 10, top: 10, right: 280, bottom: 180, width: 270, height: 170 });
    setRect(inside, { left: 10, top: 10, right: 280, bottom: 180, width: 270, height: 170 });
    const controller = new PrivateMessageLayoutController({
      rootHost: () => rootHost,
      readerSurface: () => readerSurface,
      canDock: () => true
    });

    expect(controller.nativeComposerVisible()).toBe(true);
    outside.remove();
    expect(controller.nativeComposerVisible()).toBe(false);
  });

  it("deactivates immediately after a previously visible native composer closes", () => {
    setRect(readerSurface, { left: 760, top: 120, width: 520, height: 620 });
    const composer = document.createElement("div");
    composer.id = "reply-control";
    composer.className = "open";
    document.body.appendChild(composer);
    setRect(composer, { left: 120, top: 120, right: 620, bottom: 620, width: 500, height: 500 });
    const onDeactivate = vi.fn();
    const controller = new PrivateMessageLayoutController({
      rootHost: () => rootHost,
      readerSurface: () => readerSurface,
      canDock: () => true,
      onDeactivate
    });

    controller.activate();
    composer.remove();
    controller.scheduleSync();

    expect(document.documentElement.classList.contains(PRIVATE_MESSAGE_LAYOUT_CLASS)).toBe(false);
    expect(rootHost.classList.contains(PRIVATE_MESSAGE_HOST_CLASS)).toBe(false);
    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it("deactivates and clears geometry when docking is no longer allowed", () => {
    setRect(readerSurface, { left: 760, top: 120, width: 520, height: 620 });
    let canDock = true;
    const controller = new PrivateMessageLayoutController({
      rootHost: () => rootHost,
      readerSurface: () => readerSurface,
      canDock: () => canDock
    });

    controller.activate();
    canDock = false;
    controller.scheduleSync();

    expect(document.documentElement.classList.contains(PRIVATE_MESSAGE_LAYOUT_CLASS)).toBe(false);
    expect(rootHost.classList.contains(PRIVATE_MESSAGE_HOST_CLASS)).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--ldcv-private-message-left")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--ldcv-private-message-left-reserve")).toBe("");
    expect(rootHost.style.getPropertyValue("--ldcv-private-message-left-reserve")).toBe("");
  });

  it("notifies once when an active composer layout deactivates", () => {
    const onDeactivate = vi.fn();
    const controller = new PrivateMessageLayoutController({
      rootHost: () => rootHost,
      readerSurface: () => readerSurface,
      canDock: () => true,
      onDeactivate
    });

    controller.activate();
    controller.deactivate();
    controller.deactivate();

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });
});
