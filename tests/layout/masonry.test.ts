import { afterEach, describe, expect, it, vi } from "vitest";
import { applyMasonry, scheduleMasonry } from "../../src/layout/masonry";

function shadowRootWith(html: string): ShadowRoot {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = html;
  return root;
}

function setHeight(element: Element, height: number): void {
  element.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 320,
      bottom: height,
      width: 320,
      height,
      toJSON: () => ({})
    }) as DOMRect;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("masonry layout", () => {
  it("updates row spans without clearing the current placement first", () => {
    const root = shadowRootWith(`
      <div data-card-grid="masonry" style="display: grid; grid-auto-rows: 4px; row-gap: 16px;">
        <article class="ldcv-card" style="grid-row-end: span 8"></article>
      </div>
    `);
    const grid = root.querySelector<HTMLElement>("[data-card-grid='masonry']")!;
    const card = root.querySelector<HTMLElement>(".ldcv-card")!;
    const writes: string[] = [];
    const getComputedStyle = vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (element === grid) {
        return {
          getPropertyValue: (property: string) => {
            if (property === "grid-auto-rows") {
              return "4px";
            }
            if (property === "row-gap") {
              return "16px";
            }
            return "";
          }
        } as CSSStyleDeclaration;
      }
      return {} as CSSStyleDeclaration;
    });
    const setProperty = vi.spyOn(card.style, "setProperty").mockImplementation((property, value) => {
      writes.push(`${property}:${value}`);
      CSSStyleDeclaration.prototype.setProperty.call(card.style, property, value);
    });
    setHeight(card, 100);

    applyMasonry(root, { remeasureAll: true });

    const rowEndWrites = writes.filter((w) => w.startsWith("grid-row-end:"));
    expect(rowEndWrites).not.toContain("grid-row-end:");
    expect(rowEndWrites).toEqual(["grid-row-end:span 6"]);
    expect(card.style.getPropertyValue("grid-row-end")).toBe("span 6");
    const setPropertyCalls = setProperty.mock.calls.filter(c => c[0] === "grid-row-end");
    expect(setPropertyCalls).toHaveLength(1);
    getComputedStyle.mockRestore();
  });

  it("coalesces multiple scheduled masonry passes into one frame", () => {
    const root = shadowRootWith(`<div data-card-grid="masonry"></div>`);
    const frames: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });

    scheduleMasonry(root);
    scheduleMasonry(root);

    expect(frames).toHaveLength(1);
    frames[0](0);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it("can scope masonry placement to newly appended cards", () => {
    const root = shadowRootWith(`
      <div data-card-grid="masonry" style="display: grid; grid-auto-rows: 4px; row-gap: 16px;">
        <article class="ldcv-card" data-topic-id="1" style="grid-row-end: span 8"></article>
        <article class="ldcv-card is-entering" data-topic-id="2"></article>
      </div>
    `);
    const grid = root.querySelector<HTMLElement>("[data-card-grid='masonry']")!;
    const existing = root.querySelector<HTMLElement>("[data-topic-id='1']")!;
    const entering = root.querySelector<HTMLElement>("[data-topic-id='2']")!;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (element === grid) {
        return {
          getPropertyValue: (property: string) => {
            if (property === "grid-auto-rows") {
              return "4px";
            }
            if (property === "row-gap") {
              return "16px";
            }
            return "";
          }
        } as CSSStyleDeclaration;
      }
      return {} as CSSStyleDeclaration;
    });
    const existingRect = vi.spyOn(existing, "getBoundingClientRect");
    setHeight(entering, 120);

    applyMasonry(root, { cardSelector: ".ldcv-card.is-entering" });

    expect(existingRect).not.toHaveBeenCalled();
    expect(existing.style.getPropertyValue("grid-row-end")).toBe("span 8");
    expect(entering.style.getPropertyValue("grid-row-end")).toBe("span 7");
  });

  it("uses content height when an unplaced entering card is compressed by the masonry grid", () => {
    const root = shadowRootWith(`
      <div data-card-grid="masonry" style="display: grid; grid-auto-rows: 2px; row-gap: 0; --ldcv-masonry-row-gap: 16px;">
        <article class="ldcv-card is-entering" data-topic-id="2"></article>
      </div>
    `);
    const grid = root.querySelector<HTMLElement>("[data-card-grid='masonry']")!;
    const entering = root.querySelector<HTMLElement>("[data-topic-id='2']")!;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (element === grid) {
        return {
          getPropertyValue: (property: string) => {
            if (property === "grid-auto-rows") {
              return "2px";
            }
            if (property === "row-gap") {
              return "0px";
            }
            if (property === "--ldcv-masonry-row-gap") {
              return "16px";
            }
            return "";
          }
        } as CSSStyleDeclaration;
      }
      return {} as CSSStyleDeclaration;
    });
    setHeight(entering, 2);
    Object.defineProperty(entering, "scrollHeight", {
      configurable: true,
      value: 120
    });

    applyMasonry(root, { cardSelector: ".ldcv-card.is-entering" });

    expect(entering.style.getPropertyValue("grid-row-end")).toBe("span 68");
  });

  it("uses the visual masonry gap separately from the grid row gap", () => {
    const root = shadowRootWith(`
      <div data-card-grid="masonry" style="display: grid; grid-auto-rows: 2px; row-gap: 0; --ldcv-masonry-row-gap: 16px;">
        <article class="ldcv-card"></article>
      </div>
    `);
    const grid = root.querySelector<HTMLElement>("[data-card-grid='masonry']")!;
    const card = root.querySelector<HTMLElement>(".ldcv-card")!;
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (element === grid) {
        return {
          getPropertyValue: (property: string) => {
            if (property === "grid-auto-rows") {
              return "2px";
            }
            if (property === "row-gap") {
              return "0px";
            }
            if (property === "--ldcv-masonry-row-gap") {
              return "16px";
            }
            return "";
          }
        } as CSSStyleDeclaration;
      }
      return {} as CSSStyleDeclaration;
    });
    setHeight(card, 100);

    applyMasonry(root);

    expect(card.style.getPropertyValue("grid-row-end")).toBe("span 58");
  });

  it("lets a full scheduled masonry pass override a pending scoped pass", () => {
    const root = shadowRootWith(`
      <div data-card-grid="masonry" style="display: grid; grid-auto-rows: 4px; row-gap: 16px;">
        <article class="ldcv-card" data-topic-id="1"></article>
        <article class="ldcv-card is-entering" data-topic-id="2"></article>
      </div>
    `);
    const grid = root.querySelector<HTMLElement>("[data-card-grid='masonry']")!;
    const existing = root.querySelector<HTMLElement>("[data-topic-id='1']")!;
    const entering = root.querySelector<HTMLElement>("[data-topic-id='2']")!;
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (element === grid) {
        return {
          getPropertyValue: (property: string) => {
            if (property === "grid-auto-rows") {
              return "4px";
            }
            if (property === "row-gap") {
              return "16px";
            }
            return "";
          }
        } as CSSStyleDeclaration;
      }
      return {} as CSSStyleDeclaration;
    });
    setHeight(existing, 80);
    setHeight(entering, 120);

    scheduleMasonry(root, { cardSelector: ".ldcv-card.is-entering" });
    scheduleMasonry(root);
    frames[0](0);

    expect(existing.style.getPropertyValue("grid-row-end")).toBe("span 5");
    expect(entering.style.getPropertyValue("grid-row-end")).toBe("span 7");
  });

  it("does not scroll the viewport when a scheduled masonry pass changes placement", () => {
    const root = shadowRootWith(`
      <div data-card-grid="masonry" style="display: grid; grid-auto-rows: 4px; row-gap: 16px;">
        <article class="ldcv-card" data-topic-id="1" style="grid-row-end: span 2"></article>
      </div>
    `);
    const grid = root.querySelector<HTMLElement>("[data-card-grid='masonry']")!;
    const card = root.querySelector<HTMLElement>(".ldcv-card")!;
    const frames: FrameRequestCallback[] = [];
    const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => undefined);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (element === grid) {
        return {
          getPropertyValue: (property: string) => {
            if (property === "grid-auto-rows") {
              return "4px";
            }
            if (property === "row-gap") {
              return "16px";
            }
            return "";
          }
        } as CSSStyleDeclaration;
      }
      return {} as CSSStyleDeclaration;
    });
    card.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 160,
        left: 0,
        top: 160,
        right: 320,
        bottom: 280,
        width: 320,
        height: 120,
        toJSON: () => ({})
      }) as DOMRect;

    applyMasonry(root, { remeasureAll: true });

    expect(card.style.getPropertyValue("grid-row-end")).toBe("span 7");
    expect(scrollBy).not.toHaveBeenCalled();
  });
});
