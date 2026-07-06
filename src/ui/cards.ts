import type { TopicCardData } from "../discourse/types";
import { linuxDoPreferredTopicUrl, type TopicUrlView } from "../domain/linuxdo/urls";
import type { CardLayout } from "../storage/settings";
import { compactNumber, relativeTime, formatPublishTime } from "./format";
import { escapeAttribute, escapeHtml } from "./html";
import { icons } from "./icons";

export type CardVariant = "text" | "media" | "feature";
export const DEFAULT_TOPIC_LABEL_MAX_TAGS = 2;

export interface CardRenderState {
  selected: boolean;
  viewed: boolean;
  justRead: boolean;
  newTopic?: boolean;
  entering?: boolean;
  enterDelayMs?: number;
}

export function cardTemplate(
  topic: TopicCardData,
  index: number,
  layout: CardLayout,
  state: CardRenderState,
  topicUrlView: TopicUrlView = "classic"
): string {
  const isNsfw = topic.tags?.some(tag => tag.toLowerCase() === "nsfw") ?? false;
  const styleDeclarations = [
    topic.category ? `--category-color:#${topic.category.color};--category-text:#${topic.category.textColor}` : "",
    state.entering && Number.isFinite(state.enterDelayMs) ? `--ldcv-enter-delay:${state.enterDelayMs}ms` : ""
  ].filter(Boolean);
  const style = styleDeclarations.length ? `style="${styleDeclarations.join(";")}"` : "";
  const topicUrl = escapeAttribute(linuxDoPreferredTopicUrl(topic.url, topicUrlView));
  const variant = cardVariantForTopic(topic, layout);
  const titlePreview = shouldUseTitlePreview(topic, layout);
  const stateLabel = state.selected ? "正在阅读" : state.viewed ? "已读" : "";
  const stateBadges = [
    state.newTopic ? `<span class="ldcv-state is-new">new</span>` : "",
    topic.flags.pinned ? `<span class="ldcv-state">置顶</span>` : "",
    topic.flags.closed ? `<span class="ldcv-state">已关闭</span>` : ""
  ].join("");

  return `
    <article class="ldcv-card is-${variant} ${topic.thumbnailUrl ? "has-image" : "has-text-preview"} ${
      state.selected ? "is-selected" : ""
    } ${
      state.viewed ? "is-viewed" : ""
    } ${
      state.justRead ? "is-just-read" : ""
    } ${
      state.newTopic ? "is-new" : ""
    } ${
      state.entering ? "is-entering" : ""
    } ${
      isNsfw ? "is-nsfw" : ""
    }" ${style} data-topic-id="${topic.id}" data-topic-index="${index}" data-card-variant="${variant}">
      ${isNsfw ? `
        <div class="ldcv-card__nsfw-overlay">
          <span class="ldcv-card__nsfw-badge">NSFW</span>
        </div>
      ` : ""}
      ${topicVisualTemplate(topic, variant, layout, topicUrlView)}
      <a class="ldcv-card__body" href="${topicUrl}" title="阅读：${escapeAttribute(topic.title)}">
        ${topicAuthorTemplate(topic)}
        ${titlePreview ? "" : `<h3 class="ldcv-card__title">${escapeHtml(topic.title)}</h3>`}
        ${topicLabelRowTemplate(topic.category, topic.tags, stateBadges)}
        ${topic.excerpt && topic.thumbnailUrl ? `<p class="ldcv-card__excerpt">${escapeHtml(topic.excerpt)}</p>` : ""}
        <div class="ldcv-card__footer">
          <div class="ldcv-card__status">
            ${stateLabel ? `<span class="ldcv-state ${state.selected ? "is-reading" : "is-viewed"}">${stateLabel}</span>` : ""}
          </div>
          <div class="ldcv-stats">
            ${statTemplate(icons.reply, topic.stats.replies, "评论与回复")}
            ${statTemplate(icons.eye, topic.stats.views, "浏览")}
            ${topic.stats.likes ? statTemplate(icons.heart, topic.stats.likes, "点赞") : ""}
            <span class="ldcv-time">${relativeTime(topic.dates.activityAt)}</span>
          </div>
        </div>
      </a>
    </article>
  `;
}

export function cardVariantForTopic(topic: TopicCardData, layout: CardLayout): CardVariant {
  if (layout === "grid") {
    return "media";
  }

  if (!topic.thumbnailUrl) {
    return "text";
  }

  if (layout === "masonry" && (topic.flags.pinned || topic.stats.views >= 50000 || topic.stats.replies >= 200)) {
    return "feature";
  }

  return "media";
}

export function shouldUseTitlePreview(topic: TopicCardData, layout: CardLayout): boolean {
  return layout !== "masonry" && !topic.thumbnailUrl && !topic.excerpt;
}

export function topicLabelRowTemplate(
  category: TopicCardData["category"] | undefined,
  tags: string[],
  extraLabels = "",
  className = "",
  options: { maxTags?: number } = {}
): string {
  const categoryLabel = category ? categoryTemplate(category) : "";
  const tagLabels = tags.length
    ? tagTemplate(tags, "ldcv-tags--inline", options.maxTags ?? DEFAULT_TOPIC_LABEL_MAX_TAGS)
    : "";
  if (!categoryLabel && !tagLabels && !extraLabels) {
    return "";
  }

  const classes = ["ldcv-topic-labels", className].filter(Boolean).join(" ");
  return `<div class="${classes}">${categoryLabel}${tagLabels}${extraLabels}</div>`;
}

export function statTemplate(icon: string, value: number, label: string): string {
  return `<span class="ldcv-stat" title="${label}">${icon}${compactNumber(value)}</span>`;
}

function topicVisualTemplate(topic: TopicCardData, variant: CardVariant, layout: CardLayout, topicUrlView: TopicUrlView): string {
  if (topic.thumbnailUrl) {
    return imageTemplate(topic, topicUrlView);
  }

  return layout === "masonry" ? "" : textPreviewTemplate(topic, variant, layout, topicUrlView);
}

function imageTemplate(topic: TopicCardData, topicUrlView: TopicUrlView): string {
  return `
    <a class="ldcv-card__image" href="${escapeAttribute(linuxDoPreferredTopicUrl(topic.url, topicUrlView))}" aria-label="${escapeAttribute(topic.title)}">
      <img src="${escapeAttribute(topic.thumbnailUrl)}" alt="" loading="lazy" />
    </a>
  `;
}

function textPreviewTemplate(topic: TopicCardData, variant: CardVariant, layout: CardLayout, topicUrlView: TopicUrlView): string {
  const previewKind = shouldUseTitlePreview(topic, layout) ? "title" : "excerpt";
  const previewText = previewKind === "title" ? topic.title : topic.excerpt || "暂无正文摘要";
  return `
    <a class="ldcv-card__text-preview" href="${escapeAttribute(linuxDoPreferredTopicUrl(topic.url, topicUrlView))}" aria-label="${escapeAttribute(topic.title)}" data-card-preview-variant="${variant}" data-preview-kind="${previewKind}" data-has-excerpt="${topic.excerpt ? "true" : "false"}">
      <em>${escapeHtml(previewText)}</em>
    </a>
  `;
}

function topicAuthorTemplate(topic: TopicCardData): string {
  const poster = primaryPosterForTopic(topic);
  if (!poster) {
    return "";
  }

  const username = poster.username || "linuxdo-user";
  const displayName = poster.name || username;
  const marker = displayName.trim().slice(0, 1).toUpperCase() || "L";
  return `
    <div class="ldcv-card__author" data-reader-user-preview="true" data-reader-username="${escapeAttribute(username)}" data-reader-name="${escapeAttribute(displayName)}" data-reader-avatar-url="${escapeAttribute(poster.avatarUrl || '')}" data-reader-post-number="1" data-reader-preview-anchor="author">
      <span class="ldcv-card__avatar" aria-hidden="true">
        ${
          poster.avatarUrl
            ? `<img src="${escapeAttribute(poster.avatarUrl)}" alt="" loading="lazy" />`
            : `<span>${escapeHtml(marker)}</span>`
        }
      </span>
      <span class="ldcv-card__author-text">
        <span class="ldcv-card__username" title="${escapeAttribute(displayName)} · @${escapeAttribute(username)}">${escapeHtml(displayName)}</span>
      </span>
      <span class="ldcv-card__publish-time" title="发布时间">${formatPublishTime(topic.dates.createdAt)}</span>
    </div>
  `;
}

function primaryPosterForTopic(topic: TopicCardData): TopicCardData["posters"][number] | undefined {
  return topic.posters.find((poster) => poster.isOriginalPoster) || topic.posters[0];
}

function tagTemplate(tags: string[], className = "", maxTags?: number): string {
  const classes = ["ldcv-tags", className].filter(Boolean).join(" ");
  const visibleTags = typeof maxTags === "number" && maxTags >= 0 ? tags.slice(0, maxTags) : tags;
  const hiddenTags = tags.slice(visibleTags.length);
  const moreLabel = hiddenTags.length
    ? `<span class="ldcv-tag ldcv-tag--more" title="${escapeAttribute(tags.join(" / "))}">+${hiddenTags.length}</span>`
    : "";
  return `<div class="${classes}">${visibleTags
    .map((tag) => `<span class="ldcv-tag">${escapeHtml(tag)}</span>`)
    .join("")}${moreLabel}</div>`;
}

function categoryTemplate(category: NonNullable<TopicCardData["category"]>): string {
  const label = category.parentName ? `${category.parentName} / ${category.name}` : category.name;
  return `<span class="ldcv-category" title="分类层级：${escapeAttribute(label)}">${escapeHtml(category.name)}</span>`;
}
