import type { ReaderImageViewerAction, ReaderImageViewerState } from "./imageViewer";

const MIN_IMAGE_SCALE = 0.25;
const MAX_IMAGE_SCALE = 4;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;

export function nextReaderImageViewerState(
  viewer: ReaderImageViewerState,
  action: ReaderImageViewerAction
): ReaderImageViewerState {
  const items = viewer.items.length ? viewer.items : [viewer];
  const nextIndex = nextImageIndex(viewer.index, items.length, action);
  const switchedImage = nextIndex !== viewer.index;
  const nextItem = items[nextIndex] || viewer;
  const nextScale = switchedImage ? 1 : nextImageScale(viewer.scale, action);
  const nextRotation = switchedImage ? 0 : nextImageRotation(viewer.rotation, action);

  return {
    ...nextItem,
    items,
    index: nextIndex,
    scale: nextScale,
    rotation: nextRotation
  };
}

export function imageViewerActionFromKey(key: string): ReaderImageViewerAction | null {
  if (key === "ArrowLeft") {
    return "previous";
  }
  if (key === "ArrowRight") {
    return "next";
  }
  if (key === "+" || key === "=") {
    return "zoom-in";
  }
  if (key === "-" || key === "_") {
    return "zoom-out";
  }
  if (key === "0") {
    return "reset";
  }
  if (key.toLowerCase() === "r") {
    return "rotate";
  }
  return null;
}

export function imageViewerActionFromWheel(deltaY: number): ReaderImageViewerAction | null {
  return deltaY === 0 || !Number.isFinite(deltaY) ? null : { type: "wheel-zoom", deltaY };
}

function nextImageIndex(index: number, count: number, action: ReaderImageViewerAction): number {
  if (count <= 1) {
    return 0;
  }
  if (action === "previous") {
    return (index - 1 + count) % count;
  }
  if (action === "next") {
    return (index + 1) % count;
  }
  return index;
}

function nextImageScale(scale: number, action: ReaderImageViewerAction): number {
  const current = Number.isFinite(scale) ? scale : 1;
  if (action === "zoom-in") {
    return clampImageScale(current + 0.25);
  }
  if (action === "zoom-out") {
    return clampImageScale(current - 0.25);
  }
  if (action === "reset") {
    return 1;
  }
  if (action === "toggle-zoom") {
    return current > 1.25 ? 1 : 2;
  }
  if (typeof action === "object" && action.type === "wheel-zoom") {
    return clampImageScale(current * Math.exp(-action.deltaY * WHEEL_ZOOM_SENSITIVITY));
  }
  return current;
}

function clampImageScale(scale: number): number {
  return Math.min(Math.max(scale, MIN_IMAGE_SCALE), MAX_IMAGE_SCALE);
}

function nextImageRotation(rotation: number, action: ReaderImageViewerAction): number {
  const current = Number.isFinite(rotation) ? rotation : 0;
  if (action === "rotate") {
    return (current + 90) % 360;
  }
  if (action === "reset") {
    return 0;
  }
  return current;
}
