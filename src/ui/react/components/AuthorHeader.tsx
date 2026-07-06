import * as React from "react";
import type { TopicReaderAuthor } from "../../../domain/linuxdo/types";
import { relativeTime } from "../../format";
import { escapeHtml, escapeAttribute } from "../../html";
import { profileUrlForUsername } from "../../readerTemplates";
import type { ReplyTarget } from "../../replies";
import { UserPreview } from "./UserPreview";
import type { ReaderUserPreviewState } from "../../userPreview";

type AuthorHeaderProps = {
  author: TopicReaderAuthor;
  createdAt: string;
  isOriginalPoster?: boolean;
  replyTarget?: ReplyTarget | null;
  postNumber?: number;
  interactive?: boolean;
  activePreview?: ReaderUserPreviewState | null;
  onOpenUserPreview?: (previewTarget: any) => void;
  onCloseUserPreview?: () => void;
  trailing?: React.ReactNode;
};

export function authorDisplayName(author: TopicReaderAuthor): string {
  return author.name || author.username || "Linux.do 用户";
}

/**
 * Renders the author block for a Reader post (main-post header or comment).
 *
 * The DOM structure mirrors `authorTemplate(...)` in readerTemplates.ts exactly
 * so that reader.css selectors (`.ldcv-reader-author`, `.ldcv-reader-author__name`,
 * `.ldcv-op-badge`, `.ldcv-reader-reply-target.mention`) apply correctly.
 *
 * User-preview click handling is owned by a root-level event delegation
 * listener in render.ts (bindReaderUserPreviewDelegation), which finds
 * anchors via [data-reader-user-preview] and is idempotent across re-renders.
 * This component only emits the data-* attributes; it does not attach its
 * own onClick.
 */
export function AuthorHeader({
  author,
  createdAt,
  isOriginalPoster = false,
  replyTarget = null,
  postNumber = 0,
  interactive = true,
  activePreview = null,
  onOpenUserPreview,
  onCloseUserPreview,
  trailing = null,
}: AuthorHeaderProps): React.ReactElement {
  const authorName = authorDisplayName(author);
  const marker = (author.username || authorName).trim().slice(0, 1).toUpperCase() || "L";

  const showAuthorPreview = activePreview?.anchorType === "author" && activePreview?.postNumber === postNumber;
  const showReplyPreview = activePreview?.anchorType === "reply-target" && activePreview?.postNumber === postNumber;

  const authorNameHtml = interactive && author.username ? (
    <a
      className="ldcv-reader-author__name"
      href={profileUrlForUsername(author.username)}
      data-reader-user-preview="true"
      data-reader-preview-anchor="author"
      data-reader-username={author.username}
      data-reader-name={authorName}
      data-reader-avatar-url={author.avatarUrl}
      data-reader-post-number={postNumber}
      data-reader-anchor-post-number={postNumber}
      data-user-card={author.username}
    >
      {authorName}
    </a>
  ) : (
    <span className="ldcv-reader-author__name ldcv-reader-author__name--static">{escapeHtml(authorName)}</span>
  );

  const opGroupHtml = isOriginalPoster ? (
    <span className="ldcv-reader-author__op-group">
      <em className="ldcv-op-badge">OP</em>
    </span>
  ) : null;

  const replyTargetHtml = replyTarget ? (
    <em className="ldcv-reader-reply-target mention">
      @{replyTarget.label}
    </em>
  ) : null;

  return (
    <div className="ldcv-reader-author">
      {author.avatarUrl ? (
        <img src={author.avatarUrl} alt="" loading="lazy" />
      ) : (
        <span className="ldcv-reader-author__mark" aria-hidden="true">{marker}</span>
      )}
      <div>
        <span className="ldcv-reader-author__identity">
          {authorNameHtml}
          {opGroupHtml}
          {trailing}
          {showAuthorPreview && activePreview && (
            <UserPreview
              target={{
                username: author.username,
                name: authorName,
                avatarUrl: author.avatarUrl,
                postNumber,
                label: authorName,
                href: profileUrlForUsername(author.username)
              }}
              preview={activePreview}
              onClose={onCloseUserPreview || (() => {})}
            />
          )}
          {replyTargetHtml}
          {showReplyPreview && activePreview && replyTarget && (
            <UserPreview target={replyTarget} preview={activePreview} onClose={onCloseUserPreview || (() => {})} />
          )}
        </span>
        <time>{relativeTime(createdAt)}</time>
      </div>
    </div>
  );
}
