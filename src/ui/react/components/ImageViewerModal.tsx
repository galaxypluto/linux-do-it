import * as React from "react";
import { icons } from "../../icons";
import type { ReaderImageViewerState } from "./PostContent";

type ImageViewerModalProps = {
  viewerState: ReaderImageViewerState;
  originRect: DOMRect | null;
  onClose: () => void;
};

/**
 * Image viewer modal with zoom, rotate, pan, and keyboard navigation.
 *
 * NOTE: This component is currently not wired into the live render path.
 * The active image viewer is rendered via the template path
 * (readerImageViewerTemplate + bindImageViewerActions in render.ts).
 * This component is kept as a future React migration target.
 *
 * framer-motion was removed; animations use CSS transitions.
 * Drag-to-pan uses native pointer events.
 */
export function ImageViewerModal({
  viewerState,
  onClose,
}: ImageViewerModalProps): React.ReactElement | null {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const [index, setIndex] = React.useState(viewerState.index);
  const [scale, setScale] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    setIndex(viewerState.index);
    setScale(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, [viewerState]);

  const resetImage = React.useCallback(() => {
    setScale(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, []);

  const changeImage = React.useCallback((delta: number) => {
    setIndex((prev) => {
      const next = prev + delta;
      if (next >= 0 && next < viewerState.items.length) {
        resetImage();
        return next;
      }
      return prev;
    });
  }, [viewerState.items.length, resetImage]);

  // Drag-to-pan via pointer events
  const dragStartRef = React.useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    setPan({
      x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.x),
      y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.y),
    });
  }, []);

  const handlePointerUp = React.useCallback(() => {
    dragStartRef.current = null;
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape": onClose(); break;
        case "ArrowLeft": changeImage(-1); break;
        case "ArrowRight": changeImage(1); break;
        case "ArrowUp": case "+": case "=": setScale((s) => Math.min(s * 1.25, 4)); break;
        case "ArrowDown": case "-": case "_": setScale((s) => Math.max(s / 1.25, 0.25)); break;
        case "r": case "R": setRotation((r) => r + 90); break;
        case "0": resetImage(); break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, changeImage, resetImage]);

  const currentItem = viewerState.items[index] || viewerState;
  const hasPrevious = index > 0;
  const hasNext = index < viewerState.items.length - 1;
  const showToolbar = viewerState.items.length > 0;

  return (
    <div
      className="ldcv-reader-image-viewer ldcv-reader-image-viewer--entering"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ldcv-reader-image-viewer__actions">
        {showToolbar && (
          <div className="ldcv-reader-image-viewer__toolbar" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="ldcv-icon-button" onClick={() => setScale((s) => Math.min(s * 1.25, 4))} title="放大" aria-label="放大" dangerouslySetInnerHTML={{ __html: icons.zoomIn }} />
            <button type="button" className="ldcv-icon-button" onClick={() => setScale((s) => Math.max(s / 1.25, 0.25))} title="缩小" aria-label="缩小" dangerouslySetInnerHTML={{ __html: icons.zoomOut }} />
            <button type="button" className="ldcv-icon-button" onClick={() => setRotation((r) => r + 90)} title="旋转" aria-label="旋转" dangerouslySetInnerHTML={{ __html: icons.rotate }} />
            <button type="button" className="ldcv-icon-button" onClick={resetImage} title="重置" aria-label="重置" dangerouslySetInnerHTML={{ __html: icons.refresh }} />
          </div>
        )}
        <button type="button" className="ldcv-icon-button ldcv-reader-image-viewer__close" onClick={onClose} title="关闭图片预览" aria-label="关闭图片预览">×</button>
      </div>

      {viewerState.items.length > 1 && (
        <div className="ldcv-reader-image-viewer__nav" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="ldcv-icon-button" disabled={!hasPrevious} onClick={() => changeImage(-1)} title="上一张图片" aria-label="上一张图片" dangerouslySetInnerHTML={{ __html: icons.previous }} />
          <span className="ldcv-reader-image-viewer__counter">{index + 1} / {viewerState.items.length}</span>
          <button type="button" className="ldcv-icon-button" disabled={!hasNext} onClick={() => changeImage(1)} title="下一张图片" aria-label="下一张图片" dangerouslySetInnerHTML={{ __html: icons.next }} />
        </div>
      )}

      <div
        className="ldcv-reader-image-viewer__stage"
        ref={stageRef}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        onWheel={(e) => {
          e.preventDefault();
          if (e.deltaY < 0) setScale((s) => Math.min(s * 1.1, 4));
          else if (e.deltaY > 0) setScale((s) => Math.max(s / 1.1, 0.25));
        }}
      >
        <img
          ref={imgRef}
          src={currentItem.src}
          alt={currentItem.alt || ""}
          className="ldcv-reader-image-viewer__image cursor-grab active:cursor-grabbing"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
            transition: dragStartRef.current ? "none" : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={() => setScale(scale > 1 ? 1 : 2)}
        />
      </div>
    </div>
  );
}
