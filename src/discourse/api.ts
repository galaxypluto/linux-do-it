import { endpointForCurrentRoute } from "./endpoints";
import { cleanReaderTitle, normalizeTagName, normalizeTopicList } from "./normalize";
import { sanitizeCookedHtml } from "../preview/sanitize";
import { paceDiscourseRequest } from "../shared/discourseRequestPacer";
import type {
  DiscourseCategory,
  DiscourseListResponse,
  DiscoursePostResponse,
  DiscourseTopicResponse,
  DiscourseUserProfileResponse,
  ReaderUserProfileData,
  ReaderPollResultData,
  TopicCardData,
  TopicListData,
  TopicReaderAuthor,
  TopicReaderData,
  TopicReaderPost,
  TopicReaderBoost,
  TopicReplyNode
} from "./types";

const JSON_HEADERS = {
  Accept: "application/json"
};
const READER_CACHE_TTL_MS = 30 * 60 * 1000;
const READER_CACHE_VERSION = 16;
const USER_PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;
const USER_PROFILE_CACHE_VERSION = 1;
const READER_READ_TIMING_MS_PER_POST = 1000;
const READER_READ_TIMING_TOPIC_TIME_CAP_MS = 60 * 1000;

async function pacedDiscourseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  await paceDiscourseRequest();
  return fetch(input, init);
}

interface ReaderCacheRecord {
  version: number;
  cachedAt: number;
  data: TopicReaderData;
}

interface ReaderPostContext {
  topicUrl: string;
  fallbackCreatedAt: string;
  fallbackAuthor: TopicReaderAuthor | null;
  canReply: boolean | null;
  bookmarkedPostIds: ReadonlySet<number>;
  bookmarkedPostNumbers: ReadonlySet<number>;
  topicBookmarked: boolean | null;
}

interface UserProfileCacheRecord {
  version: number;
  cachedAt: number;
  data: ReaderUserProfileData;
}

interface SiteMetadataResponse {
  categories?: DiscourseCategory[];
}

export interface ReaderReadTimingPayload {
  topic_id: number;
  topic_time: number;
  timings: Record<string, number>;
}

export interface ReaderPollVotePayload {
  post_id: number;
  poll_name: string;
  options: string[];
}

export interface ReaderPollVoteResult {
  ok: boolean;
  poll: ReaderPollResultData | null;
  selectedOptionIds: string[];
}

export type TopicReadTimingSyncResult = "synced" | "skipped" | "failed";

let siteCategoriesCache: DiscourseCategory[] | null = null;
let siteCategoriesPromise: Promise<DiscourseCategory[]> | null = null;
let csrfTokenPromise: Promise<string | null> | null = null;

export async function fetchCurrentTopicList(signal?: AbortSignal): Promise<TopicListData> {
  const endpoint = endpointForCurrentRoute();
  return fetchTopicList(endpoint, signal);
}

export async function fetchTopicList(endpoint: string, signal?: AbortSignal): Promise<TopicListData> {
  const response = await pacedDiscourseFetch(endpoint, {
    credentials: "include",
    headers: JSON_HEADERS,
    signal
  });

  if (!response.ok) {
    throw new Error(`Linux.do returned ${response.status} for ${endpoint}`);
  }

  const payload = (await response.json()) as DiscourseListResponse;
  await hydrateCategoryMetadata(payload, signal);
  return normalizeTopicList(payload, endpoint);
}

export function endpointFromMoreTopicsUrl(moreTopicsUrl: string): string {
  if (!moreTopicsUrl) {
    return "";
  }

  const url = new URL(moreTopicsUrl, window.location.origin);
  if (!url.pathname.endsWith(".json")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}.json`;
  }

  return `${url.pathname}${url.search}`;
}

export async function fetchTopicReader(
  topic: TopicCardData,
  signal?: AbortSignal,
  { skipCache = false }: { skipCache?: boolean } = {}
): Promise<TopicReaderData> {
  const cacheKey = readerCacheKey(topic.id);
  if (!skipCache) {
    const cached = readReaderCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const response = await pacedDiscourseFetch(`/t/${topic.slug}/${topic.id}.json`, {
    credentials: "include",
    headers: JSON_HEADERS,
    signal
  });

  if (!response.ok) {
    throw new Error(`Linux.do returned ${response.status} for topic ${topic.id}`);
  }

  const reader = topicReaderFromPayload(topic, (await response.json()) as DiscourseTopicResponse);
  writeReaderCache(cacheKey, reader);
  return reader;
}

function topicReaderFromPayload(topic: TopicCardData, payload: DiscourseTopicResponse): TopicReaderData {
  const fallbackAuthor = topic.posters[0]
    ? {
        id: topic.posters[0].id,
        username: topic.posters[0].username,
        name: "",
        avatarUrl: topic.posters[0].avatarUrl
      }
    : null;
  const canReply = confirmedBoolean(payload.details?.can_create_post);
  const posts = normalizeReaderPosts(payloadPosts(payload), {
    topicUrl: topic.url,
    fallbackCreatedAt: textValue(payload.created_at) || topic.dates.createdAt,
    fallbackAuthor,
    canReply,
    ...bookmarkedPostContext(payload, confirmedBoolean(payload.bookmarked) ?? topic.flags.bookmarked)
  });
  const opAuthor = posts.find((post) => post.isOriginalPost)?.author || posts[0]?.author || fallbackAuthor;
  const markedPosts = markOriginalPoster(posts, opAuthor);
  const postStream = numericArray(payload.post_stream?.stream);
  const loadedPostIds = loadedPostIdsFrom(markedPosts);
  const statsPosts = numeric(payload.posts_count) || Math.max(topic.stats.replies + 1, markedPosts.length);
  const reader: TopicReaderData = {
    id: topic.id,
    title: cleanReaderTitle(textValue(payload.fancy_title) || textValue(payload.title) || topic.title) || "Untitled topic",
    url: topic.url,
    slug: topic.slug,
    stats: {
      posts: statsPosts,
      views: numeric(payload.views || topic.stats.views),
      likes: numeric(payload.like_count || topic.stats.likes)
    },
    actions: {
      canReply,
      draftKey: textValue(payload.draft_key),
      draftSequence: numeric(payload.draft_sequence)
    },
    tags: Array.isArray(payload.tags) ? payload.tags.map(normalizeTagName).filter(Boolean) : topic.tags,
    category: topic.category,
    opAuthor,
    posts: markedPosts,
    tree: buildReplyTree(markedPosts),
    postStream,
    loadedPostIds,
    hasMorePosts: hasUnloadedPosts(postStream, loadedPostIds)
  };
  return reader;
}

export async function fetchTopicReaderAtPost(
  topic: TopicCardData,
  postNumber: number,
  signal?: AbortSignal
): Promise<TopicReaderData> {
  const safePostNumber = Number.isFinite(postNumber) && postNumber > 0 ? Math.floor(postNumber) : 0;
  const endpoint =
    safePostNumber > 1
      ? `/t/${topic.slug}/${topic.id}/${safePostNumber}.json`
      : `/t/${topic.slug}/${topic.id}.json`;
  const response = await pacedDiscourseFetch(endpoint, {
    credentials: "include",
    headers: JSON_HEADERS,
    signal
  });

  if (!response.ok) {
    throw new Error(`Linux.do returned ${response.status} for topic ${topic.id} post ${safePostNumber || 1}`);
  }

  return topicReaderFromPayload(topic, (await response.json()) as DiscourseTopicResponse);
}

export function getCachedTopicReader(topicId: number): TopicReaderData | null {
  return readReaderCache(readerCacheKey(topicId));
}

export function rememberCachedTopicReader(reader: TopicReaderData): void {
  writeReaderCache(readerCacheKey(reader.id), reader);
}

export function readerReadTimingPayload(
  reader: TopicReaderData,
  postNumbers?: ReadonlySet<number>
): ReaderReadTimingPayload | null {
  const timings: Record<string, number> = {};
  const seen = new Set<number>();

  for (const post of reader.posts) {
    if (!Number.isFinite(post.postNumber) || post.postNumber <= 0) {
      continue;
    }
    if (postNumbers && !postNumbers.has(post.postNumber)) {
      continue;
    }
    if (seen.has(post.postNumber)) {
      continue;
    }

    seen.add(post.postNumber);
    timings[String(post.postNumber)] = READER_READ_TIMING_MS_PER_POST;
  }

  const postCount = Object.keys(timings).length;
  if (!postCount) {
    return null;
  }

  return {
    topic_id: reader.id,
    topic_time: Math.min(postCount * READER_READ_TIMING_MS_PER_POST, READER_READ_TIMING_TOPIC_TIME_CAP_MS),
    timings
  };
}

export async function syncTopicReadTimings(
  reader: TopicReaderData,
  options: {
    postNumbers?: ReadonlySet<number>;
    signal?: AbortSignal;
  } = {}
): Promise<TopicReadTimingSyncResult> {
  const payload = readerReadTimingPayload(reader, options.postNumbers);
  if (!payload) {
    return "skipped";
  }

  const csrfToken = await discourseCsrfToken(options.signal);
  if (!csrfToken) {
    return "skipped";
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "X-CSRF-Token": csrfToken,
  };

  const response = await pacedDiscourseFetch(`/t/${reader.id}/timings`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
    signal: options.signal
  });

  if (response.ok) {
    return "synced";
  }

  if (response.status === 401 || response.status === 403 || response.status === 404 || response.status === 419) {
    return "skipped";
  }

  return "failed";
}

export async function voteReaderPoll(
  vote: {
    postId: number;
    pollName: string;
    optionIds: string[];
  },
  signal?: AbortSignal
): Promise<ReaderPollVoteResult> {
  const postId = numeric(vote.postId);
  const pollName = textValue(vote.pollName).trim();
  const optionIds = vote.optionIds.map((optionId) => textValue(optionId).trim()).filter(Boolean);
  if (!postId || !pollName || !optionIds.length) {
    return emptyPollVoteResult(false);
  }

  const csrfToken = await discourseCsrfToken(signal);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest"
  };
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const payload: ReaderPollVotePayload = {
    post_id: postId,
    poll_name: pollName,
    options: optionIds
  };
  const response = await pacedDiscourseFetch("/polls/vote", {
    method: "PUT",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    return emptyPollVoteResult(false);
  }

  const body = (await safeJson(response)) as { poll?: unknown; vote?: unknown };
  return {
    ok: true,
    poll: normalizePollResultData(body.poll, pollName),
    selectedOptionIds: normalizeSelectedPollOptions(body.vote)
  };
}

export async function fetchMoreReaderPosts(
  reader: TopicReaderData,
  limit = 20,
  signal?: AbortSignal
): Promise<TopicReaderData> {
  if (!reader.hasMorePosts) {
    return reader;
  }

  const loadedIds = new Set(reader.loadedPostIds);
  const nextPostIds = reader.postStream.filter((id) => !loadedIds.has(id)).slice(0, limit);
  if (!nextPostIds.length) {
    return {
      ...reader,
      hasMorePosts: false
    };
  }

  const payload = await fetchReaderPostBatch(reader, nextPostIds, signal);
  const posts = markOriginalPoster(
    normalizeReaderPosts(payloadPosts(payload), {
      topicUrl: reader.url,
      fallbackCreatedAt: reader.posts[0]?.createdAt || "",
      fallbackAuthor: reader.opAuthor,
      canReply: reader.actions.canReply,
      ...readerBookmarkContext(reader)
    }),
    reader.opAuthor
  );
  const merged = mergeReaderPosts(reader, posts);
  writeReaderCache(readerCacheKey(reader.id), merged);
  return merged;
}

export async function fetchSelectedReaderPosts(
  reader: TopicReaderData,
  postIds: number[],
  signal?: AbortSignal
): Promise<TopicReaderData> {
  const loadedIds = new Set(reader.loadedPostIds);
  const ids = Array.from(new Set(postIds.filter((id) => Number.isFinite(id) && !loadedIds.has(id))));
  if (!ids.length) {
    return reader;
  }

  let merged = reader;
  for (let index = 0; index < ids.length; index += 20) {
    const batch = ids.slice(index, index + 20);
    const payload = await fetchReaderPostBatch(merged, batch, signal);
    const posts = markOriginalPoster(
      normalizeReaderPosts(payloadPosts(payload), {
        topicUrl: merged.url,
        fallbackCreatedAt: merged.posts[0]?.createdAt || "",
        fallbackAuthor: merged.opAuthor,
        canReply: merged.actions.canReply,
        ...readerBookmarkContext(merged)
      }),
      merged.opAuthor
    );
    merged = mergeReaderPosts(merged, posts);
  }

  writeReaderCache(readerCacheKey(reader.id), merged);
  return merged;
}

export function mergeReaderPostsIntoReader(
  reader: TopicReaderData,
  posts: TopicReaderPost[]
): TopicReaderData {
  return mergeReaderPosts(reader, posts);
}

export async function fetchReaderUserProfile(
  username: string,
  fallback: Partial<Pick<ReaderUserProfileData, "name" | "avatarUrl">> = {},
  signal?: AbortSignal
): Promise<ReaderUserProfileData> {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    throw new Error("缺少用户名");
  }

  const cacheKey = userProfileCacheKey(normalizedUsername);
  const cached = readUserProfileCache(cacheKey);
  if (cached) {
    return cached;
  }

  const encodedUsername = encodeURIComponent(normalizedUsername);
  const response = await pacedDiscourseFetch(`/u/${encodedUsername}.json`, {
    credentials: "include",
    headers: JSON_HEADERS,
    signal
  });

  if (!response.ok) {
    throw new Error(`Linux.do returned ${response.status} for user ${normalizedUsername}`);
  }

  const payload = (await response.json()) as DiscourseUserProfileResponse;
  const user = payload.user || {};
  const profile: ReaderUserProfileData = {
    id: nullableNumber(user.id),
    username: typeof user.username === "string" ? user.username : normalizedUsername,
    name: typeof user.name === "string" ? user.name : (fallback.name || normalizedUsername),
    avatarUrl: typeof user.avatar_template === "string" ? avatarUrl(user.avatar_template, "") : avatarUrl(undefined, fallback.avatarUrl || ""),
    joinedAt: textValue(user.created_at),
    profileUrl: `/u/${encodedUsername}/summary`,
    messageUrl: `/new-message?username=${encodedUsername}`,
    canMessage: booleanValue(user.can_send_private_message_to_user ?? user.can_send_private_message, true)
  };

  writeUserProfileCache(cacheKey, profile);
  return profile;
}

async function fetchReaderPostBatch(
  reader: TopicReaderData,
  postIds: number[],
  signal?: AbortSignal
): Promise<DiscourseTopicResponse> {
  const params = new URLSearchParams();
  postIds.forEach((id) => params.append("post_ids[]", String(id)));
  const search = params.toString();
  const endpoints = [
    `/t/${reader.id}/posts.json?${search}`,
    `/t/${reader.slug}/${reader.id}/posts.json?${search}`
  ];
  let lastStatus = 0;

  for (const endpoint of endpoints) {
    const response = await pacedDiscourseFetch(endpoint, {
      credentials: "include",
      headers: JSON_HEADERS,
      signal
    });
    if (response.ok) {
      return (await response.json()) as DiscourseTopicResponse;
    }

    lastStatus = response.status;
    if (response.status !== 400 && response.status !== 404) {
      throw new Error(`Linux.do returned ${response.status} for more posts`);
    }
  }

  throw new Error(`Linux.do returned ${lastStatus || "unknown"} for more posts`);
}

function mergeReaderPosts(reader: TopicReaderData, incomingPosts: TopicReaderPost[]): TopicReaderData {
  if (!incomingPosts.length) {
    return {
      ...reader,
      hasMorePosts: hasUnloadedPosts(reader.postStream, reader.loadedPostIds)
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
      posts: Math.max(reader.stats.posts, posts.length)
    },
    posts,
    tree: buildReplyTree(posts),
    loadedPostIds,
    hasMorePosts: hasUnloadedPosts(reader.postStream, loadedPostIds)
  };
}

function normalizeReaderPosts(
  rawPosts: DiscoursePostResponse[],
  context: ReaderPostContext
): TopicReaderPost[] {
  return rawPosts
    .map((post, index) => {
      const postNumber = numeric(post.post_number) || index + 1;
      const postId = numeric(post.id) || postNumber;
      const userId = nullableNumber(post.user_id);
      const isFallback = !userId || userId === context.fallbackAuthor?.id;
      const username = typeof post.username === "string" ? post.username : (isFallback ? context.fallbackAuthor?.username || "" : "");
      const postUrl = `${context.topicUrl}/${postNumber}`;
      return {
        id: postId,
        postNumber,
        replyToPostNumber: nullableNumber(post.reply_to_post_number),
        author: {
          id: userId || context.fallbackAuthor?.id || null,
          username,
          name: typeof post.name === "string" ? post.name : (isFallback ? context.fallbackAuthor?.name || "" : ""),
          avatarUrl: typeof post.avatar_template === "string" ? avatarUrl(post.avatar_template, "") : avatarUrl(undefined, isFallback ? context.fallbackAuthor?.avatarUrl || "" : "")
        },
        createdAt: textValue(post.created_at) || context.fallbackCreatedAt,
        html: sanitizeCookedHtml(post.cooked, { postId, polls: post.polls }),
        stats: {
          likes: numeric(post.like_count),
          reads: numeric(post.reads),
          replies: numeric(post.reply_count)
        },
        actions: normalizePostActions(post, postId, postNumber, context),
        url: postUrl,
        isOriginalPost: postNumber === 1,
        isOriginalPoster: postNumber === 1,
        boosts: normalizeBoosts(post.boosts, context)
      };
    })
    .filter((post) => post.html || post.isOriginalPost);
}

function normalizeBoosts(rawBoosts: any[] | undefined, context: ReaderPostContext): TopicReaderBoost[] {
  if (!Array.isArray(rawBoosts)) {
    return [];
  }
  return rawBoosts.map((boost, index) => {
    const isFallback = !boost.user?.id || boost.user?.id === context.fallbackAuthor?.id;
    const boostId = boost.id ?? `boost-${index}`;
    return {
      id: boostId,
      cooked: sanitizeCookedHtml(textValue(boost.cooked), { postId: 0, polls: [] }),
      user: {
        id: nullableNumber(boost.user?.id) || context.fallbackAuthor?.id || null,
        username: typeof boost.user?.username === "string" ? boost.user.username : (isFallback ? context.fallbackAuthor?.username || "" : ""),
        name: typeof boost.user?.name === "string" ? boost.user.name : (isFallback ? context.fallbackAuthor?.name || "" : ""),
        avatarUrl: typeof boost.user?.avatar_template === "string" ? avatarUrl(boost.user.avatar_template, "") : avatarUrl(undefined, isFallback ? context.fallbackAuthor?.avatarUrl || "" : "")
      },
      canDelete: confirmedBoolean(boost.can_delete)
    };
  });
}

function normalizePostActions(
  post: DiscoursePostResponse,
  postId: number,
  postNumber: number,
  context: ReaderPostContext
): TopicReaderPost["actions"] {
  const likeAction = post.actions_summary?.find((action) => {
    const actionId = numeric(action.id);
    const nameKey = textValue(action.name_key).toLowerCase();
    return actionId === 2 || nameKey === "like";
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
    canBoost: confirmedBoolean(post.can_boost) ?? false
  };
}

function bookmarkedPostContext(
  payload: DiscourseTopicResponse,
  topicBookmarked: boolean | null
): Pick<ReaderPostContext, "bookmarkedPostIds" | "bookmarkedPostNumbers" | "topicBookmarked"> {
  const bookmarkedPostIds = new Set<number>();
  const bookmarkedPostNumbers = new Set<number>();
  payload.bookmarks?.forEach((bookmark) => {
    const bookmarkableType = textValue(bookmark.bookmarkable_type).toLowerCase();
    if (bookmarkableType && bookmarkableType !== "post") {
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
    topicBookmarked
  };
}

function readerBookmarkContext(
  reader: TopicReaderData
): Pick<ReaderPostContext, "bookmarkedPostIds" | "bookmarkedPostNumbers" | "topicBookmarked"> {
  const bookmarkedPosts = reader.posts.filter((post) => post.actions.bookmarked === true);
  return {
    bookmarkedPostIds: new Set(bookmarkedPosts.map((post) => post.id)),
    bookmarkedPostNumbers: new Set(bookmarkedPosts.map((post) => post.postNumber)),
    topicBookmarked: reader.posts.find((post) => post.postNumber === 1)?.actions.bookmarked ?? null
  };
}

function markOriginalPoster(
  posts: TopicReaderPost[],
  opAuthor: TopicReaderAuthor | null
): TopicReaderPost[] {
  return posts.map((post) => ({
    ...post,
    isOriginalPoster: post.isOriginalPost || isSameAuthor(post.author, opAuthor)
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
      depth: 0
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

function readReaderCache(cacheKey: string): TopicReaderData | null {
  const raw = safeSessionGet(cacheKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ReaderCacheRecord;
    if (isReaderCacheRecord(parsed)) {
      if (Date.now() - parsed.cachedAt <= READER_CACHE_TTL_MS) {
        return parsed.data;
      }
      safeSessionRemove(cacheKey);
      return null;
    }
  } catch {
    safeSessionRemove(cacheKey);
    return null;
  }

  safeSessionRemove(cacheKey);
  return null;
}

function writeReaderCache(cacheKey: string, data: TopicReaderData): void {
  const record: ReaderCacheRecord = {
    version: READER_CACHE_VERSION,
    cachedAt: Date.now(),
    data
  };
  safeSessionSet(cacheKey, JSON.stringify(record));
}

function readUserProfileCache(cacheKey: string): ReaderUserProfileData | null {
  const raw = safeSessionGet(cacheKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as UserProfileCacheRecord;
    if (isUserProfileCacheRecord(parsed)) {
      if (Date.now() - parsed.cachedAt <= USER_PROFILE_CACHE_TTL_MS) {
        return parsed.data;
      }
      safeSessionRemove(cacheKey);
      return null;
    }
  } catch {
    safeSessionRemove(cacheKey);
    return null;
  }

  safeSessionRemove(cacheKey);
  return null;
}

function writeUserProfileCache(cacheKey: string, data: ReaderUserProfileData): void {
  const record: UserProfileCacheRecord = {
    version: USER_PROFILE_CACHE_VERSION,
    cachedAt: Date.now(),
    data
  };
  safeSessionSet(cacheKey, JSON.stringify(record));
}

function isReaderCacheRecord(value: unknown): value is ReaderCacheRecord {
  const record = value as Partial<ReaderCacheRecord>;
  return (
    record?.version === READER_CACHE_VERSION &&
    typeof record?.cachedAt === "number" &&
    isTopicReaderData(record?.data)
  );
}

function isTopicReaderData(value: unknown): value is TopicReaderData {
  const reader = value as Partial<TopicReaderData>;
  const stats = reader?.stats as Partial<TopicReaderData["stats"]> | undefined;
  const actions = reader?.actions as Partial<TopicReaderData["actions"]> | undefined;
  return (
    typeof reader?.id === "number" &&
    typeof reader.title === "string" &&
    typeof reader.url === "string" &&
    typeof reader.slug === "string" &&
    typeof stats?.posts === "number" &&
    typeof stats?.views === "number" &&
    typeof stats?.likes === "number" &&
    (actions?.canReply === null || typeof actions?.canReply === "boolean") &&
    typeof actions?.draftKey === "string" &&
    typeof actions?.draftSequence === "number" &&
    Array.isArray(reader.tags) &&
    (reader.category === undefined || typeof reader.category === "object") &&
    (reader.opAuthor === null || typeof reader.opAuthor === "object") &&
    Array.isArray(reader.posts) &&
    Array.isArray(reader.tree) &&
    Array.isArray(reader.postStream) &&
    Array.isArray(reader.loadedPostIds) &&
    typeof reader.hasMorePosts === "boolean"
  );
}

function isUserProfileCacheRecord(value: unknown): value is UserProfileCacheRecord {
  const record = value as Partial<UserProfileCacheRecord>;
  return (
    record?.version === USER_PROFILE_CACHE_VERSION &&
    typeof record.cachedAt === "number" &&
    isReaderUserProfileData(record.data)
  );
}

function isReaderUserProfileData(value: unknown): value is ReaderUserProfileData {
  const profile = value as Partial<ReaderUserProfileData>;
  return (
    (profile.id === null || typeof profile.id === "number") &&
    typeof profile.username === "string" &&
    typeof profile.name === "string" &&
    typeof profile.avatarUrl === "string" &&
    typeof profile.joinedAt === "string" &&
    typeof profile.profileUrl === "string" &&
    typeof profile.messageUrl === "string" &&
    typeof profile.canMessage === "boolean"
  );
}

function readerCacheKey(topicId: number): string {
  return `ldcv:reader:${topicId}`;
}

function userProfileCacheKey(username: string): string {
  return `ldcv:user-profile:${username.toLowerCase()}`;
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

async function hydrateCategoryMetadata(payload: DiscourseListResponse, signal?: AbortSignal): Promise<void> {
  if (hasCategoryMetadata(payload)) {
    return;
  }

  try {
    const categories = await fetchSiteCategories(signal);
    if (categories.length) {
      payload.categories = categories;
    }
  } catch {
    // Tags still render without category metadata; avoid failing the topic list for optional chrome.
  }
}

function hasCategoryMetadata(payload: DiscourseListResponse): boolean {
  return Boolean(payload.categories?.length || payload.category_list?.categories?.length);
}

async function fetchSiteCategories(signal?: AbortSignal): Promise<DiscourseCategory[]> {
  if (siteCategoriesCache) {
    return siteCategoriesCache;
  }

  siteCategoriesPromise ??= pacedDiscourseFetch("/site.json", {
    credentials: "include",
    headers: JSON_HEADERS,
    signal
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Linux.do returned ${response.status} for /site.json`);
      }

      const payload = (await response.json()) as SiteMetadataResponse;
      siteCategoriesCache = Array.isArray(payload.categories) ? payload.categories : [];
      return siteCategoriesCache;
    })
    .finally(() => {
      siteCategoriesPromise = null;
    });

  return siteCategoriesPromise;
}

function avatarUrl(template: unknown, fallback: string): string {
  const text = textValue(template);
  if (!text) {
    return fallback;
  }

  const url = text.replace("{size}", "96");
  return /^https?:\/\//i.test(url) ? url : new URL(url, window.location.origin).toString();
}

function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function emptyPollVoteResult(ok: boolean): ReaderPollVoteResult {
  return {
    ok,
    poll: null,
    selectedOptionIds: []
  };
}

function normalizePollResultData(value: unknown, fallbackName: string): ReaderPollResultData | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = textValue(value.name).trim() || fallbackName;
  const options = Array.isArray(value.options)
    ? value.options
        .map((option): ReaderPollResultData["options"][number] | null => {
          if (!isRecord(option)) {
            return null;
          }
          const id = textValue(option.id).trim();
          const label = cleanPollLabel(option.html) || id;
          if (!id || !label) {
            return null;
          }
          return {
            id,
            label,
            votes: numeric(option.votes)
          };
        })
        .filter((option): option is ReaderPollResultData["options"][number] => Boolean(option))
    : [];

  return {
    name,
    voters: numeric(value.voters),
    options
  };
}

function normalizeSelectedPollOptions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((optionId) => textValue(optionId).trim()).filter(Boolean);
}

function cleanPollLabel(value: unknown): string {
  return textValue(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
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
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }
  return fallback;
}

function confirmedBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }
  return null;
}

async function discourseCsrfToken(signal?: AbortSignal): Promise<string | null> {
  const documentToken = csrfTokenFromDocument();
  if (documentToken) {
    return documentToken;
  }

  csrfTokenPromise ??= pacedDiscourseFetch("/session/csrf.json", {
    credentials: "include",
    headers: JSON_HEADERS,
    signal
  })
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }
      const payload = (await response.json()) as { csrf?: unknown };
      return textValue(payload.csrf) || null;
    })
    .catch(() => null)
    .finally(() => {
      csrfTokenPromise = null;
    });

  return csrfTokenPromise;
}

function csrfTokenFromDocument(documentRef: Document = document): string {
  return textValue(documentRef.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content).trim();
}

function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Cache writes should never block opening the reader.
  }
}

function safeSessionRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures; the next fetch can rebuild reader data.
  }
}

export async function createBoost(postId: number, raw: string, signal?: AbortSignal): Promise<TopicReaderBoost> {
  const csrfToken = await discourseCsrfToken(signal);
  if (!csrfToken) {
    throw new Error("Unable to obtain CSRF token for boost creation");
  }

  const response = await pacedDiscourseFetch(`/discourse-boosts/posts/${postId}/boosts`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...JSON_HEADERS,
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRF-Token": csrfToken
    },
    body: JSON.stringify({ raw }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Failed to create boost: ${response.status}`);
  }

  const payload = await response.json();
  const normalized = normalizeBoosts([payload], {
    topicUrl: "",
    fallbackCreatedAt: "",
    fallbackAuthor: null,
    canReply: null,
    bookmarkedPostIds: new Set(),
    bookmarkedPostNumbers: new Set(),
    topicBookmarked: null
  });
  const boost = normalized[0];
  if (!boost) {
    throw new Error("Failed to normalize boost payload");
  }
  return boost;
}

export async function deleteBoost(boostId: number | string, signal?: AbortSignal): Promise<void> {
  const csrfToken = await discourseCsrfToken(signal);
  if (!csrfToken) {
    throw new Error("Unable to obtain CSRF token for boost deletion");
  }

  const response = await pacedDiscourseFetch(`/discourse-boosts/boosts/${boostId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      ...JSON_HEADERS,
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRF-Token": csrfToken
    },
    signal
  });

  if (!response.ok) {
    throw new Error(`Failed to delete boost: ${response.status}`);
  }
}

/** 拉取单个 boost 的删除权限（topic JSON 常缺 can_delete） */
export async function fetchBoost(boostId: number | string, signal?: AbortSignal): Promise<TopicReaderBoost> {
  const response = await pacedDiscourseFetch(`/discourse-boosts/boosts/${boostId}`, {
    method: "GET",
    credentials: "include",
    headers: {
      ...JSON_HEADERS,
      "X-Requested-With": "XMLHttpRequest"
    },
    signal
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch boost: ${response.status}`);
  }

  const payload = await response.json();
  const normalized = normalizeBoosts([payload], {
    topicUrl: "",
    fallbackCreatedAt: "",
    fallbackAuthor: null,
    canReply: null,
    bookmarkedPostIds: new Set(),
    bookmarkedPostNumbers: new Set(),
    topicBookmarked: null
  });
  const boost = normalized[0];
  if (!boost) {
    throw new Error("Failed to normalize boost payload");
  }
  return boost;
}

