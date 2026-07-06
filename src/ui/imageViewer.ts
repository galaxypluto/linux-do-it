import { escapeAttribute } from "./html";
import { icons } from "./icons";

export interface ReaderImageViewerState {
  src: string;
  alt: string;
  originalUrl: string;
  items: ReaderImageViewerItem[];
  index: number;
  scale: number;
  rotation: number;
}

export interface ReaderImageViewerItem {
  src: string;
  alt: string;
  originalUrl: string;
}

export type ReaderImageViewerAction =
  | "previous"
  | "next"
  | "zoom-in"
  | "zoom-out"
  | "rotate"
  | "reset"
  | "toggle-zoom"
  | { type: "wheel-zoom"; deltaY: number };
export const IMAGE_VIEWER_SUPPRESS_CLOSE_ATTRIBUTE = "data-image-viewer-suppress-close";

export function readerImageViewerTemplate(image: ReaderImageViewerState): string {
  const item = image.items[image.index] || image;
  const src = escapeAttribute(item.src);
  const alt = escapeAttribute(item.alt);
  const originalUrl = escapeAttribute(item.originalUrl || item.src);
  const count = Math.max(image.items.length, 1);
  const scale = clampNumber(image.scale || 1, 0.25, 4);
  const rotation = normalizeRotation(image.rotation || 0);
  const scaleLabel = `${Math.round(scale * 100)}%`;
  const canNavigate = count > 1;
  return `
    <div class="ldcv-image-viewer" data-image-viewer-backdrop>
      <section class="ldcv-image-viewer__dialog" role="dialog" aria-modal="true" aria-label="图片查看器" style="--viewer-scale:${scale};--viewer-rotation:${rotation}deg">
        <div class="ldcv-image-viewer__stage" data-image-viewer-stage>
          <img src="${src}" alt="${alt}" />
        </div>
        <div class="ldcv-image-viewer__bar" role="toolbar" aria-label="图片工具">
          <button type="button" data-image-action="previous" ${canNavigate ? "" : "disabled"} title="上一张" aria-label="上一张">
            ${icons.previous}
          </button>
          <span class="ldcv-image-viewer__count">${image.index + 1}/${count}</span>
          <button type="button" data-image-action="next" ${canNavigate ? "" : "disabled"} title="下一张" aria-label="下一张">
            ${icons.next}
          </button>
          <i aria-hidden="true"></i>
          <button type="button" data-image-action="zoom-out" ${scale <= 0.25 ? "disabled" : ""} title="缩小" aria-label="缩小">
            ${icons.zoomOut}
          </button>
          <span class="ldcv-image-viewer__scale">${scaleLabel}</span>
          <button type="button" data-image-action="zoom-in" ${scale >= 4 ? "disabled" : ""} title="放大" aria-label="放大">
            ${icons.zoomIn}
          </button>
          <button type="button" data-image-action="reset" title="重置" aria-label="重置">
            ${icons.fit}
          </button>
          <i aria-hidden="true"></i>
          <button type="button" data-image-action="rotate" title="旋转" aria-label="旋转">
            ${icons.rotate}
          </button>
          <a href="${originalUrl}" target="_blank" rel="noopener noreferrer" title="打开原图" aria-label="打开原图">
            ${icons.eye}
          </a>
          <a href="${originalUrl}" download target="_blank" rel="noopener noreferrer" title="下载" aria-label="下载">
            ${icons.download}
          </a>
          <button type="button" data-action="close-image-viewer" title="关闭图片" aria-label="关闭图片">×</button>
        </div>
      </section>
    </div>
  `;
}

export function bindImageViewerPan(root: ShadowRoot, onDoubleClickImage?: () => void): void {
  const stage = root.querySelector<HTMLElement>("[data-image-viewer-stage]");
  const image = stage?.querySelector<HTMLImageElement>("img");
  if (!stage || !image) {
    return;
  }

  let activePointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let baseX = 0;
  let baseY = 0;
  let moved = false;

  const readPan = (): { x: number; y: number } => {
    const style = getComputedStyle(stage);
    return {
      x: Number.parseFloat(style.getPropertyValue("--viewer-pan-x")) || 0,
      y: Number.parseFloat(style.getPropertyValue("--viewer-pan-y")) || 0
    };
  };

  const endDrag = (event: PointerEvent): void => {
    if (activePointerId !== event.pointerId) {
      return;
    }
    activePointerId = null;
    stage.classList.remove("is-dragging");
    if (moved) {
      stage.setAttribute(IMAGE_VIEWER_SUPPRESS_CLOSE_ATTRIBUTE, "true");
      window.setTimeout(() => {
        stage.removeAttribute(IMAGE_VIEWER_SUPPRESS_CLOSE_ATTRIBUTE);
      }, 160);
    }
    try {
      stage.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
  };

  stage.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof HTMLImageElement)) {
      return;
    }

    const pan = readPan();
    activePointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    baseX = pan.x;
    baseY = pan.y;
    moved = false;
    stage.classList.add("is-dragging");
    stage.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  stage.addEventListener("pointermove", (event) => {
    if (activePointerId !== event.pointerId) {
      return;
    }

    if (Math.abs(event.clientX - startX) > 3 || Math.abs(event.clientY - startY) > 3) {
      moved = true;
    }
    stage.style.setProperty("--viewer-pan-x", `${baseX + event.clientX - startX}px`);
    stage.style.setProperty("--viewer-pan-y", `${baseY + event.clientY - startY}px`);
  });

  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
  image.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  stage.addEventListener("dblclick", (event) => {
    if (!(event.target instanceof HTMLImageElement) && !isImageViewerImageHit(event, image)) {
      return;
    }
    stage.style.setProperty("--viewer-pan-x", "0px");
    stage.style.setProperty("--viewer-pan-y", "0px");
    event.preventDefault();
    event.stopPropagation();
    onDoubleClickImage?.();
  });
}

export function isImageViewerImageHit(event: MouseEvent, image: HTMLImageElement): boolean {
  const rect = image.getBoundingClientRect();
  const tolerance = 2;
  return (
    event.clientX >= rect.left - tolerance &&
    event.clientX <= rect.right + tolerance &&
    event.clientY >= rect.top - tolerance &&
    event.clientY <= rect.bottom + tolerance
  );
}

export function normalizeImageViewerAction(value: string | undefined): ReaderImageViewerAction {
  if (
    value === "previous" ||
    value === "next" ||
    value === "zoom-in" ||
    value === "zoom-out" ||
    value === "rotate" ||
    value === "reset" ||
    value === "toggle-zoom"
  ) {
    return value;
  }
  return "reset";
}

export function imageViewerItems(root: ShadowRoot): ReaderImageViewerItem[] {
  const items: ReaderImageViewerItem[] = [];
  const seen = new Set<string>();
  root
    .querySelectorAll<HTMLElement>(".ldcv-reader-prose .ldcv-reader-image-link, .ldcv-reader-prose img.ldcv-reader-image")
    .forEach((element) => {
      if (element instanceof HTMLImageElement && element.closest(".ldcv-reader-image-link")) {
        return;
      }
      const item = imageViewerItemFromElement(element);
      if (!item || seen.has(item.src)) {
        return;
      }
      seen.add(item.src);
      items.push(item);
    });
  return items;
}

export function imageViewerItemFromElement(element: HTMLElement): ReaderImageViewerItem | null {
  const image = element instanceof HTMLImageElement ? element : element.querySelector<HTMLImageElement>("img");
  if (image && isEmojiElement(image)) {
    return null;
  }
  const src =
    element.getAttribute("data-reader-image") ||
    image?.getAttribute("data-reader-image-src") ||
    image?.currentSrc ||
    image?.src ||
    "";
  if (!src) {
    return null;
  }

  return {
    src,
    originalUrl: element.getAttribute("href") || src,
    alt: image?.getAttribute("data-reader-image-alt") || image?.alt || "图片"
  };
}

function isEmojiElement(image: HTMLImageElement): boolean {
  const marker = `${image.className} ${image.alt} ${image.title} ${image.src}`;
  return (
    /\b(ldcv-reader-emoji|emoji|emoticon|smiley|twemoji)\b/i.test(marker) ||
    /^:[\w+-]+:$/i.test(image.alt.trim()) ||
    /^:[\w+-]+:$/i.test(image.title.trim()) ||
    /(?:^|\/)(emoji|emojis|twemoji|emoji-one|emoji_one)(?:\/|$)/i.test(image.src)
  );
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeRotation(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}
