import { describe, expect, it, vi } from "vitest";
import {
  bindImageViewerPan,
  imageViewerItemFromElement,
  imageViewerItems,
  isImageViewerImageHit,
  normalizeImageViewerAction,
  type ReaderImageViewerState,
  readerImageViewerTemplate
} from "../../src/ui/imageViewer";
import { imageViewerActionFromKey, imageViewerActionFromWheel, nextReaderImageViewerState } from "../../src/ui/imageViewerState";

describe("readerImageViewerTemplate", () => {
  it("clamps scale, normalizes rotation, escapes attributes, and disables navigation for one image", () => {
    const html = readerImageViewerTemplate({
      src: "https://linux.do/fallback.png",
      alt: "fallback",
      originalUrl: "https://linux.do/fallback.png",
      items: [
        {
          src: 'https://linux.do/image.png?x="<tag>"',
          alt: 'Quoted "alt"',
          originalUrl: 'https://linux.do/original.png?x="<tag>"'
        }
      ],
      index: 0,
      scale: 9,
      rotation: -90
    });
    const doc = new DOMParser().parseFromString(html, "text/html");
    const dialog = doc.querySelector<HTMLElement>(".ldcv-image-viewer__dialog");
    const image = doc.querySelector("img");

    expect(dialog?.getAttribute("style")).toContain("--viewer-scale:4");
    expect(dialog?.getAttribute("style")).toContain("--viewer-rotation:270deg");
    expect(image?.getAttribute("alt")).toBe('Quoted "alt"');
    expect(doc.querySelector("[data-image-action='previous']")?.hasAttribute("disabled")).toBe(true);
    expect(doc.querySelector("[data-image-action='next']")?.hasAttribute("disabled")).toBe(true);
    expect(doc.querySelector(".ldcv-image-viewer__scale")?.textContent).toBe("400%");
    expect(doc.querySelector("a[aria-label='打开原图']")?.getAttribute("href")).toContain(
      "https://linux.do/original.png"
    );
  });
});

describe("image viewer item extraction", () => {
  it("extracts unique reader images from prose", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <div class="ldcv-reader-prose">
        <a class="ldcv-reader-image-link" href="https://linux.do/original-a.png" data-reader-image="https://linux.do/original-a.png">
          <img class="ldcv-reader-image" src="https://linux.do/thumb-a.png" data-reader-image-src="https://linux.do/original-a.png" data-reader-image-alt="A">
        </a>
        <img class="ldcv-reader-image" src="https://linux.do/original-b.png" alt="B">
        <img class="ldcv-reader-image" src="https://linux.do/original-b.png" alt="duplicate">
        <img class="emoji" src="https://linux.do/emoji/heart.png" alt=":heart:">
      </div>
    `;

    expect(imageViewerItems(root)).toEqual([
      {
        src: "https://linux.do/original-a.png",
        originalUrl: "https://linux.do/original-a.png",
        alt: "A"
      },
      {
        src: "https://linux.do/original-b.png",
        originalUrl: "https://linux.do/original-b.png",
        alt: "B"
      }
    ]);
  });

  it("ignores emoji images and empty elements", () => {
    const wrapper = document.createElement("span");
    wrapper.innerHTML = `<img class="emoji" src="https://linux.do/emoji/heart.png" alt=":heart:">`;
    const empty = document.createElement("span");

    expect(imageViewerItemFromElement(wrapper)).toBeNull();
    expect(imageViewerItemFromElement(empty)).toBeNull();
  });
});

describe("normalizeImageViewerAction", () => {
  it("keeps supported actions and falls back to reset", () => {
    expect(normalizeImageViewerAction("zoom-in")).toBe("zoom-in");
    expect(normalizeImageViewerAction("previous")).toBe("previous");
    expect(normalizeImageViewerAction("toggle-zoom")).toBe("toggle-zoom");
    expect(normalizeImageViewerAction("unknown")).toBe("reset");
    expect(normalizeImageViewerAction(undefined)).toBe("reset");
  });
});

describe("image viewer state", () => {
  const viewer: ReaderImageViewerState = {
    src: "https://linux.do/a.png",
    originalUrl: "https://linux.do/a.png",
    alt: "A",
    items: [
      {
        src: "https://linux.do/a.png",
        originalUrl: "https://linux.do/a.png",
        alt: "A"
      },
      {
        src: "https://linux.do/b.png",
        originalUrl: "https://linux.do/b.png",
        alt: "B"
      }
    ],
    index: 0,
    scale: 1,
    rotation: 0
  };

  it("switches images cyclically and resets transform on image switch", () => {
    const next = nextReaderImageViewerState({ ...viewer, scale: 2, rotation: 90 }, "next");
    const previous = nextReaderImageViewerState(next, "previous");

    expect(next).toMatchObject({
      src: "https://linux.do/b.png",
      index: 1,
      scale: 1,
      rotation: 0
    });
    expect(previous).toMatchObject({
      src: "https://linux.do/a.png",
      index: 0,
      scale: 1,
      rotation: 0
    });
  });

  it("clamps zoom, rotates, resets, and recovers invalid transform values", () => {
    expect(nextReaderImageViewerState({ ...viewer, scale: 3.9 }, "zoom-in").scale).toBe(4);
    expect(nextReaderImageViewerState({ ...viewer, scale: 0.3 }, "zoom-out").scale).toBe(0.25);
    expect(nextReaderImageViewerState({ ...viewer, scale: 1 }, { type: "wheel-zoom", deltaY: -24 }).scale).toBeGreaterThan(1);
    expect(nextReaderImageViewerState({ ...viewer, scale: 1 }, { type: "wheel-zoom", deltaY: -24 }).scale).toBeLessThan(1.25);
    expect(nextReaderImageViewerState({ ...viewer, scale: 1 }, { type: "wheel-zoom", deltaY: 24 }).scale).toBeLessThan(1);
    expect(nextReaderImageViewerState({ ...viewer, scale: 1 }, { type: "wheel-zoom", deltaY: 24 }).scale).toBeGreaterThan(0.25);
    expect(nextReaderImageViewerState({ ...viewer, scale: 1 }, "toggle-zoom").scale).toBe(2);
    expect(nextReaderImageViewerState({ ...viewer, scale: 2, rotation: 90 }, "toggle-zoom")).toMatchObject({
      scale: 1,
      rotation: 90
    });
    expect(nextReaderImageViewerState({ ...viewer, rotation: 270 }, "rotate").rotation).toBe(0);
    expect(nextReaderImageViewerState({ ...viewer, scale: Number.NaN, rotation: Number.NaN }, "reset")).toMatchObject({
      scale: 1,
      rotation: 0
    });
  });

  it("maps keyboard keys to viewer actions", () => {
    expect(imageViewerActionFromKey("ArrowLeft")).toBe("previous");
    expect(imageViewerActionFromKey("ArrowRight")).toBe("next");
    expect(imageViewerActionFromKey("+")).toBe("zoom-in");
    expect(imageViewerActionFromKey("_")).toBe("zoom-out");
    expect(imageViewerActionFromKey("0")).toBe("reset");
    expect(imageViewerActionFromKey("R")).toBe("rotate");
    expect(imageViewerActionFromKey("Escape")).toBeNull();
  });

  it("maps wheel deltas to continuous zoom actions", () => {
    expect(imageViewerActionFromWheel(-1)).toEqual({ type: "wheel-zoom", deltaY: -1 });
    expect(imageViewerActionFromWheel(1)).toEqual({ type: "wheel-zoom", deltaY: 1 });
    expect(imageViewerActionFromWheel(0)).toBeNull();
    expect(imageViewerActionFromWheel(Number.NaN)).toBeNull();
  });
});

describe("bindImageViewerPan", () => {
  it("resets pan and emits toggle zoom on image double click", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const onDoubleClickImage = vi.fn();
    root.innerHTML = `
      <div data-image-viewer-stage style="--viewer-pan-x: 20px; --viewer-pan-y: -12px">
        <img src="https://linux.do/a.png" alt="A">
      </div>
    `;

    bindImageViewerPan(root, onDoubleClickImage);
    root.querySelector("img")?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));

    const stage = root.querySelector<HTMLElement>("[data-image-viewer-stage]");
    expect(stage?.style.getPropertyValue("--viewer-pan-x")).toBe("0px");
    expect(stage?.style.getPropertyValue("--viewer-pan-y")).toBe("0px");
    expect(onDoubleClickImage).toHaveBeenCalledOnce();
  });

  it("treats stage double clicks inside the rendered image as image double clicks", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const onDoubleClickImage = vi.fn();
    root.innerHTML = `
      <div data-image-viewer-stage>
        <img src="https://linux.do/a.png" alt="A">
      </div>
    `;
    const image = root.querySelector("img");
    image!.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 20,
        right: 210,
        bottom: 120,
        width: 200,
        height: 100,
        x: 10,
        y: 20,
        toJSON: () => ({})
      }) as DOMRect;

    bindImageViewerPan(root, onDoubleClickImage);
    root
      .querySelector<HTMLElement>("[data-image-viewer-stage]")
      ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: 120, clientY: 80 }));

    expect(onDoubleClickImage).toHaveBeenCalledOnce();
    expect(isImageViewerImageHit(new MouseEvent("click", { clientX: 120, clientY: 80 }), image!)).toBe(true);
  });
});
