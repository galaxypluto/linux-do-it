import * as React from "react";
import type { TopicReaderPost } from "../../../domain/linuxdo/types";

export type ReaderImageViewerItem = {
  src: string;
  originalUrl?: string;
  alt?: string;
};

export type ReaderImageViewerState = ReaderImageViewerItem & {
  items: ReaderImageViewerItem[];
  index: number;
};

type PostContentProps = {
  post: TopicReaderPost;
  /**
   * Image clicks are handled by the legacy root-scoped binder in
   * `bindReaderModalActions` (`[data-reader-image-link]` /
   * `img.ldcv-reader-image`), which works on both template-rendered and
   * React-rendered prose. PostContent only owns the prose container.
   */
  onOpenReaderImage?: (image: ReaderImageViewerState, origin: DOMRect) => void;
};

export function PostContent({ post }: PostContentProps): React.ReactElement {
  return (
    <div
      className="ldcv-reader-prose"
      dangerouslySetInnerHTML={{ __html: post.html || "<p>这个帖子暂时没有可预览正文。</p>" }}
    />
  );
}
