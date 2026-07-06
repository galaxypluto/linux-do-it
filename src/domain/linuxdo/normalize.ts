import type {
  DiscourseCategory,
  DiscourseListResponse,
  DiscourseSearchResponse,
  DiscourseTopic,
  DiscourseUser,
  TopicCardData,
  TopicListData,
} from './types';
import { linuxDoClassicTopicPath } from './urls';

const FALLBACK_CATEGORY_COLOR = '6b7280';
const DEFAULT_ORIGIN = 'https://linux.do';

export type NormalizeTopicListOptions = {
  origin?: string;
};

export function normalizeTopicList(
  response: DiscourseListResponse,
  endpoint: string,
  options: NormalizeTopicListOptions = {},
): TopicListData {
  const users = toMap(response.users ?? []);
  const categories = toMap([...(response.categories ?? []), ...(response.category_list?.categories ?? [])]);

  return {
    endpoint,
    topics: (response.topic_list?.topics ?? [])
      .filter((topic): topic is DiscourseTopic & { id: number } => Number.isFinite(topic.id))
      .map((topic) => normalizeTopic(topic, users, categories, options)),
    moreTopicsUrl: response.topic_list?.more_topics_url ?? '',
  };
}

export function normalizeTopic(
  topic: DiscourseTopic,
  users: Map<number, DiscourseUser>,
  categories: Map<number, DiscourseCategory>,
  options: NormalizeTopicListOptions = {},
): TopicCardData {
  const category = topic.category_id ? categories.get(topic.category_id) : undefined;
  const parentCategory = category?.parent_category_id ? categories.get(category.parent_category_id) : undefined;

  return {
    id: topic.id,
    title: cleanReaderTitle(firstText(topic.fancy_title, topic.title, 'Untitled topic')) || 'Untitled topic',
    url: linuxDoClassicTopicPath(topic.slug || 'topic', topic.id),
    slug: safePathSegment(topic.slug || 'topic'),
    excerpt: cleanExcerpt(firstText(topic.excerpt, topic.escaped_excerpt)),
    thumbnailUrl: pickThumbnail(topic, options),
    category: category
      ? {
          id: category.id,
          name: firstCleanText(category.name, category.slug, `Category ${category.id}`),
          parentName: parentCategory ? firstCleanText(parentCategory.name, parentCategory.slug, '') : '',
          color: normalizeHex(category.color || FALLBACK_CATEGORY_COLOR),
          textColor: normalizeHex(category.text_color || 'ffffff'),
        }
      : undefined,
    tags: Array.isArray(topic.tags) ? topic.tags.map(normalizeTagName).filter(Boolean) : [],
    stats: {
      replies: topicInteractionCount(topic),
      views: numeric(topic.views),
      likes: numeric(topic.like_count),
      score: numeric(topic.score),
    },
    dates: {
      createdAt: textValue(topic.created_at),
      activityAt: textValue(topic.bumped_at || topic.last_posted_at || topic.created_at),
    },
    flags: {
      pinned: Boolean(topic.pinned),
      closed: Boolean(topic.closed),
      archived: Boolean(topic.archived),
      bookmarked: Boolean(topic.bookmarked),
      unseen: Boolean(topic.unseen),
      read: isTopicFullyRead(topic),
    },
    posters: normalizePosters(topic, users, options),
  };
}

export function cleanExcerpt(value: unknown): string {
  return stripEmojiShortcodes(cleanHtml(value)).replace(/\s+/g, ' ').trim().slice(0, 240);
}

export function cleanReaderTitle(value: unknown): string {
  return stripTitleEmoji(cleanHtml(value)).replace(/\s+/g, ' ').trim();
}

export function normalizeTagName(value: unknown): string {
  if (isRecord(value)) {
    return cleanHtml(value.name) || cleanHtml(value.slug);
  }

  return cleanHtml(value);
}

function normalizePosters(
  topic: DiscourseTopic,
  users: Map<number, DiscourseUser>,
  options: NormalizeTopicListOptions,
): TopicCardData['posters'] {
  const seen = new Set<number>();

  return (topic.posters ?? [])
    .map((poster) => {
      const id = poster.user_id;
      if (!id || seen.has(id)) {
        return undefined;
      }
      seen.add(id);
      const user = users.get(id);
      const username = textValue(user?.username) || `user-${id}`;
      return {
        id,
        username,
        name: textValue(user?.name),
        avatarUrl: avatarUrl(user?.avatar_template, username, options),
        description: textValue(poster.description),
        isOriginalPoster: poster.extras === 'latest single' || poster.description === 'Original Poster',
      };
    })
    .filter((poster): poster is TopicCardData['posters'][number] => Boolean(poster))
    .slice(0, 5);
}

function pickThumbnail(topic: DiscourseTopic, options: NormalizeTopicListOptions): string {
  const thumbnail =
    topic.thumbnails?.find((item) => item.url && (item.max_width ?? 0) >= 200) ||
    topic.thumbnails?.find((item) => item.url) ||
    undefined;
  return absoluteUrl(thumbnail?.url || topic.image_url || '', options);
}

function avatarUrl(template: unknown, username: string, options: NormalizeTopicListOptions): string {
  const avatarTemplate = textValue(template);
  if (!avatarTemplate) {
    return `https://ui-avatars.com/api/?background=0f172a&color=fff&name=${encodeURIComponent(username)}`;
  }
  return absoluteUrl(avatarTemplate.replace('{size}', '64'), options);
}

function absoluteUrl(url: unknown, options: NormalizeTopicListOptions): string {
  const normalizedUrl = textValue(url);
  if (!normalizedUrl) {
    return '';
  }
  if (/^https?:\/\//i.test(normalizedUrl)) {
    return normalizedUrl;
  }
  return new URL(normalizedUrl, options.origin ?? DEFAULT_ORIGIN).toString();
}

function cleanHtml(value: unknown): string {
  const text = textValue(value);
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return (doc.body.textContent || text).trim();
}

function normalizeHex(value: unknown): string {
  const normalized = textValue(value).replace(/^#/, '').trim().replace(/[^a-fA-F0-9]/g, '').slice(0, 6);
  return normalized.length === 3 || normalized.length === 6 ? normalized : FALLBACK_CATEGORY_COLOR;
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function topicInteractionCount(topic: DiscourseTopic): number {
  const totalPosts = numeric(topic.posts_count);
  const replyCount = numeric(topic.reply_count);
  if (totalPosts > 0) {
    return Math.max(totalPosts - 1, replyCount);
  }
  return replyCount;
}

function isTopicFullyRead(topic: DiscourseTopic): boolean {
  if (Boolean(topic.unseen)) {
    return false;
  }

  const unreadPosts = numeric(topic.unread_posts);
  const newPosts = numeric(topic.new_posts);
  if (unreadPosts > 0 || newPosts > 0) {
    return false;
  }

  const lastReadPostNumber = numeric(topic.last_read_post_number);
  const highestPostNumber = numeric(topic.highest_post_number) || numeric(topic.posts_count);
  if (lastReadPostNumber > 0 && highestPostNumber > 0) {
    return lastReadPostNumber >= highestPostNumber;
  }

  return false;
}

function safePathSegment(value: unknown): string {
  const text = textValue(value).trim();
  return text ? encodeURIComponent(text) : 'topic';
}

function firstCleanText(...values: unknown[]): string {
  const text = firstText(...values);
  return cleanHtml(text);
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = textValue(value).trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function textValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}

function stripTitleEmoji(value: string): string {
  return stripEmojiShortcodes(value)
    .replace(/\p{Extended_Pictographic}[\ufe0e\ufe0f]?/gu, '')
    .replace(/[\u200d\ufe0e\ufe0f]/g, '');
}

function stripEmojiShortcodes(value: string): string {
  return value.replace(/:[a-z0-9_+-]+:/gi, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toMap<T extends { id: number }>(items: T[]): Map<number, T> {
  return new Map(items.filter((item) => Number.isFinite(item.id)).map((item) => [item.id, item]));
}

export function normalizeSearchTopics(
  response: DiscourseSearchResponse,
  options: NormalizeTopicListOptions = {},
): TopicCardData[] {
  const users = toMap(response.users ?? []);
  const categories = toMap(response.categories ?? []);

  return (response.topics ?? [])
    .filter((topic): topic is DiscourseTopic & { id: number } => Number.isFinite(topic.id))
    .map((topic) => normalizeTopic(topic, users, categories, options));
}
