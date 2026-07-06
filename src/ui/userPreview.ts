import type { ReaderUserProfileData } from "../discourse/types";
import { escapeAttribute, escapeHtml } from "./html";
import { icons } from "./icons";
import type { UserPreviewTarget } from "./replies";

export interface ReaderUserPreviewState {
  username: string;
  name: string;
  avatarUrl: string;
  href: string;
  postNumber: number;
  anchorPostNumber: number;
  anchorType: "author" | "reply-target";
  loading: boolean;
  error: string;
  profile: ReaderUserProfileData | null;
  offsetLeft?: number;
}

export function previewMatches(
  preview: ReaderUserPreviewState | null,
  target: UserPreviewTarget | null,
  anchorPostNumber: number,
  anchorType: ReaderUserPreviewState["anchorType"]
): boolean {
  return Boolean(
    preview &&
      target?.username &&
      preview.username === target.username &&
      preview.postNumber === target.postNumber &&
      preview.anchorPostNumber === anchorPostNumber &&
    preview.anchorType === anchorType
  );
}

export function sameUserPreviewAnchor(left: ReaderUserPreviewState, right: ReaderUserPreviewState): boolean {
  return (
    left.username === right.username &&
    left.postNumber === right.postNumber &&
    left.anchorPostNumber === right.anchorPostNumber &&
    left.anchorType === right.anchorType
  );
}

export function userPreviewTemplate(target: UserPreviewTarget, preview: ReaderUserPreviewState): string {
  const profile = preview.profile;
  const username = profile?.username || target.username;
  const name = profile?.name || target.name || username;
  const avatarUrl = profile?.avatarUrl || target.avatarUrl;
  const profileUrl = profile?.profileUrl || target.href;
  const canMessage = profile?.canMessage ?? true;
  const joined = profile?.joinedAt ? formatDate(profile.joinedAt) : "";
  const joinedLabel = preview.loading ? "读取中" : preview.error ? "不可用" : joined || "暂无";
  const marker = (name || username).trim().slice(0, 1).toUpperCase() || "L";
  const style = preview.offsetLeft !== undefined ? `style="left: ${preview.offsetLeft}px"` : "";
  return `
    <aside class="ldcv-user-preview" role="dialog" aria-label="用户预览" ${style}>
      <button type="button" class="ldcv-user-preview__close" data-action="close-user-preview" title="关闭预览" aria-label="关闭预览">×</button>
      <div class="ldcv-user-preview__body">
        ${
          avatarUrl
            ? `<img src="${escapeAttribute(avatarUrl)}" alt="" loading="lazy" />`
            : `<span class="ldcv-reader-author__mark" aria-hidden="true">${escapeHtml(marker)}</span>`
        }
        <div>
          <strong>${escapeHtml(name)}</strong>
          <span>@${escapeHtml(username)}</span>
        </div>
        <div class="ldcv-user-preview__quick">
          <a class="ldcv-user-preview__home" href="${escapeAttribute(profileUrl)}" target="_blank" rel="noopener noreferrer">主页</a>
          <span class="ldcv-user-preview__joined">加入日期 ${escapeHtml(joinedLabel)}</span>
        </div>
      </div>
      <div class="ldcv-user-preview__actions">
        ${
          canMessage
            ? `<button type="button" class="ldcv-user-preview__button" data-action="private-message">${icons.reply}<span>私信</span></button>`
            : `<span class="ldcv-user-preview__button is-disabled">${icons.reply}<span>私信</span></span>`
        }
      </div>
    </aside>
  `;
}

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
