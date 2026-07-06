import * as React from "react";
import type { TopicReaderPost } from "../../../discourse/types";
import type { ReaderPostAction, ReaderPostActionFeedback } from "../../readerTypes";
import { icons } from "../../icons";
import { cn } from "../lib/cn";
import { isPendingPostAction, readerPostActionLabel } from "../../readerTemplates";

type PostActionProps = {
  action: ReaderPostAction;
  post: TopicReaderPost;
  primary?: boolean;
  actionFeedback?: ReaderPostActionFeedback | null;
  className?: string;
  /**
   * Click handler owned by React. Required when rendered inside the React
   * Reader modal — the legacy root-scoped binder is skipped for React-owned
   * elements to prevent listener accumulation (429 from duplicate API calls).
   */
  onAction?: (action: ReaderPostAction, postNumber: number) => void;
};

export function PostAction({ action, post, primary = false, actionFeedback = null, className, onAction }: PostActionProps) {
  const pending = isPendingPostAction(actionFeedback, action, post.postNumber);

  let title = "";
  let iconHtml = "";
  let active = false;
  let disabled = false;

  if (action === "reply") {
    disabled = post.actions.canReply === false;
    title = disabled ? "当前账号无法回复" : "开始撰写对此帖子的回复";
    iconHtml = icons.reply;
  } else if (action === "like") {
    active = post.actions.liked === true;
    disabled = post.actions.canLike === false && !active;
    title = active ? "取消点赞" : disabled ? "当前账号无法点赞" : "点赞此帖子";
    iconHtml = active ? icons.heart : icons.heartOutline;
  } else if (action === "bookmark") {
    active = post.actions.bookmarked === true;
    disabled = false;
    title = active ? "取消书签" : "添加书签";
    iconHtml = active ? icons.bookmark : icons.bookmarkOutline;
  }

  const finalTitle = pending ? `${readerPostActionLabel(action)}处理中...` : title;
  const finalDisabled = disabled || pending;

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (finalDisabled) return;
      e.preventDefault();
      e.stopPropagation();
      onAction?.(action, post.postNumber);
    },
    [finalDisabled, onAction, action, post.postNumber]
  );

  return (
    <button
      type="button"
      className={cn(
        "ldcv-reader-action-button transition-transform duration-150",
        "hover:scale-105 active:scale-95",
        primary ? "ldcv-reader-action-button--primary" : "",
        `ldcv-reader-action-button--${action}`,
        active ? "is-active text-red-500 ldcv-reader-action-button--pop" : "text-gray-500 hover:text-gray-700",
        pending ? "is-pending opacity-50 cursor-wait" : "",
        finalDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer transition-colors",
        className
      )}
      data-reader-post-action={action}
      data-reader-post-number={post.postNumber}
      title={finalTitle}
      aria-label={finalTitle}
      aria-pressed={action === "like" || action === "bookmark" ? active : undefined}
      disabled={finalDisabled}
      onClick={handleClick}
    >
      <span
        className="ldcv-reader-action-button__icon w-5 h-5 flex items-center justify-center"
        dangerouslySetInnerHTML={{ __html: iconHtml }}
      />
    </button>
  );
}
