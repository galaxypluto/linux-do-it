import * as React from "react";
import type { TopicReaderPost, TopicReplyNode } from "../../../discourse/types";
import type { ReaderState, ReaderPostActionFeedback, ReaderPostAction } from "../../readerTypes";
import type { ReaderUserPreviewState } from "../../userPreview";
import type { ExtensionSettings } from "../../../storage/settings";
import { flattenReplyChildren, replyTargetForPost } from "../../replies";
import { CommentItem } from "./CommentItem";
import type { ReaderImageViewerState } from "../components/PostContent";

type CommentListProps = {
  sortedTree: TopicReplyNode[];
  postIndex: Map<number, TopicReaderPost>;
  reader: ReaderState;
  settings: Pick<ExtensionSettings, "commentSortOrder" | "collapseLongComments" | "topicUrlView">;
  activePreview: ReaderUserPreviewState | null;
  actionFeedback: ReaderPostActionFeedback | null;
  freshPostNumbers: ReadonlySet<number>;
  animatePostNumbers: ReadonlySet<number>;
  scrollElement: HTMLDivElement | null;
  onOpenUserPreview?: (previewTarget: any) => void;
  onCloseUserPreview?: () => void;
  onNativePostAction?: (action: ReaderPostAction, postNumber: number) => void;
  onOpenReaderImage?: (image: ReaderImageViewerState, origin: DOMRect) => void;
  onBoostAdded?: () => void;
};

/**
 * Renders the comment tree. The reply relationship, @-anchor, and sort logic
 * live in `replies.ts` (`flattenReplyChildren`, `sortReplyNodes`) and are
 * preserved exactly. This component only owns the DOM structure, mirroring
 * the legacy `replyThreadTemplate` + `replyItemTemplate`:
 *
 * - Thread root at level 0, replies flattened to level 1 (two-level tree).
 * - All comments render to the DOM (no virtualization) so the legacy
 *   `bindReaderCommentFilters` imperative filter (toggle `comment.hidden`)
 *   and scroll anchors survive.
 * - Expand/collapse is CSS-driven via `is-expanded`/`is-collapsed` classes.
 */
export function CommentList({
  sortedTree,
  postIndex,
  settings,
  activePreview,
  actionFeedback,
  freshPostNumbers,
  animatePostNumbers,
  onOpenUserPreview,
  onCloseUserPreview,
  onNativePostAction,
  onOpenReaderImage,
  onBoostAdded
}: CommentListProps): React.ReactElement {
  if (sortedTree.length === 0) {
    return <div className="ldcv-reader-note">当前已载入内容里还没有评论。</div>;
  }

  let globalIndex = 0;

  return (
    <div className="ldcv-reader-thread__list">
      {sortedTree.map((node) => {
        const rootTarget = replyTargetForPost(node.post, postIndex);
        const replies = flattenReplyChildren(node, postIndex, settings.commentSortOrder);
        const rootIndex = globalIndex++;
        return (
          <React.Fragment key={node.post.id}>
            <CommentItem
              post={node.post}
              level={0}
              index={rootIndex}
              isFresh={freshPostNumbers.has(node.post.postNumber)}
              shouldAnimate={animatePostNumbers.has(node.post.postNumber)}
              initialExpanded={!settings.collapseLongComments}
              target={rootTarget}
              authorTarget={replyTargetForPost(node.post, postIndex)}
              activePreview={activePreview}
              actionFeedback={actionFeedback}
              onOpenUserPreview={onOpenUserPreview}
              onCloseUserPreview={onCloseUserPreview}
              onNativePostAction={onNativePostAction}
              onOpenReaderImage={onOpenReaderImage}
              topicUrlView={settings.topicUrlView}
              onBoostAdded={onBoostAdded}
            />
            {replies.length > 0 && (
              <div className="ldcv-reader-replies">
                {replies.map((reply) => {
                  const replyIndex = globalIndex++;
                  return (
                    <CommentItem
                      key={reply.node.post.id}
                      post={reply.node.post}
                      level={1}
                      index={replyIndex}
                      isFresh={freshPostNumbers.has(reply.node.post.postNumber)}
                      shouldAnimate={animatePostNumbers.has(reply.node.post.postNumber)}
                      initialExpanded={!settings.collapseLongComments}
                      target={reply.target}
                      authorTarget={replyTargetForPost(reply.node.post, postIndex)}
                      activePreview={activePreview}
                      actionFeedback={actionFeedback}
                      onOpenUserPreview={onOpenUserPreview}
                      onCloseUserPreview={onCloseUserPreview}
                      onNativePostAction={onNativePostAction}
                      onOpenReaderImage={onOpenReaderImage}
                      topicUrlView={settings.topicUrlView}
                      onBoostAdded={onBoostAdded}
                    />
                  );
                })}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
