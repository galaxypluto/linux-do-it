import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { TopicCardData } from "../../../discourse/types";
import type { ReaderTemplateSettings } from "../../readerTemplates";
import type { ReaderPostAction, ReaderState } from "../../readerTypes";
import { ReaderContent } from "./ReaderContent";

const readerPaneRoots = new WeakMap<ShadowRoot, Root>();

export type RenderReaderPaneOptions = {
  root: ShadowRoot;
  reader: ReaderState;
  topics: TopicCardData[];
  settings: ReaderTemplateSettings;
  onClose: () => void;
  onOpenUserPreview?: (previewTarget: any) => void;
  onCloseUserPreview?: () => void;
  onRefreshReader?: () => void;
  onReaderAdjacent?: (direction: 1 | -1) => void;
  onNativePostAction?: (action: ReaderPostAction, postNumber: number) => void;
  onOpenReaderImage?: (image: any) => void;
  onLoadMoreReaderPosts?: () => void;
};

export function unmountReactReaderPane(root: ShadowRoot): void {
  const existingRoot = readerPaneRoots.get(root);
  if (!existingRoot) {
    return;
  }
  flushSync(() => existingRoot.unmount());
  readerPaneRoots.delete(root);
}

export function renderReactReaderPane(options: RenderReaderPaneOptions): void {
  const host = options.root.querySelector<HTMLElement>("[data-react-reader-pane-host]");
  if (!host) {
    return;
  }

  let reactRoot = readerPaneRoots.get(options.root);
  if (!reactRoot) {
    reactRoot = createRoot(host);
    readerPaneRoots.set(options.root, reactRoot);
  }

  flushSync(() => {
    reactRoot.render(
      createElement(ReaderContent, {
        reader: options.reader,
        topics: options.topics,
        settings: options.settings,
        variant: "pane",
        onClose: options.onClose,
        onOpenUserPreview: options.onOpenUserPreview,
        onCloseUserPreview: options.onCloseUserPreview,
        onRefreshReader: options.onRefreshReader,
        onReaderAdjacent: options.onReaderAdjacent,
        onNativePostAction: options.onNativePostAction,
        onOpenReaderImage: options.onOpenReaderImage
          ? (image: any) => {
              options.onOpenReaderImage!({
                src: image.src,
                alt: image.alt ?? "",
                originalUrl: image.originalUrl ?? image.src,
                items: (image.items ?? []).map((item: any) => ({
                  src: item.src,
                  alt: item.alt ?? "",
                  originalUrl: item.originalUrl ?? item.src
                })),
                index: image.index,
                scale: 1,
                rotation: 0
              });
            }
          : undefined,
        onLoadMoreReaderPosts: options.onLoadMoreReaderPosts
      })
    );
  });
}
