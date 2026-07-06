import * as React from "react";
import type { ReaderUserPreviewState } from "../../userPreview";
import type { UserPreviewTarget } from "../../replies";
import { escapeAttribute, escapeHtml } from "../../html";
import { icons } from "../../icons";

type UserPreviewProps = {
  target: UserPreviewTarget;
  preview: ReaderUserPreviewState;
  onClose: () => void;
  onPrivateMessage?: () => void;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

/**
 * Renders the user preview hover card.
 *
 * Mirrors `userPreviewTemplate(...)` in userPreview.ts exactly so that
 * reader.css selectors (`.ldcv-user-preview`, `.ldcv-user-preview__body`,
 * `.ldcv-user-preview__close`, `.ldcv-user-preview__actions`, etc.) apply.
 * Uses data-action attributes + React onClick for event handling.
 */
export function UserPreview({ target, preview, onClose, onPrivateMessage }: UserPreviewProps) {
  const profile = preview.profile;
  const username = profile?.username || target.username;
  const name = profile?.name || target.name || username;
  const avatarUrl = profile?.avatarUrl || target.avatarUrl;
  const profileUrl = profile?.profileUrl || target.href;
  const canMessage = profile?.canMessage ?? true;
  const joined = profile?.joinedAt ? formatDate(profile.joinedAt) : "";
  const joinedLabel = preview.loading ? "读取中" : preview.error ? "不可用" : joined || "暂无";
  const marker = (name || username).trim().slice(0, 1).toUpperCase() || "L";

  return (
    <aside
      className="ldcv-user-preview"
      role="dialog"
      aria-label="用户预览"
      style={preview.offsetLeft !== undefined ? { left: preview.offsetLeft } : undefined}
    >
      <button
        type="button"
        className="ldcv-user-preview__close"
        data-action="close-user-preview"
        title="关闭预览"
        aria-label="关闭预览"
      >×</button>
      <div className="ldcv-user-preview__body">
        {avatarUrl ? (
          <img src={escapeAttribute(avatarUrl)} alt="" loading="lazy" />
        ) : (
          <span className="ldcv-reader-author__mark" aria-hidden="true">{marker}</span>
        )}
        <div>
          <strong>{escapeHtml(name)}</strong>
          <span>@{escapeHtml(username)}</span>
        </div>
        <div className="ldcv-user-preview__quick">
          <a className="ldcv-user-preview__home" href={escapeAttribute(profileUrl)} target="_blank" rel="noopener noreferrer">主页</a>
          <span className="ldcv-user-preview__joined">加入日期 {escapeHtml(joinedLabel)}</span>
        </div>
      </div>
      <div className="ldcv-user-preview__actions">
        {canMessage ? (
          <button
            type="button"
            className="ldcv-user-preview__button"
            data-action="private-message"
          >
            <span dangerouslySetInnerHTML={{ __html: icons.reply }} />
            <span>私信</span>
          </button>
        ) : (
          <span className="ldcv-user-preview__button is-disabled">
            <span dangerouslySetInnerHTML={{ __html: icons.reply }} />
            <span>私信</span>
          </span>
        )}
      </div>
    </aside>
  );
}
