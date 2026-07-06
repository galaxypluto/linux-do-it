import * as React from "react";
import type { ReaderModalPresentation } from "../../readerTemplates";
import { cn } from "../lib/cn";

export const READER_MODAL_CLOSE_MOTION_MS = 180;

type ReaderModalShellState = "entering" | "open" | "closing";

type ReaderModalShellProps = {
  backdropRef: React.RefObject<HTMLDivElement | null>;
  modalRef: React.RefObject<HTMLElement | null>;
  presentation: ReaderModalPresentation;
  closing: boolean;
  privateMessageComposeHost: boolean;
  modalStyle: React.CSSProperties | undefined;
  children: React.ReactNode;
  onBackdropClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onModalClick: (event: React.MouseEvent<HTMLElement>) => void;
};

export function ReaderModalShell({
  backdropRef,
  modalRef,
  presentation,
  closing,
  privateMessageComposeHost,
  modalStyle,
  children,
  onBackdropClick,
  onModalClick
}: ReaderModalShellProps): React.ReactElement {
  const entering = Boolean(presentation.entering && presentation.origin);
  const shellState = readerModalShellState({ entering, closing });

  return (
    <div
      ref={backdropRef}
      className={cn(
        "ldcv-reader-backdrop ldcv-reader-shell-backdrop fixed flex items-center justify-center",
        entering ? "is-entering" : "",
        closing ? "is-closing" : ""
      )}
      data-react-reader-modal="true"
      data-reader-backdrop=""
      data-reader-shell="backdrop"
      data-reader-shell-state={shellState}
      data-reader-compose-host={privateMessageComposeHost ? "true" : "false"}
      onClick={onBackdropClick}
    >
      <section
        ref={modalRef}
        className={cn(
          "ldcv-reader-modal ldcv-reader-shell min-w-0 overflow-hidden",
          entering ? "is-entering" : "",
          closing ? "is-closing" : ""
        )}
        data-reader-shell="surface"
        data-reader-shell-state={shellState}
        data-reader-template-mode="react"
        role="dialog"
        aria-modal="true"
        aria-label="话题阅读器"
        style={modalStyle}
        onClick={onModalClick}
      >
        {children}
      </section>
    </div>
  );
}

function readerModalShellState({
  entering,
  closing
}: {
  entering: boolean;
  closing: boolean;
}): ReaderModalShellState {
  if (closing) {
    return "closing";
  }

  if (entering) {
    return "entering";
  }

  return "open";
}
