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
  topicUrlView = "classic"
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

          <div className="ldcv-reader-comment__tools">
            <PostAction action="like" post={post} actionFeedback={actionFeedback} onAction={onNativePostAction} />
            <PostAction action="reply" post={post} actionFeedback={actionFeedback} onAction={onNativePostAction} />

            <a
              href={escapeAttribute(preferredTopicUrl(post.url, topicUrlView))}
              target="_blank"
              rel="noopener noreferrer"
            >
              #{post.postNumber}
            </a>

            {isFresh && <span className="ldcv-reader-new-badge" title="本次刷新新增">new</span>}

            {post.stats.likes > 0 && (
              <span>
                <span dangerouslySetInnerHTML={{ __html: icons.heart }} />
                {compactNumber(post.stats.likes)}
              </span>
            )}

            <button
              type="button"
              className="ldcv-reader-comment__toggle"
              data-action="toggle-comment"
              title={initialExpanded ? "收起评论" : "展开评论"}
              aria-label={initialExpanded ? "收起评论" : "展开评论"}
              aria-expanded={initialExpanded}
              dangerouslySetInnerHTML={{ __html: icons.chevronDown }}
            />
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
