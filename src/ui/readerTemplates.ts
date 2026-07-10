import type { TopicCardData, TopicReaderAuthor, TopicReaderPost, TopicReplyNode } from "../discourse/types";
import { linuxDoNestedTopicUrl, linuxDoPreferredTopicUrl, type TopicUrlView } from "../domain/linuxdo/urls";
import { DEFAULT_SETTINGS, type CommentSortOrder, type ExtensionSettings } from "../storage/settings";
import { statTemplate, topicLabelRowTemplate } from "./cards";
import { compactNumber, relativeTime } from "./format";
import { escapeAttribute, escapeHtml } from "./html";
import { icons } from "./icons";
import type { ReaderModalOrigin, ReaderPostAction, ReaderPostActionFeedback, ReaderState } from "./readerTypes";
import {
  flattenReplyChildren,
  replyTargetForPost,
  sortReplyNodes,
  userTargetFromPost,
  type ReplyTarget
} from "./replies";
import { previewMatches, userPreviewTemplate, type ReaderUserPreviewState } from "./userPreview";

export interface ReaderModalPresentation {
  entering?: boolean;
  origin?: ReaderModalOrigin | null;
}

export type ReaderTemplateSettings = Pick<
  ExtensionSettings,
  | "commentSortOrder"
  | "topicUrlView"
  | "autoLoadReaderComments"
  | "readerPostBatchSize"
  | "collapseLongComments"
  | "creditTopicViewDwellSeconds"
>;

function readerModalOriginStyle(origin: ReaderModalOrigin): string {
  return Object.entries(readerModalOriginStyleVars(origin))
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

export function readerModalOriginStyleVars(origin: ReaderModalOrigin): Record<string, string> {
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  return {
    "--ldcv-reader-origin-x": `${Math.round(origin.x)}px`,
    "--ldcv-reader-origin-y": `${Math.round(origin.y)}px`,
    "--ldcv-reader-origin-width": `${Math.round(origin.width ?? 0)}px`,
    "--ldcv-reader-origin-height": `${Math.round(origin.height ?? 0)}px`,
    "--ldcv-reader-origin-radius": `${Math.round(origin.borderRadius ?? 8)}px`,
    "--ldcv-reader-origin-translate-x": `${Math.round(origin.translateX ?? origin.x - viewportWidth / 2)}px`,
    "--ldcv-reader-origin-translate-y": `${Math.round(origin.translateY ?? origin.y - viewportHeight / 2)}px`,
    "--ldcv-reader-origin-scale-x": clampModalScale(origin.scaleX).toFixed(3),
    "--ldcv-reader-origin-scale-y": clampModalScale(origin.scaleY).toFixed(3)
  };
}

function clampModalScale(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.42;
  }

  return Math.min(Math.max(value, 0.18), 0.92);
}

export function readerContentTemplate(
  reader: ReaderState,
  variant: "pane" | "modal",
  topics: TopicCardData[],
  settings: ReaderTemplateSettings
): string {
  const navigation = readerNavigation(reader, topics);
  const sortOrder = settings.commentSortOrder;
  if (!reader.topicId) {
    return `
      <article class="ldcv-reader-article ldcv-reader-article--status ldcv-reader-article--idle" data-reader-variant="${variant}">
        <header class="ldcv-reader-head">
          <strong>选择一个帖子开始阅读</strong>
        </header>
        <div class="ldcv-reader-status-body">
          ${readerLoaderTemplate({ mode: "idle" })}
        </div>
      </article>
    `;
  }

  if (reader.error && !reader.data) {
    const topic = topics.find((item) => item.id === reader.topicId);
    return `
      <article class="ldcv-reader-article ldcv-reader-article--status" data-reader-variant="${variant}" data-reader-topic-id="${reader.topicId}">
        <header class="ldcv-reader-head">
          <strong>讨论读取失败</strong>
          <div class="ldcv-reader-actions">
            ${readerNavTemplate(reader, navigation)}
            <button type="button" class="ldcv-icon-button" data-action="close-reader" title="关闭阅读器" aria-label="关闭阅读器">×</button>
          </div>
        </header>
        <div class="ldcv-reader-status-body">
          <div class="ldcv-reader-error">
            <strong>没有读到这个讨论</strong>
            <p>${escapeHtml(reader.error)}</p>
            <div class="ldcv-reader-error__actions">
              <button type="button" class="ldcv-reader-retry" data-action="retry-reader">重试</button>
              ${topic ? `<a class="ldcv-reader-open" href="${escapeAttribute(preferredTopicUrl(topic.url, settings.topicUrlView))}" target="_blank" rel="noopener noreferrer">原贴</a>` : ""}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  if (reader.loading || !reader.data) {
    const message = "正在读取完整讨论";
    return `
      <article class="ldcv-reader-article ldcv-reader-article--status" data-reader-variant="${variant}" data-reader-topic-id="${reader.topicId}">
        <header class="ldcv-reader-head">
          <strong>${message}</strong>
          <div class="ldcv-reader-actions">
            ${readerNavTemplate(reader, navigation)}
            <button type="button" class="ldcv-icon-button" data-action="close-reader" title="关闭阅读器" aria-label="关闭阅读器">×</button>
          </div>
        </header>
        <div class="ldcv-reader-status-body">
          ${readerLoaderTemplate({ mode: "loading" })}
        </div>
      </article>
    `;
  }

  const data = reader.data;
  const mainPost = data.posts.find((post) => post.isOriginalPost) || data.posts[0];
  const commentCount = Math.max(data.posts.length - (mainPost ? 1 : 0), 0);
  const totalKnownPosts = data.postStream.length || data.stats.posts;
  const totalKnownComments = Math.max(totalKnownPosts - 1, 0);
  const missingCount = Math.max(totalKnownPosts - data.posts.length, 0);
  const postIndex = new Map(data.posts.map((post) => [post.postNumber, post]));
  const expandComments = !settings.collapseLongComments;
  const sortedTree = sortReplyNodes(data.tree, sortOrder);
  const freshPostNumbers = new Set(reader.freshPostNumbers);
  const headerAuthorTarget = mainPost ? userTargetFromPost(mainPost) : null;
  const showHeaderAuthorPreview = mainPost
    ? previewMatches(reader.userPreview, headerAuthorTarget, mainPost.postNumber, "author")
    : false;
  const topicUrlView = settings.topicUrlView;
  return `
    <article class="ldcv-reader-article" data-reader-variant="${variant}" data-reader-topic-id="${data.id}">
      <header class="ldcv-reader-head">
        ${
          mainPost
            ? `<div class="ldcv-reader-head__author">
                ${authorTemplate(mainPost.author, mainPost.createdAt, mainPost.isOriginalPoster, null, mainPost.postNumber)}
                ${showHeaderAuthorPreview && headerAuthorTarget && reader.userPreview ? userPreviewTemplate(headerAuthorTarget, reader.userPreview) : ""}
              </div>`
            : `<strong>话题阅读器</strong>`
        }
        <div class="ldcv-reader-actions">
          ${readerCommentToolsTemplate(sortOrder)}
          ${readerNavTemplate(reader, navigation)}
          <button type="button" class="ldcv-icon-button" data-action="close-reader" title="关闭阅读器" aria-label="关闭阅读器">×</button>
        </div>
      </header>
      ${
        reader.refreshError
          ? `<div class="ldcv-reader-inline-alert" role="status">刷新失败，当前显示缓存内容：${escapeHtml(reader.refreshError)}</div>`
          : ""
      }
      <div class="ldcv-reader-title-row">
        <div>
          <h2>${escapeHtml(data.title)}</h2>
          ${topicLabelRowTemplate(data.category, data.tags, "", "ldcv-topic-labels--reader")}
          <div class="ldcv-reader-meta">
            <div class="ldcv-stats">
              ${statTemplate(icons.reply, totalKnownComments, "评论与回复")}
              ${statTemplate(icons.eye, data.stats.views, "浏览")}
              ${data.stats.likes ? statTemplate(icons.heart, data.stats.likes, "点赞") : ""}
            </div>
          </div>
        </div>
        <div class="ldcv-reader-title-actions">
          <div class="ldcv-reader-primary-actions">
            ${mainPost ? postActionButtonTemplate("reply", mainPost, true, reader.nativePostAction) : ""}
            <a class="ldcv-reader-open ldcv-reader-open--primary ldcv-reader-open--icon" href="${escapeAttribute(preferredTopicUrl(data.url, topicUrlView))}" target="_blank" rel="noopener noreferrer" title="原贴" aria-label="原贴"><span class="ldcv-reader-open__icon">${icons.fileText}</span></a>
          </div>
          ${mainPost ? mainPostQuickActionsTemplate(mainPost, reader.nativePostAction, topicUrlView) : ""}
        </div>
      </div>
      <div class="ldcv-reader-scroll">
        ${mainPost ? mainPostTemplate(mainPost, reader.userPreview, reader.nativePostAction, false) : `<div class="ldcv-reader-note">这个话题暂时没有可预览正文。</div>`}
        <section class="ldcv-reader-thread" aria-label="评论">
          <div class="ldcv-reader-thread__head">
            <div class="ldcv-reader-thread__summary">
              <strong>评论 ${totalKnownPosts ? `<span class="ldcv-reader-thread__progress">(${commentCount} / ${totalKnownComments})</span>` : `(${commentCount})`}</strong>
              <span>${sortOrder === "desc" ? "最新在前" : "最早在前"}</span>
            </div>
          </div>
          ${missingCount > 0 && !data.hasMorePosts ? incompleteNoticeTemplate(data.url, missingCount, topicUrlView) : ""}
          ${
            sortedTree.length
              ? sortedTree
                  .map((node) =>
                    replyThreadTemplate(
                      node,
                      postIndex,
                      reader.userPreview,
                      reader.nativePostAction,
                      sortOrder,
                      expandComments,
                      freshPostNumbers,
                      topicUrlView
                    )
                  )
                  .join("")
              : `<div class="ldcv-reader-note">当前已载入内容里还没有评论。</div>`
          }
          ${readerLoadMoreTemplate(reader, missingCount, variant, settings)}
        </section>
      </div>
    </article>
  `;
}

export function readerCommentToolsTemplate(sortOrder: CommentSortOrder): string {
  return `
    <div class="ldcv-reader-comment-controls" role="group" aria-label="评论筛选与排序">
      <div class="ldcv-reader-search" role="search" title="搜索评论">
        <span class="ldcv-reader-search__icon" aria-hidden="true">${icons.search}</span>
        <input type="search" data-reader-comment-search autocomplete="off" placeholder="搜索评论" aria-label="搜索评论" />
        <button type="button" class="ldcv-reader-search__clear" data-reader-comment-search-clear title="清除搜索" aria-label="清除搜索" hidden>×</button>
      </div>
      <label class="ldcv-reader-op-filter" title="只看 OP">
        <input type="checkbox" data-reader-only-op aria-label="只看 OP" />
        <span>OP</span>
      </label>
      <span class="ldcv-reader-filter-count" data-reader-filter-count></span>
      <div class="ldcv-reader-sort" role="group" aria-label="评论排序">
        <button type="button" class="${sortOrder === "asc" ? "is-active" : ""}" data-comment-sort="asc" title="正序" aria-label="正序">正</button>
        <button type="button" class="${sortOrder === "desc" ? "is-active" : ""}" data-comment-sort="desc" title="倒序" aria-label="倒序">倒</button>
      </div>
    </div>
  `;
}

export function readerLoaderTemplate({
  mode,
  title,
  description,
  command
}: {
  mode: "loading" | "idle" | "error";
  title?: string;
  description?: string;
  command?: string;
}): string {
  const loaderCommand = command || (mode === "error" ? "Linux do it?" : "Linux do it");
  const commandChars = Math.max(Array.from(loaderCommand).length, 11);
  const titleBlock =
    title || description
      ? `<div class="ldcv-reader-loader__title">
          ${title ? `<strong>${escapeHtml(title)}</strong>` : ""}
          ${description ? `<span>${escapeHtml(description)}</span>` : ""}
        </div>`
      : "";
  const skeleton =
    mode === "error"
      ? ""
      : `<div class="ldcv-reader-loader__skeleton" aria-hidden="true">
          ${Array.from({ length: 6 }, () => {
            const shine = mode === "loading" ? `<span class="ldcv-reader-loader__shine"></span>` : "";
            return `<div class="ldcv-reader-loader__row"><span class="ldcv-reader-loader__avatar"></span>${shine}</div>`;
          }).join("")}
        </div>`;
  return `
    <div class="ldcv-reader-loader is-${mode}" style="--ldcv-loader-command-chars: ${commandChars}ch; --ldcv-loader-command-steps: ${commandChars}" role="${mode === "idle" ? "presentation" : "status"}" aria-live="${mode === "idle" ? "off" : "polite"}">
      ${titleBlock}
      <div class="ldcv-reader-loader__terminal" aria-hidden="true">
        <div class="ldcv-reader-loader__line">
          <span class="ldcv-reader-loader__prompt">$</span>
          <span class="ldcv-reader-loader__command">${escapeHtml(loaderCommand)}</span>
          <span class="ldcv-reader-loader__cursor"></span>
        </div>
      </div>
      ${skeleton}
    </div>
  `;
}

export function mainPostTemplate(
  post: TopicReaderPost,
  activePreview: ReaderUserPreviewState | null,
  actionFeedback: ReaderPostActionFeedback | null,
  showAuthor = true
): string {
  const authorTarget = showAuthor ? userTargetFromPost(post) : null;
  const showAuthorPreview = showAuthor && previewMatches(activePreview, authorTarget, post.postNumber, "author");
  return `
    <section class="ldcv-reader-main" id="ldcv-post-${post.postNumber}">
      ${
        showAuthor && authorTarget
          ? `<div class="ldcv-reader-main__author">
              ${authorTemplate(post.author, post.createdAt, post.isOriginalPoster, null, post.postNumber)}
              ${showAuthorPreview && activePreview ? userPreviewTemplate(authorTarget, activePreview) : ""}
            </div>`
          : ""
      }
      <div class="ldcv-reader-post__toolbar">
        <span>主贴</span>
      </div>
      ${postActionFeedbackTemplate(actionFeedback, post.postNumber)}
      <div class="ldcv-reader-prose">${post.html || `<p>这个帖子暂时没有可预览正文。</p>`}</div>
    </section>
  `;
}

export function mainPostQuickActionsTemplate(
  post: TopicReaderPost,
  actionFeedback: ReaderPostActionFeedback | null,
  topicUrlView: TopicUrlView = "classic"
): string {
  return `
    <div class="ldcv-reader-main-actions" role="group" aria-label="主贴操作">
      ${postActionButtonTemplate("like", post, true, actionFeedback)}
      ${postActionButtonTemplate("bookmark", post, true, actionFeedback)}
      ${postActionButtonTemplate("flag", post, true, actionFeedback)}
      <a class="ldcv-reader-main-actions__post-link" href="${escapeAttribute(preferredTopicUrl(post.url, topicUrlView))}" target="_blank" rel="noopener noreferrer">#${post.postNumber}</a>
    </div>
  `;
}

function replyThreadTemplate(
  node: TopicReplyNode,
  postIndex: Map<number, TopicReaderPost>,
  activePreview: ReaderUserPreviewState | null,
  actionFeedback: ReaderPostActionFeedback | null,
  sortOrder: CommentSortOrder,
  expanded: boolean,
  freshPostNumbers: ReadonlySet<number>,
  topicUrlView: TopicUrlView
): string {
  const rootTarget = replyTargetForPost(node.post, postIndex);
  const replies = flattenReplyChildren(node, postIndex, sortOrder);
  return `
    ${replyItemTemplate(node, 0, rootTarget, activePreview, actionFeedback, expanded, freshPostNumbers, topicUrlView)}
    ${
      replies.length
        ? `<div class="ldcv-reader-replies">${replies
            .map((item) =>
              replyItemTemplate(item.node, 1, item.target, activePreview, actionFeedback, expanded, freshPostNumbers, topicUrlView)
            )
            .join("")}</div>`
        : ""
    }
  `;
}

function replyItemTemplate(
  node: TopicReplyNode,
  level: 0 | 1,
  target: ReplyTarget | null,
  activePreview: ReaderUserPreviewState | null,
  actionFeedback: ReaderPostActionFeedback | null,
  expanded: boolean,
  freshPostNumbers: ReadonlySet<number>,
  topicUrlView: TopicUrlView
): string {
  const post = node.post;
  const authorTarget = userTargetFromPost(post);
  const showAuthorPreview = previewMatches(activePreview, authorTarget, post.postNumber, "author");
  const showReplyPreview = previewMatches(activePreview, target, post.postNumber, "reply-target");
  const isFresh = freshPostNumbers.has(post.postNumber);
  const freshBadge = isFresh
    ? `<span class="ldcv-reader-new-badge" title="本次刷新新增">new</span>`
    : "";
  return `
    <article class="ldcv-reader-comment ${expanded ? "is-expanded" : "is-collapsed"}${isFresh ? " is-fresh" : ""}" data-depth="${level}" data-post-number="${post.postNumber}" data-original-poster="${post.isOriginalPoster ? "true" : "false"}" id="ldcv-post-${post.postNumber}">
      <div class="ldcv-reader-comment__body">
        <header class="ldcv-reader-comment__head">
          <div class="ldcv-reader-comment__identity">
            ${authorTemplate(post.author, post.createdAt, post.isOriginalPoster, target, post.postNumber)}
            ${showAuthorPreview && activePreview ? userPreviewTemplate(authorTarget, activePreview) : ""}
            ${target && showReplyPreview && activePreview ? userPreviewTemplate(target, activePreview) : ""}
          </div>
          <div class="ldcv-reader-comment__tools">
            ${postActionButtonTemplate("like", post, false, actionFeedback)}
            ${postActionButtonTemplate("reply", post, false, actionFeedback)}
            ${postActionButtonTemplate("flag", post, false, actionFeedback)}
            <a href="${escapeAttribute(preferredTopicUrl(post.url, topicUrlView))}" target="_blank" rel="noopener noreferrer">#${post.postNumber}</a>
            ${freshBadge}
            ${post.stats.likes ? `<span>${icons.heart}${compactNumber(post.stats.likes)}</span>` : ""}
            ${commentToggleButtonTemplate(expanded)}
          </div>
        </header>
        ${postActionFeedbackTemplate(actionFeedback, post.postNumber)}
        <div class="ldcv-reader-prose ldcv-reader-comment__content">${post.html || `<p>这个回复暂时没有可预览正文。</p>`}</div>
      </div>
    </article>
  `;
}

export function postActionButtonTemplate(
  action: ReaderPostAction,
  post: TopicReaderPost,
  primary = false,
  actionFeedback: ReaderPostActionFeedback | null = null
): string {
  const state = postActionButtonState(action, post);
  const pending = isPendingPostAction(actionFeedback, action, post.postNumber);
  const classes = [
    "ldcv-reader-action-button",
    primary ? "ldcv-reader-action-button--primary" : "",
    `ldcv-reader-action-button--${action}`,
    state.active ? "is-active" : "",
    pending ? "is-pending" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const disabled = state.disabled || pending ? " disabled" : "";
  const pressed = action === "like" || action === "bookmark" ? ` aria-pressed="${state.active ? "true" : "false"}"` : "";
  const title = pending ? `${readerPostActionLabel(action)}处理中...` : state.title;
  return `<button type="button" class="${classes}" data-reader-post-action="${action}" data-reader-post-number="${post.postNumber}" title="${escapeAttribute(title)}" aria-label="${escapeAttribute(title)}"${pressed}${disabled}>${state.icon}</button>`;
}

function postActionButtonState(
  action: ReaderPostAction,
  post: TopicReaderPost
): { title: string; icon: string; active: boolean; disabled: boolean } {
  if (action === "reply") {
    const disabled = post.actions.canReply === false;
    return {
      title: disabled ? "当前账号无法回复" : "开始撰写对此帖子的回复",
      icon: icons.reply,
      active: false,
      disabled
    };
  }
  if (action === "like") {
    const active = post.actions.liked === true;
    const disabled = post.actions.canLike === false && !active;
    return {
      title: active ? "取消点赞" : disabled ? "当前账号无法点赞" : "点赞此帖子",
      icon: active ? icons.heart : icons.heartOutline,
      active,
      disabled
    };
  }

  if (action === "flag") {
    return {
      title: "举报此帖",
      icon: icons.flag,
      active: false,
      disabled: false
    };
  }

  const active = post.actions.bookmarked === true;
  const disabled = post.actions.canBookmark === false && !active;
  return {
    title: active ? "取消书签" : disabled ? "当前账号无法添加书签" : "将主贴添加为书签",
    icon: active ? icons.bookmark : icons.bookmarkOutline,
    active,
    disabled
  };
}

export function isPendingPostAction(
  feedback: ReaderPostActionFeedback | null,
  action: ReaderPostAction,
  postNumber: number
): boolean {
  return Boolean(feedback && feedback.status === "pending" && feedback.action === action && feedback.postNumber === postNumber);
}

export function readerPostActionLabel(action: ReaderPostAction): string {
  if (action === "reply") {
    return "回复";
  }
  if (action === "like") {
    return "点赞";
  }
  if (action === "flag") {
    return "举报窗口";
  }
  return "书签";
}

function commentToggleButtonTemplate(expanded: boolean): string {
  const title = expanded ? "收起评论" : "展开评论";
  return `<button type="button" class="ldcv-reader-comment__toggle" data-action="toggle-comment" title="${title}" aria-label="${title}" aria-expanded="${expanded ? "true" : "false"}">${icons.chevronDown}</button>`;
}

export function postActionFeedbackTemplate(feedback: ReaderPostActionFeedback | null, postNumber: number): string {
  if (!feedback || feedback.postNumber !== postNumber || feedback.action === "private-message") {
    return "";
  }

  const fallbackLink = feedback.fallbackUrl
    ? ` <a class="ldcv-reader-action-feedback__link" href="${escapeAttribute(feedback.fallbackUrl)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;text-underline-offset:2px">打开原生视图</a>`
    : "";
  return `<div class="ldcv-reader-action-feedback is-${feedback.status}" role="status">${escapeHtml(feedback.message)}${fallbackLink}</div>`;
}

function replyTargetTemplate(target: ReplyTarget, anchorPostNumber: number): string {
  const previewData = target.username
    ? ` data-reader-user-preview="true" data-reader-preview-anchor="reply-target" data-reader-username="${escapeAttribute(target.username)}" data-reader-name="${escapeAttribute(target.name)}" data-reader-avatar-url="${escapeAttribute(target.avatarUrl)}" data-reader-post-number="${target.postNumber}" data-reader-anchor-post-number="${anchorPostNumber}" data-user-card="${escapeAttribute(target.username)}"`
    : "";
  const title = target.username ? `预览 ${target.label}` : `回复 #${target.postNumber}`;
  return `<em class="ldcv-reader-reply-target mention">@${escapeHtml(target.label)}</em>`;
}

export function readerLoadMoreTemplate(
  reader: ReaderState,
  missingCount: number,
  variant: "pane" | "modal",
  settings: ReaderTemplateSettings
): string {
  const data = reader.data;
  if (!data?.hasMorePosts) {
    return "";
  }
  const hint = settings.autoLoadReaderComments
      ? `首批由站点 topic JSON 返回；滚到列表底部会自动加载下一批 ${settings.readerPostBatchSize} 条评论。`
      : `首批由站点 topic JSON 返回；只在你点击时读取下一批 ${settings.readerPostBatchSize} 条，不会自动批量请求。`;

  return `
    <div class="ldcv-reader-loadmore">
      <div>
        <strong>还有 ${missingCount || "更多"} 条评论未载入</strong>
        <span>${hint}</span>
        ${reader.loadMoreError ? `<p>${escapeHtml(reader.loadMoreError)}</p>` : ""}
      </div>
      <button type="button" data-action="load-more-reader" ${reader.loadingMore ? "disabled" : ""}>
        ${reader.loadingMore ? "正在加载" : "加载更多评论"}
      </button>
    </div>
  `;
}

export function incompleteNoticeTemplate(url: string, count: number, topicUrlView: TopicUrlView = "classic"): string {
  return `
    <div class="ldcv-reader-note">
      当前 JSON 已载入内容可能不是完整讨论，约还有 ${count} 条未显示。
      <a href="${escapeAttribute(preferredTopicUrl(url, topicUrlView))}" target="_blank" rel="noopener noreferrer">打开原帖查看完整讨论</a>
    </div>
  `;
}

export function preferredTopicUrl(topicUrl: string, view: TopicUrlView = "classic"): string {
  return linuxDoPreferredTopicUrl(topicUrl, view);
}

export function nativeNestedTopicUrl(topicUrl: string): string {
  return linuxDoNestedTopicUrl(topicUrl);
}

export function authorTemplate(
  author: TopicReaderAuthor,
  createdAt: string,
  isOriginalPoster = false,
  replyTarget: ReplyTarget | null = null,
  postNumber = 0,
  interactive = true
): string {
  const authorName = authorDisplayName(author);
  const marker = (author.username || authorName).trim().slice(0, 1).toUpperCase() || "L";
  const authorNameHtml =
    interactive && author.username
      ? `<a class="ldcv-reader-author__name" href="${escapeAttribute(profileUrlForUsername(author.username))}" data-reader-user-preview="true" data-reader-preview-anchor="author" data-reader-username="${escapeAttribute(author.username)}" data-reader-name="${escapeAttribute(authorName)}" data-reader-avatar-url="${escapeAttribute(author.avatarUrl)}" data-reader-post-number="${postNumber}" data-reader-anchor-post-number="${postNumber}" data-user-card="${escapeAttribute(author.username)}">${escapeHtml(authorName)}${isOriginalPoster ? ` <em class="ldcv-op-badge">OP</em>` : ""}</a>`
      : `${escapeHtml(authorName)}${isOriginalPoster ? ` <em class="ldcv-op-badge">OP</em>` : ""}`;
  return `
    <div class="ldcv-reader-author">
      ${
        author.avatarUrl
          ? `<img src="${escapeAttribute(author.avatarUrl)}" alt="" loading="lazy" />`
          : `<span class="ldcv-reader-author__mark" aria-hidden="true">${escapeHtml(marker)}</span>`
      }
      <div>
        <span>${authorNameHtml}${replyTarget ? replyTargetTemplate(replyTarget, postNumber) : ""}</span>
        <time>${relativeTime(createdAt)}</time>
      </div>
    </div>
  `;
}

function authorDisplayName(author: TopicReaderAuthor): string {
  return author.name || author.username || "Linux.do 用户";
}

export function profileUrlForUsername(username: string): string {
  return `/u/${encodeURIComponent(username)}`;
}

export function readerNavigation(reader: ReaderState, topics: TopicCardData[]): { previous: boolean; next: boolean } {
  const index = topics.findIndex((topic) => topic.id === reader.topicId);
  return {
    previous: index > 0,
    next: index >= 0 && index < topics.length - 1
  };
}

export function readerNavTemplate(reader: ReaderState, navigation: { previous: boolean; next: boolean }): string {
  const canRefresh = Boolean(reader.data) && !reader.loading && !reader.refreshing;
  return `
    <div class="ldcv-reader-nav" aria-label="阅读切换">
      <button type="button" data-action="refresh-reader" ${
        canRefresh ? "" : "disabled"
      } class="${reader.refreshing ? "is-spinning" : ""}" title="刷新当前帖子" aria-label="刷新当前帖子">
        ${icons.refresh}
      </button>
      <button type="button" data-reader-move="-1" ${navigation.previous ? "" : "disabled"} title="上一个帖子" aria-label="上一个帖子">
        ${icons.previous}
      </button>
      <button type="button" data-reader-move="1" ${navigation.next ? "" : "disabled"} title="下一个帖子" aria-label="下一个帖子">
        ${icons.next}
      </button>
    </div>
  `;
}

function readerTemplateSettings(settings: CommentSortOrder | ReaderTemplateSettings): ReaderTemplateSettings {
  if (typeof settings === "string") {
    return {
      commentSortOrder: settings,
      topicUrlView: DEFAULT_SETTINGS.topicUrlView,
      autoLoadReaderComments: DEFAULT_SETTINGS.autoLoadReaderComments,
      readerPostBatchSize: DEFAULT_SETTINGS.readerPostBatchSize,
      collapseLongComments: DEFAULT_SETTINGS.collapseLongComments,
      creditTopicViewDwellSeconds: DEFAULT_SETTINGS.creditTopicViewDwellSeconds,
    };
  }
  return settings;
}
