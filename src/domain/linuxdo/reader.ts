import { cleanReaderTitle, normalizeTagName } from './normalize';
import { sanitizeCookedHtml } from './sanitize';
import type {
  DiscoursePostResponse,
  DiscourseTopicResponse,
  ReaderUserProfileData,
  TopicCardData,
  TopicReaderAuthor,
  TopicReaderData,
  TopicReaderPost,
  TopicReplyNode,
} from './types';

const DEFAULT_ORIGIN = 'https://linux.do';

export type NormalizeReaderOptions = {
  origin?: string;
};

type ReaderPostContext = {
  topicUrl: string;
  fallbackCreatedAt: string;
  fallbackAuthor: TopicReaderAuthor | null;
  canReply: boolean | null;
  bookmarkedPostIds: ReadonlySet<number>;
  bookmarkedPostNumbers: ReadonlySet<number>;
  topicBookmarked: boolean | null;
};

export function normalizeTopicReader(
  topic: TopicCardData,
  payload: DiscourseTopicResponse,
  options: NormalizeReaderOptions = {},
): TopicReaderData {
  const fallbackAuthor = topic.posters[0]
    ? {
        id: topic.posters[0].id,
        username: topic.posters[0].username,
        name: '',
        avatarUrl: topic.posters[0].avatarUrl,
      }
    : null;
  const canReply = confirmedBoolean(payload.details?.can_create_post);
  const posts = normalizeReaderPosts(
    payloadPosts(payload),
    {
      topicUrl: topic.url,
      fallbackCreatedAt: textValue(payload.created_at) || topic.dates.createdAt,
      fallbackAuthor,
      canReply,
      ...bookmarkedPostContext(payload, confirmedBoolean(payload.bookmarked) ?? topic.flags.bookmarked),
    },
    options,
  );
  const opAuthor = posts.find((post) => post.isOriginalPost)?.author || posts[0]?.author || fallbackAuthor;
  const markedPosts = markOriginalPoster(posts, opAuthor);
  const postStream = numericArray(payload.post_stream?.stream);
  const loadedPostIds = loadedPostIdsFrom(markedPosts);
  const statsPosts = numeric(payload.posts_count) || Math.max(topic.stats.replies + 1, markedPosts.length);

  return {
    id: topic.id,
    title: cleanReaderTitle(textValue(payload.fancy_title) || textValue(payload.title) || topic.title) || 'Untitled topic',
    url: topic.url,
    slug: topic.slug,
    stats: {
      posts: statsPosts,
      views: numeric(payload.views || topic.stats.views),
      likes: numeric(payload.like_count || topic.stats.likes),
    },
    actions: {
      canReply,
      draftKey: textValue(payload.draft_key),
      draftSequence: numeric(payload.draft_sequence),
    },
    tags: Array.isArray(payload.tags) ? payload.tags.map(normalizeTagName).filter(Boolean) : topic.tags,
    category: topic.category,
    opAuthor,
    posts: markedPosts,
    tree: buildReplyTree(markedPosts),
    postStream,
    loadedPostIds,
    hasMorePosts: hasUnloadedPosts(postStream, loadedPostIds),
  };
}

export function normalizeFetchedReaderPosts(
  reader: TopicReaderData,
  payload: DiscourseTopicResponse,
  options: NormalizeReaderOptions = {},
): TopicReaderPost[] {
  return markOriginalPoster(
    normalizeReaderPosts(
      payloadPosts(payload),
      {
        topicUrl: reader.url,
        fallbackCreatedAt: reader.posts[0]?.createdAt || '',
        fallbackAuthor: reader.opAuthor,
        canReply: reader.actions.canReply,
        ...readerBookmarkContext(reader),
      },
      options,
    ),
    reader.opAuthor,
  );
}

export function mergeReaderPostsIntoReader(
  reader: TopicReaderData,
  incomingPosts: TopicReaderPost[],
): TopicReaderData {
  if (!incomingPosts.length) {
    return {
      ...reader,
      hasMorePosts: hasUnloadedPosts(reader.postStream, reader.loadedPostIds),
    };
  }

  const byPostNumber = new Map<number, TopicReaderPost>();
  reader.posts.forEach((post) => byPostNumber.set(post.postNumber, post));
  incomingPosts.forEach((post) => byPostNumber.set(post.postNumber, post));
  const posts = Array.from(byPostNumber.values()).sort((a, b) => a.postNumber - b.postNumber);
  const loadedPostIds = loadedPostIdsFrom(posts);

  return {
    ...reader,
    stats: {
      ...reader.stats,
      posts: Math.max(reader.stats.posts, posts.length),
    },
    posts,
    tree: buildReplyTree(posts),
    loadedPostIds,
    hasMorePosts: hasUnloadedPosts(reader.postStream, loadedPostIds),
  };
}

export function nextUnloadedPostIds(reader: TopicReaderData, limit: number): number[] {
  const loadedIds = new Set(reader.loadedPostIds);
  return reader.postStream.filter((id) => !loadedIds.has(id)).slice(0, Math.max(0, limit));
}

export function createReaderUserProfile(
  username: string,
  payload: unknown,
  fallback: Partial<Pick<ReaderUserProfileData, 'name' | 'avatarUrl'>> = {},
  options: NormalizeReaderOptions = {},
): ReaderUserProfileData {
  const normalizedUsername = username.trim();
  const user = isRecord(payload) && isRecord(payload.user) ? payload.user : {};
  const encodedUsername = encodeURIComponent(normalizedUsername);

  return {
    id: nullableNumber(user.id),
    username: textValue(user.username) || normalizedUsername,
    name: textValue(user.name) || fallback.name || normalizedUsername,
    avatarUrl: avatarUrl(user.avatar_template, fallback.avatarUrl || '', options),
    joinedAt: textValue(user.created_at),
    profileUrl: `/u/${encodedUsername}/summary`,
    messageUrl: `/new-message?username=${encodedUsername}`,
    canMessage: booleanValue(user.can_send_private_message_to_user ?? user.can_send_private_message, true),
  };
}

function normalizeReaderPosts(
  rawPosts: DiscoursePostResponse[],
  context: ReaderPostContext,
  options: NormalizeReaderOptions,
): TopicReaderPost[] {
  return rawPosts
    .map((post, index) => {
      const postNumber = numeric(post.post_number) || index + 1;
      const postId = numeric(post.id) || postNumber;
      const username = textValue(post.username) || context.fallbackAuthor?.username || '';
      const postUrl = `${context.topicUrl}/${postNumber}`;
      return {
        id: postId,
        postNumber,
        replyToPostNumber: nullableNumber(post.reply_to_post_number),
        author: {
          id: nullableNumber(post.user_id) || context.fallbackAuthor?.id || null,
          username,
          name: textValue(post.name) || (username && context.fallbackAuthor && username === context.fallbackAuthor.username ? context.fallbackAuthor.name : ''),
          avatarUrl: avatarUrl(post.avatar_template, context.fallbackAuthor?.avatarUrl || '', options),
        },
        createdAt: textValue(post.created_at) || context.fallbackCreatedAt,
        html: sanitizeCookedHtml(post.cooked),
        stats: {
          likes: numeric(post.like_count),
          reads: numeric(post.reads),
          replies: numeric(post.reply_count),
        },
        actions: normalizePostActions(post, postId, postNumber, context),
        url: postUrl,
        isOriginalPost: postNumber === 1,
        isOriginalPoster: postNumber === 1,
      };
    })
    .filter((post) => post.html || post.isOriginalPost);
}

function normalizePostActions(
  post: DiscoursePostResponse,
  postId: number,
  postNumber: number,
  context: ReaderPostContext,
): TopicReaderPost['actions'] {
  const likeAction = post.actions_summary?.find((action) => {
    const actionId = numeric(action.id);
    const nameKey = textValue(action.name_key).toLowerCase();
    return actionId === 2 || nameKey === 'like';
  });
  const liked = likeAction ? confirmedBoolean(likeAction.acted) : null;
  const canAct = likeAction ? confirmedBoolean(likeAction.can_act) : null;
  const canUndo = likeAction ? confirmedBoolean(likeAction.can_undo) : null;
  const canLike = canAct === true || canUndo === true ? true : canAct ?? canUndo ?? null;
  const postBookmarked = confirmedBoolean(post.bookmarked);
  const contextBookmarked =
    context.bookmarkedPostIds.has(postId) ||
    context.bookmarkedPostNumbers.has(postNumber) ||
    (postNumber === 1 ? context.topicBookmarked : null);
  const bookmarked = postBookmarked ?? (contextBookmarked === true ? true : contextBookmarked === false ? false : null);
  const canBookmark = confirmedBoolean(post.can_bookmark) ?? (bookmarked !== null ? true : null);

  return {
    canReply: context.canReply,
    canLike,
    liked,
    canBookmark,
    bookmarked,
  };
}

function bookmarkedPostContext(
  payload: DiscourseTopicResponse,
  topicBookmarked: boolean | null,
): Pick<ReaderPostContext, 'bookmarkedPostIds' | 'bookmarkedPostNumbers' | 'topicBookmarked'> {
  const bookmarkedPostIds = new Set<number>();
  const bookmarkedPostNumbers = new Set<number>();
  payload.bookmarks?.forEach((bookmark) => {
    const bookmarkableType = textValue(bookmark.bookmarkable_type).toLowerCase();
    if (bookmarkableType && bookmarkableType !== 'post') {
      return;
    }
    const bookmarkableId = numeric(bookmark.bookmarkable_id);
    if (bookmarkableId) {
      bookmarkedPostIds.add(bookmarkableId);
    }
    const postNumber = numeric(bookmark.post_number);
    if (postNumber) {
      bookmarkedPostNumbers.add(postNumber);
    }
  });

  return {
    bookmarkedPostIds,
    bookmarkedPostNumbers,
    topicBookmarked,
  };
}

function readerBookmarkContext(
  reader: TopicReaderData,
): Pick<ReaderPostContext, 'bookmarkedPostIds' | 'bookmarkedPostNumbers' | 'topicBookmarked'> {
  const bookmarkedPosts = reader.posts.filter((post) => post.actions.bookmarked === true);
  return {
    bookmarkedPostIds: new Set(bookmarkedPosts.map((post) => post.id)),
    bookmarkedPostNumbers: new Set(bookmarkedPosts.map((post) => post.postNumber)),
    topicBookmarked: reader.posts.find((post) => post.postNumber === 1)?.actions.bookmarked ?? null,
  };
}

function markOriginalPoster(
  posts: TopicReaderPost[],
  opAuthor: TopicReaderAuthor | null,
): TopicReaderPost[] {
  return posts.map((post) => ({
    ...post,
    isOriginalPoster: post.isOriginalPost || isSameAuthor(post.author, opAuthor),
  }));
}

function buildReplyTree(posts: TopicReaderPost[]): TopicReplyNode[] {
  const comments = posts.filter((post) => !post.isOriginalPost);
  const nodes = new Map<number, TopicReplyNode>();
  const roots: TopicReplyNode[] = [];

  for (const post of comments) {
    nodes.set(post.postNumber, {
      post,
      children: [],
      depth: 0,
    });
  }

  for (const post of comments) {
    const node = nodes.get(post.postNumber);
    if (!node) {
      continue;
    }

    const parentNumber = post.replyToPostNumber;
    const parent = parentNumber && parentNumber !== 1 ? nodes.get(parentNumber) : undefined;
    if (parent && parent.post.postNumber !== post.postNumber) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const visit = (node: TopicReplyNode, depth: number, seen: Set<number>): void => {
    if (seen.has(node.post.postNumber)) {
      node.children = [];
      return;
    }

    node.depth = depth;
    const nextSeen = new Set(seen);
    nextSeen.add(node.post.postNumber);
    node.children.forEach((child) => visit(child, depth + 1, nextSeen));
  };

  roots.forEach((node) => visit(node, 0, new Set()));
  return roots;
}

function payloadPosts(payload: DiscourseTopicResponse): DiscoursePostResponse[] {
  return payload.post_stream?.posts ?? payload.posts ?? [];
}

function loadedPostIdsFrom(posts: TopicReaderPost[]): number[] {
  return Array.from(new Set(posts.map((post) => post.id).filter((id) => id > 0)));
}

function hasUnloadedPosts(postStream: number[], loadedPostIds: number[]): boolean {
  if (!postStream.length) {
    return false;
  }

  const loaded = new Set(loadedPostIds);
  return postStream.some((postId) => !loaded.has(postId));
}

function isSameAuthor(author: TopicReaderAuthor, opAuthor: TopicReaderAuthor | null): boolean {
  if (!opAuthor) {
    return false;
  }

  if (author.id && opAuthor.id) {
    return author.id === opAuthor.id;
  }

  return Boolean(author.username && opAuthor.username && author.username === opAuthor.username);
}

function avatarUrl(template: unknown, fallback: string, options: NormalizeReaderOptions): string {
  const text = textValue(template);
  if (!text) {
    return fallback;
  }

  const url = text.replace('{size}', '96');
  return /^https?:\/\//i.test(url) ? url : new URL(url, options.origin ?? DEFAULT_ORIGIN).toString();
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  const parsed = numeric(value);
  return parsed > 0 ? parsed : null;
}

function numericArray(values: unknown): number[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map(numeric).filter((value) => value > 0);
}

function textValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }
  }
  return fallback;
}

function confirmedBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

