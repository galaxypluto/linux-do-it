import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NATIVE_NOTICE_ID,
  NativeNoticeHostController,
  normalizedCssColor,
  themeTokenReference
} from "../../src/content/nativeNoticeHost";

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

describe("native notice host helpers", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1400 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  });

  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("normalizes CSS colors and preserves token references when colors match", () => {
    document.documentElement.style.setProperty("--surface-test", "rgb(10, 20, 30)");

    expect(normalizedCssColor("#abc")).toBe("rgb(170,187,204)");
    expect(normalizedCssColor("rgb(1 2 3)")).toBe("rgb(1,2,3)");
    expect(normalizedCssColor("rgba(1, 2, 3, 0.5)")).toBe("rgba(1,2,3,0.5)");
    expect(themeTokenReference("rgb(10, 20, 30)", ["--surface-test"])).toBe("var(--surface-test, rgb(10, 20, 30))");
  });
});

describe("NativeNoticeHostController", () => {
  let rootHost: HTMLElement;
  let outlet: HTMLElement;

  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1400 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
    rootHost = document.createElement("section");
    outlet = document.createElement("main");
    document.body.append(rootHost, outlet);
  });

  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("mounts the notice host into category controls and mirrors native sizing", () => {
    const row = document.createElement("div");
    row.className = "list-controls";
    const category = document.createElement("div");
    category.className = "category-breadcrumb";
    const nativeButton = document.createElement("button");
    nativeButton.style.backgroundColor = "rgb(240, 240, 240)";
    nativeButton.style.borderColor = "rgb(12, 34, 56)";
    nativeButton.style.color = "rgb(1, 2, 3)";
    category.appendChild(nativeButton);
    row.appendChild(category);
    outlet.appendChild(row);
    setRect(row, { left: 80, top: 20, width: 900, height: 56 });
    setRect(category, { left: 720, top: 24, width: 220, height: 42 });
    setRect(nativeButton, { left: 730, top: 28, width: 88, height: 34 });

    const controller = new NativeNoticeHostController({
      rootHost: () => rootHost,
      outlet: () => outlet
    });

    const shadowRoot = controller.ensureRoot();
    const host = document.getElementById(NATIVE_NOTICE_ID);

    expect(shadowRoot).not.toBeNull();
    expect(host).toBe(controller.hostElement());
    expect(host?.parentElement).toBe(category);
    expect(category.firstChild).toBe(host);
    expect(host?.style.getPropertyValue("--ldcv-native-notice-height")).toBe("34px");
    expect(host?.style.getPropertyValue("--ldcv-native-notice-min-width")).toBe("88px");
    expect(host?.style.alignSelf).toBe("center");
    expect(host?.style.maxHeight).toBe("48px");
  });

  it("clamps runaway native control measurements so the extension cannot stretch the nav row", () => {
    const row = document.createElement("div");
    row.className = "list-controls";
    const category = document.createElement("div");
    category.className = "category-breadcrumb";
    const nativeButton = document.createElement("button");
    nativeButton.style.backgroundColor = "rgb(240, 240, 240)";
    category.appendChild(nativeButton);
    row.appendChild(category);
    outlet.appendChild(row);
    setRect(row, { left: 80, top: 20, width: 900, height: 280 });
    setRect(category, { left: 720, top: 24, width: 220, height: 260 });
    setRect(nativeButton, { left: 730, top: 28, width: 260, height: 250 });

    const controller = new NativeNoticeHostController({
      rootHost: () => rootHost,
      outlet: () => outlet
    });

    controller.ensureRoot();
    const host = document.getElementById(NATIVE_NOTICE_ID);

    expect(host?.style.getPropertyValue("--ldcv-native-notice-height")).toBe("48px");
    expect(host?.style.getPropertyValue("--ldcv-native-notice-min-width")).toBe("150px");
  });

  it("removes the notice host on narrow screens", () => {
    const row = document.createElement("div");
    row.className = "list-controls";
    const category = document.createElement("div");
    category.className = "category-breadcrumb";
    row.appendChild(category);
    outlet.appendChild(row);
    setRect(row, { left: 80, top: 20, width: 900, height: 56 });
    setRect(category, { left: 720, top: 24, width: 220, height: 42 });
    const controller = new NativeNoticeHostController({
      rootHost: () => rootHost,
      outlet: () => outlet
    });

    expect(controller.ensureRoot()).not.toBeNull();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 700 });

    expect(controller.ensureRoot()).toBeNull();
    expect(document.getElementById(NATIVE_NOTICE_ID)).toBeNull();
  });

  it("writes desktop dock variables beside the native navigation row", () => {
    const row = document.createElement("div");
    row.className = "list-controls";
    const nav = document.createElement("nav");
    nav.id = "navigation-bar";
    const category = document.createElement("div");
    category.className = "category-breadcrumb";
    row.append(nav, category);
    outlet.appendChild(row);
    setRect(row, { left: 100, top: 20, width: 1000, height: 60 });
    setRect(nav, { left: 120, top: 24, width: 300, height: 44 });
    setRect(category, { left: 900, top: 24, width: 180, height: 44 });
    const controller = new NativeNoticeHostController({
      rootHost: () => rootHost,
      outlet: () => outlet
    });

    controller.updateDockPosition(50);

    expect(rootHost.style.getPropertyValue("--ldcv-notice-left")).toBe("444px");
    expect(rootHost.style.getPropertyValue("--ldcv-notice-top")).toBe("58px");
    expect(rootHost.style.getPropertyValue("--ldcv-notice-width")).toBe("432px");
  });

  it("measures pinned top obstructions without counting the extension root", () => {
    const header = document.createElement("header");
    header.className = "d-header";
    header.style.position = "fixed";
    const innerRootChrome = document.createElement("div");
    innerRootChrome.className = "navigation-container";
    rootHost.appendChild(innerRootChrome);
    document.body.appendChild(header);
    setRect(header, { left: 0, top: 0, width: 1200, height: 64 });
    setRect(innerRootChrome, { left: 0, top: 0, width: 1200, height: 140 });
    const controller = new NativeNoticeHostController({
      rootHost: () => rootHost,
      outlet: () => outlet
    });

    expect(controller.measureTopObstructionBottom()).toBe(64);
  });

  it("measures visible left sidebar chrome for modal safe area", () => {
    const sidebar = document.createElement("aside");
    sidebar.className = "sidebar-wrapper";
    const innerRootChrome = document.createElement("nav");
    innerRootChrome.id = "d-sidebar";
    rootHost.appendChild(innerRootChrome);
    document.body.appendChild(sidebar);
    setRect(sidebar, { left: 12, top: 64, width: 272, height: 820 });
    setRect(innerRootChrome, { left: 0, top: 0, width: 320, height: 820 });
    const controller = new NativeNoticeHostController({
      rootHost: () => rootHost,
      outlet: () => outlet
    });

    expect(controller.measureLeftObstructionRight()).toBe(284);
  });

  it("does not reserve modal left space on narrow screens", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 700 });
    const sidebar = document.createElement("aside");
    sidebar.className = "sidebar-wrapper";
    document.body.appendChild(sidebar);
    setRect(sidebar, { left: 0, top: 0, width: 280, height: 820 });
    const controller = new NativeNoticeHostController({
      rootHost: () => rootHost,
      outlet: () => outlet
    });

    expect(controller.measureLeftObstructionRight()).toBe(0);
  });
});
