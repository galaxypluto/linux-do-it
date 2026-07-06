import * as React from "react";
import type { TopicCardData } from "../../../discourse/types";
import type { ReaderImageViewerState } from "../../imageViewer";
import {
  readerModalOriginStyleVars,
  type ReaderModalPresentation,
  type ReaderTemplateSettings,
} from "../../readerTemplates";
import type { ReaderPostAction, ReaderState } from "../../readerTypes";
import type { ReaderUserPreviewState } from "../../userPreview";
import { READER_MODAL_CLOSE_MOTION_MS, ReaderModalShell } from "./ReaderModalShell";
import { ReaderContent } from "./ReaderContent";

/**
 * Reader modal shell. All states (idle, loading, error, loaded) render through
 * `<ReaderContent />`. The legacy template string path has been retired.
 *
 * Note: the idle state (no topicId) never reaches here because
 * `renderReactReaderModal` returns early when `reader.topicId` is unset.
 */

type ReaderModalProps = {
  reader: ReaderState;
  topics: TopicCardData[];
  settings: ReaderTemplateSettings;
  presentation: ReaderModalPresentation;
  privateMessageComposeHost: boolean;
  onCloseReader: () => void;
  onReaderBackdropClick: () => void;
  onRefreshReader?: () => void;
  onReaderAdjacent?: (direction: 1 | -1) => void;
  onNativePostAction?: (action: ReaderPostAction, postNumber: number) => void;
  onOpenUserPreview?: (preview: ReaderUserPreviewState) => void;
  onCloseUserPreview?: () => void;
  onOpenReaderImage?: (image: ReaderImageViewerState) => void;
  onCloseReaderImage?: () => void;
  onLoadMoreReaderPosts?: () => void;
};

export function ReaderModal({
  reader,
  topics,
  settings,
  presentation,
  privateMessageComposeHost,
  onCloseReader,
  onReaderBackdropClick,
  onRefreshReader,
  onReaderAdjacent,
  onOpenUserPreview,
  onCloseUserPreview,
  onOpenReaderImage,
  onLoadMoreReaderPosts,
  onNativePostAction
}: ReaderModalProps): React.ReactElement {
  const [closing, setClosing] = React.useState(false);
  const closeStartedRef = React.useRef(false);
  const backdropRef = React.useRef<HTMLDivElement | null>(null);
  const modalRef = React.useRef<HTMLElement | null>(null);
  const closeTimerRef = React.useRef<number | undefined>(undefined);
  const modalStyle = React.useMemo<React.CSSProperties | undefined>(
    () => (presentation.origin ? (readerModalOriginStyleVars(presentation.origin) as React.CSSProperties) : undefined),
    [presentation.origin]
  );

  React.useEffect(() => {
    closeStartedRef.current = false;
    setClosing(false);
  }, [reader.topicId]);

  React.useEffect(
    () => () => {
      if (closeTimerRef.current !== undefined) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    []
  );

  const requestClose = React.useCallback((complete: () => void) => {
    if (closeStartedRef.current) {
      return;
    }

    const backdrop = backdropRef.current;
    const modal = modalRef.current;
    if (!backdrop || !modal || !supportsElementMotion(modal)) {
      complete();
      return;
    }

    closeStartedRef.current = true;
    setClosing(true);
    backdrop.classList.add("is-closing");
    modal.classList.add("is-closing");
    backdrop.dataset.readerShellState = "closing";
    modal.dataset.readerShellState = "closing";

    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: READER_MODAL_CLOSE_MOTION_MS,
      easing: "ease-out"
    });

    const modalAnimation = modal.animate(
      [
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
        { opacity: 0, transform: "translate3d(0, -10px, 0) scale(0.965)" }
      ],
      {
        duration: READER_MODAL_CLOSE_MOTION_MS,
        easing: "ease-out"
      }
    );
    let finished = false;
    const finish = (): void => {
      if (finished) {
        return;
      }
      finished = true;
      if (closeTimerRef.current !== undefined) {
        window.clearTimeout(closeTimerRef.current);
      }
      closeTimerRef.current = undefined;
      complete();
    };
    closeTimerRef.current = window.setTimeout(finish, READER_MODAL_CLOSE_MOTION_MS + 40);
    modalAnimation.onfinish = finish;
  }, []);

  const handleBackdropClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (privateMessageComposeHost) {
        onReaderBackdropClick();
        return;
      }
      requestClose(onReaderBackdropClick);
    },
    [onReaderBackdropClick, privateMessageComposeHost, requestClose]
  );

  const handleModalClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("[data-action='close-reader']")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      requestClose(onCloseReader);
    },
    [onCloseReader, requestClose]
  );

  return (
    <ReaderModalShell
      backdropRef={backdropRef}
      modalRef={modalRef}
      presentation={presentation}
      closing={closing}
      privateMessageComposeHost={privateMessageComposeHost}
      modalStyle={modalStyle}
      onBackdropClick={handleBackdropClick}
      onModalClick={handleModalClick}
    >
      <ReaderContent
        reader={reader}
        topics={topics}
        settings={settings}
        variant="modal"
        onClose={onCloseReader}
        onOpenUserPreview={onOpenUserPreview}
        onCloseUserPreview={onCloseUserPreview}
        onRefreshReader={onRefreshReader}
        onReaderAdjacent={onReaderAdjacent}
        onNativePostAction={onNativePostAction}
        onLoadMoreReaderPosts={onLoadMoreReaderPosts}
        onOpenReaderImage={
          onOpenReaderImage
            ? (image) => {
                onOpenReaderImage({
                  src: image.src,
                  alt: image.alt ?? "",
                  originalUrl: image.originalUrl ?? image.src,
                  items: image.items.map((item) => ({
                    src: item.src,
                    alt: item.alt ?? "",
                    originalUrl: item.originalUrl ?? item.src
                  })),
                  index: image.index,
                  scale: 1,
                  rotation: 0
                });
              }
            : undefined
        }
      />
    </ReaderModalShell>
  );
}

function supportsElementMotion(element: HTMLElement): boolean {
  return typeof element.animate === "function" && !prefersReducedMotion();
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
