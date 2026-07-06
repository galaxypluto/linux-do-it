import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { TopicCardData } from "../../../discourse/types";
import type { ReaderTemplateSettings, ReaderModalPresentation } from "../../readerTemplates";
import type { ReaderImageViewerState } from "../../imageViewer";
import type { ReaderState, ReaderPostAction } from "../../readerTypes";
import { ReaderModal } from "./ReaderModal";

const readerModalRoots = new WeakMap<ShadowRoot, Root>();

export type RenderReaderModalOptions = {
  root: ShadowRoot;
  reader: ReaderState;
  topics: TopicCardData[];
  settings: ReaderTemplateSettings;
  presentation: ReaderModalPresentation;
  privateMessageComposeHost: boolean;
  onCloseReader: () => void;
  onReaderBackdropClick: () => void;
  onRefreshReader?: () => void;
  onReaderAdjacent?: (direction: 1 | -1) => void;
  onNativePostAction: (action: ReaderPostAction, postNumber: number) => void;
  onOpenUserPreview: (previewTarget: any) => void;
  onCloseUserPreview: () => void;
  onOpenReaderImage: (image: ReaderImageViewerState) => void;
  onCloseReaderImage: () => void;
  onLoadMoreReaderPosts: () => void;
};

export function unmountReactReaderModal(root: ShadowRoot): void {
  const existingRoot = readerModalRoots.get(root);
  if (!existingRoot) {
    return;
  }

  flushSync(() => existingRoot.unmount());
  readerModalRoots.delete(root);
}

export function renderReactReaderModal(options: RenderReaderModalOptions): void {
  const host = options.root.querySelector<HTMLElement>("[data-react-reader-modal-host]");
  if (!host || !options.reader.topicId) {
    return;
  }

  let reactRoot = readerModalRoots.get(options.root);
  if (!reactRoot) {
    reactRoot = createRoot(host);
    readerModalRoots.set(options.root, reactRoot);
  }

  flushSync(() => {
    reactRoot.render(
      <ReaderModal
        reader={options.reader}
        topics={options.topics}
        settings={options.settings}
        presentation={options.presentation}
        privateMessageComposeHost={options.privateMessageComposeHost}
        onCloseReader={options.onCloseReader}
        onReaderBackdropClick={options.onReaderBackdropClick}
        onRefreshReader={options.onRefreshReader}
        onReaderAdjacent={options.onReaderAdjacent}
        onNativePostAction={options.onNativePostAction}
        onOpenUserPreview={options.onOpenUserPreview}
        onCloseUserPreview={options.onCloseUserPreview}
        onOpenReaderImage={options.onOpenReaderImage}
        onCloseReaderImage={options.onCloseReaderImage}
        onLoadMoreReaderPosts={options.onLoadMoreReaderPosts}
      />
    );
  });
}
