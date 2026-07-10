import * as React from "react";
import type { TopicReaderPost } from "../../../discourse/types";
import type { ReaderPostActionFeedback, ReaderPostAction } from "../../readerTypes";
import type { ReaderUserPreviewState } from "../../userPreview";
import type { ReplyTarget } from "../../replies";
import { icons } from "../../icons";
import { compactNumber } from "../../format";
import { cn } from "../lib/cn";
import { postActionFeedbackTemplate, preferredTopicUrl } from "../../readerTemplates";
import type { TopicUrlView } from "../../../domain/linuxdo/urls";
import { escapeAttribute } from "../../html";
import { AuthorHeader } from "../components/AuthorHeader";
import { PostAction } from "../components/PostAction";
import { PostContent, type ReaderImageViewerState } from "../components/PostContent";
import { BoostToolbarAction } from "../components/BoostToolbarAction";

type CommentItemProps = {
  post: TopicReaderPost;
  level: 0 | 1;
  index?: number;
  isFresh: boolean;
  shouldAnimate: boolean;
  initialExpanded: boolean;
  target: ReplyTarget | null;
  authorTarget: ReplyTarget | null;
  activePreview: ReaderUserPreviewState | null;
  actionFeedback: ReaderPostActionFeedback | null;
  onOpenUserPreview?: (previewTarget: any) => void;
  onCloseUserPreview?: () => void;
  onNativePostAction?: (action: ReaderPostAction, postNumber: number) => void;
  onOpenReaderImage?: (image: ReaderImageViewerState, origin: DOMRect) => void;
  topicUrlView?: TopicUrlView;
  onBoostAdded?: () => void;
};

export function CommentItem({
  post,
  level,
  index,
  isFresh,
  shouldAnimate,
  initialExpanded,
  target,
  authorTarget,
  activePreview,
  actionFeedback,
  onOpenUserPreview,
  onCloseUserPreview,
  onNativePostAction,
  onOpenReaderImage,
  topicUrlView = "classic",
  onBoostAdded
}: CommentItemProps): React.ReactElement {
  // Expand/collapse is owned by root-level event delegation
  // (bindReaderToggleCommentDelegation in render.ts), which toggles the
  // .is-expanded/.is-collapsed classes directly. React renders the initial
  // state; the delegation handler toggles in place. This avoids both
  // listener accumulation and the React+shadowDOM+jsdom synthetic event gap.
  const feedbackHtml = React.useMemo(
    () => postActionFeedbackTemplate(actionFeedback, post.postNumber),
    [actionFeedback, post.postNumber]
  );

  const [animating, setAnimating] = React.useState(shouldAnimate);
  const [boostEditorOpen, setBoostEditorOpen] = React.useState(false);

  React.useEffect(() => {
    if (!shouldAnimate) {
      return;
    }

    setAnimating(true);
    const totalDelay = (Math.min(index ?? 0, 10) * 40) + 450;
    const timer = window.setTimeout(() => {
      setAnimating(false);
    }, totalDelay);
    return () => window.clearTimeout(timer);
  }, [index, shouldAnimate]);

  const style = React.useMemo(() => {
    if (typeof index === "number") {
      return {
        "--ldcv-enter-delay": `${Math.min(index, 10) * 40}ms`
      } as React.CSSProperties;
    }
    return undefined;
  }, [index]);

  React.useEffect(() => {
    const article = document.getElementById(`ldcv-post-${post.postNumber}`);
    const content = article?.querySelector<HTMLElement>(".ldcv-reader-comment__content");
    if (!article || !content || !article.classList.contains("is-expanded") || article.classList.contains("is-animating")) {
      return;
    }
    content.style.removeProperty("max-height");
  }, [post.postNumber, post.html, initialExpanded, animating]);

  const contentRef = React.useCallback((node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }
    const comment = node.closest<HTMLElement>(".ldcv-reader-comment");
    if (comment?.classList.contains("is-expanded") && !comment.classList.contains("is-animating")) {
      node.style.removeProperty("max-height");
    }
  }, [post.postNumber, post.html, initialExpanded]);

  return (
    <article
      className={cn(
        "ldcv-reader-comment",
        animating ? "ldcv-blur-fade-in" : "",
        initialExpanded ? "is-expanded" : "is-collapsed",
        isFresh ? "is-fresh" : ""
      )}
      style={style}
      data-depth={level}
      data-post-number={post.postNumber}
      data-original-poster={post.isOriginalPoster ? "true" : "false"}
      id={`ldcv-post-${post.postNumber}`}
    >
      <div className="ldcv-reader-comment__body">
        <header className="ldcv-reader-comment__head">
          <div className="ldcv-reader-comment__identity">
            <AuthorHeader
              author={post.author}
              createdAt={post.createdAt}
              isOriginalPoster={post.isOriginalPoster}
              replyTarget={target}
              postNumber={post.postNumber}
              interactive={true}
              activePreview={activePreview}
              onOpenUserPreview={onOpenUserPreview}
              onCloseUserPreview={onCloseUserPreview}
            />
          </div>

          <div className="ldcv-reader-comment__tools flex items-center justify-end gap-4 sm:gap-6">
            {/* Metadata Group */}
            <div className="flex items-center gap-3 text-xs text-gray-500/80">
              {isFresh && <span className="ldcv-reader-new-badge" title="本次刷新新增">new</span>}
              {post.stats.likes > 0 && (
                <span className="flex items-center gap-1">
                  <span dangerouslySetInnerHTML={{ __html: icons.heart }} className="w-3 h-3 flex items-center justify-center [&>svg]:w-3 [&>svg]:h-3" />
                  {compactNumber(post.stats.likes)}
                </span>
              )}
              <a
                href={escapeAttribute(preferredTopicUrl(post.url, topicUrlView))}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-700 transition-colors"
              >
                #{post.postNumber}
              </a>
            </div>

            {/* Actions Group with Progressive Disclosure；Boost 编辑器打开时强制全显，避免胶囊被 opacity 压暗 */}
            <div
              className={cn(
                "flex items-center gap-1 transition-opacity duration-300",
                boostEditorOpen ? "opacity-100" : "opacity-60 hover:opacity-100"
              )}
            >
              {(!post.boosts || post.boosts.length === 0) && post.actions?.canBoost === true && (
                <BoostToolbarAction
                  postId={post.id}
                  onBoostAdded={onBoostAdded}
                  variant="ghost"
                  onOpenChange={setBoostEditorOpen}
                />
              )}
              <PostAction action="like" post={post} actionFeedback={actionFeedback} onAction={onNativePostAction} />
              <PostAction action="reply" post={post} actionFeedback={actionFeedback} onAction={onNativePostAction} />
              <PostAction action="flag" post={post} actionFeedback={actionFeedback} onAction={onNativePostAction} />

              <button
                type="button"
                className={cn(
                  "ldcv-reader-comment__toggle flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200 cursor-pointer !bg-transparent !p-0 !min-h-0 !border-none",
                  "hover:bg-gray-100/80 dark:hover:bg-white/10 active:scale-95 text-gray-500 hover:text-gray-700"
                )}
                data-action="toggle-comment"
                title={initialExpanded ? "收起评论" : "展开评论"}
                aria-label={initialExpanded ? "收起评论" : "展开评论"}
                aria-expanded={initialExpanded}
              >
                <span className="w-4 h-4 flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4" dangerouslySetInnerHTML={{ __html: icons.chevronDown }} />
              </button>
            </div>
          </div>
        </header>

        {feedbackHtml && <div dangerouslySetInnerHTML={{ __html: feedbackHtml }} />}

        {/* Content stays in the DOM; visibility is CSS-driven via the
            is-expanded/is-collapsed class on the article, matching the
            legacy template's behavior so toggle state and scroll anchors
            survive re-renders. PostContent renders its own .ldcv-reader-prose. */}
        <div className="ldcv-reader-comment__content" ref={contentRef}>
          <PostContent post={post} onOpenReaderImage={onOpenReaderImage} />
        </div>
      </div>
    </article>
  );
}
