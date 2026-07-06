import { endpointForLinuxDoRoute } from '../../domain/linuxdo/routes';
import {
  createReaderUserProfile,
  mergeReaderPostsIntoReader,
  nextUnloadedPostIds,
  normalizeFetchedReaderPosts,
  normalizeTopicReader,
} from '../../domain/linuxdo/reader';
import { normalizeSearchTopics, normalizeTopicList } from '../../domain/linuxdo/normalize';
import type {
  DiscourseCategory,
  DiscourseListResponse,
  DiscourseSearchResponse,
  DiscourseTopicResponse,
  ReaderUserProfileData,
  TopicCardData,
  TopicListData,
  TopicReaderData,
  TopicReaderPost,
} from '../../domain/linuxdo/types';
import type { CachePort } from '../../ports/CachePort';
import type { HttpPort } from '../../ports/HttpPort';

const JSON_HEADERS = {
  Accept: 'application/json',
};
const DEFAULT_ORIGIN = 'https://linux.do';
const READER_CACHE_TTL_MS = 30 * 60 * 1000;
const READER_CACHE_VERSION = 14;
const USER_PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;
const USER_PROFILE_CACHE_VERSION = 1;

type LinuxDoApiServiceOptions = {
  http: HttpPort;
  cache?: CachePort;
  origin?: string;
  useAbsoluteUrls?: boolean;
  now?: () => number;
};

type ReaderCacheRecord = {
  version: number;
  cachedAt: number;
  data: TopicReaderData;
};

type UserProfileCacheRecord = {
  version: number;
  cachedAt: number;
  data: ReaderUserProfileData;
};

type SiteMetadataResponse = {
  categories?: DiscourseCategory[];
};

export class LinuxDoApiService {
  private readonly http: HttpPort;
  private readonly cache?: CachePort;
  private readonly origin: string;
  private readonly useAbsoluteUrls: boolean;
  private readonly now: () => number;
  private siteCategoriesCache: DiscourseCategory[] | null = null;
  private siteCategoriesPromise: Promise<DiscourseCategory[]> | null = null;

  constructor(options: LinuxDoApiServiceOptions) {
    this.http = options.http;
    this.cache = options.cache;
    this.origin = options.origin ?? DEFAULT_ORIGIN;
    this.useAbsoluteUrls = options.useAbsoluteUrls ?? false;
    this.now = options.now ?? Date.now;
  }

  fetchCurrentTopicList(location: Pick<Location, 'pathname' | 'search'> | URL, signal?: AbortSignal): Promise<TopicListData> {
    return this.fetchTopicList(endpointForLinuxDoRoute(location), signal);
  }

  async fetchTopicList(endpoint: string, signal?: AbortSignal): Promise<TopicListData> {
    const payload = await this.fetchJson<DiscourseListResponse>(endpoint, `for ${endpoint}`, signal);
    await this.hydrateCategoryMetadata(payload, signal);
    return normalizeTopicList(payload, endpoint, { origin: this.origin });
  }

  async searchTopics(
    query: string,
    pageOrSignal?: number | AbortSignal,
    signal?: AbortSignal,
  ): Promise<TopicCardData[]> {
    let page = 1;
    let actualSignal = signal;

    if (typeof pageOrSignal === 'number') {
      page = pageOrSignal;
    } else if (pageOrSignal instanceof AbortSignal || (pageOrSignal && 'aborted' in (pageOrSignal as any))) {
      actualSignal = pageOrSignal;
    }

    const endpoint = `/search.json?q=${encodeURIComponent(query)}&page=${page}`;
    const payload = await this.fetchJson<DiscourseSearchResponse>(endpoint, `for search ${query}`, actualSignal);
    return normalizeSearchTopics(payload);
  }

  endpointFromMoreTopicsUrl(moreTopicsUrl: string): string {
    if (!moreTopicsUrl) {
      return '';
    }

    const url = new URL(moreTopicsUrl, this.origin);
    if (!url.pathname.endsWith('.json')) {
      url.pathname = `${url.pathname.replace(/\/$/, '')}.json`;
    }

    return `${url.pathname}${url.search}`;
  }

  async fetchTopicReader(
    topic: TopicCardData,
    signal?: AbortSignal,
    { skipCache = false }: { skipCache?: boolean } = {},
  ): Promise<TopicReaderData> {
    const cacheKey = readerCacheKey(topic.id);
    if (!skipCache) {
      const cached = this.readReaderCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const payload = await this.fetchJson<DiscourseTopicResponse>(
      `/t/${topic.slug}/${topic.id}.json`,
      `for topic ${topic.id}`,
      signal,
    );
    const reader = normalizeTopicReader(topic, payload, { origin: this.origin });
    this.writeReaderCache(cacheKey, reader);
    return reader;
  }

  getCachedTopicReader(topicId: number): TopicReaderData | null {
    return this.readReaderCache(readerCacheKey(topicId));
  }

  rememberCachedTopicReader(reader: TopicReaderData): void {
    this.writeReaderCache(readerCacheKey(reader.id), reader);
  }

  async fetchMoreReaderPosts(
    reader: TopicReaderData,
    limit = 20,
    signal?: AbortSignal,
  ): Promise<TopicReaderData> {
    if (!reader.hasMorePosts) {
      return reader;
    }

    const nextPostIds = nextUnloadedPostIds(reader, limit);
    if (!nextPostIds.length) {
      return {
        ...reader,
        hasMorePosts: false,
      };
    }

    const payload = await this.fetchReaderPostBatch(reader, nextPostIds, signal);
    const posts = normalizeFetchedReaderPosts(reader, payload, { origin: this.origin });
    const merged = mergeReaderPostsIntoReader(reader, posts);
    this.writeReaderCache(readerCacheKey(reader.id), merged);
    return merged;
  }

  async fetchSelectedReaderPosts(
    reader: TopicReaderData,
    postIds: number[],
    signal?: AbortSignal,
  ): Promise<TopicReaderData> {
    const loadedIds = new Set(reader.loadedPostIds);
    const ids = Array.from(new Set(postIds.filter((id) => Number.isFinite(id) && !loadedIds.has(id))));
    if (!ids.length) {
      return reader;
    }

    let merged = reader;
    for (let index = 0; index < ids.length; index += 20) {
      const batch = ids.slice(index, index + 20);
      const payload = await this.fetchReaderPostBatch(merged, batch, signal);
      const posts = normalizeFetchedReaderPosts(merged, payload, { origin: this.origin });
      merged = mergeReaderPostsIntoReader(merged, posts);
    }

    this.writeReaderCache(readerCacheKey(reader.id), merged);
    return merged;
  }

  mergeReaderPostsIntoReader(reader: TopicReaderData, posts: TopicReaderPost[]): TopicReaderData {
    return mergeReaderPostsIntoReader(reader, posts);
  }

  async fetchReaderUserProfile(
    username: string,
    fallback: Partial<Pick<ReaderUserProfileData, 'name' | 'avatarUrl'>> = {},
    signal?: AbortSignal,
  ): Promise<ReaderUserProfileData> {
    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      throw new Error('缺少用户名');
    }

    const cacheKey = userProfileCacheKey(normalizedUsername);
    const cached = this.readUserProfileCache(cacheKey);
    if (cached) {
      return cached;
    }

    const encodedUsername = encodeURIComponent(normalizedUsername);
    const payload = await this.fetchJson<unknown>(`/u/${encodedUsername}.json`, `for user ${normalizedUsername}`, signal);
    const profile = createReaderUserProfile(normalizedUsername, payload, fallback, { origin: this.origin });
    this.writeUserProfileCache(cacheKey, profile);
    return profile;
  }

  private async fetchReaderPostBatch(
    reader: TopicReaderData,
    postIds: number[],
    signal?: AbortSignal,
  ): Promise<DiscourseTopicResponse> {
    const params = new URLSearchParams();
    postIds.forEach((id) => params.append('post_ids[]', String(id)));
    const search = params.toString();
    const endpoints = [`/t/${reader.id}/posts.json?${search}`, `/t/${reader.slug}/${reader.id}/posts.json?${search}`];
    let lastStatus = 0;

    for (const endpoint of endpoints) {
      const response = await this.http.request(this.requestUrl(endpoint), {
        credentials: 'include',
        headers: JSON_HEADERS,
        signal,
      });
      if (response.ok) {
        return (await response.json()) as DiscourseTopicResponse;
      }

      lastStatus = response.status;
      if (response.status !== 400 && response.status !== 404) {
        throw new Error(`Linux.do returned ${response.status} for more posts`);
      }
    }

    throw new Error(`Linux.do returned ${lastStatus || 'unknown'} for more posts`);
  }

  async hydrateCategoryMetadata(payload: DiscourseListResponse, signal?: AbortSignal): Promise<void> {
    if (hasCategoryMetadata(payload)) {
      return;
    }

    try {
      const categories = await this.fetchSiteCategories(signal);
      if (categories.length) {
        payload.categories = categories;
      }
    } catch {
      // Topic cards can still render without optional category metadata.
    }
  }

  private async fetchSiteCategories(signal?: AbortSignal): Promise<DiscourseCategory[]> {
    if (this.siteCategoriesCache) {
      return this.siteCategoriesCache;
    }

    this.siteCategoriesPromise ??= this.fetchJson<SiteMetadataResponse>('/site.json', 'for /site.json', signal)
      .then((payload) => {
        this.siteCategoriesCache = Array.isArray(payload.categories) ? payload.categories : [];
        return this.siteCategoriesCache;
      })
      .finally(() => {
        this.siteCategoriesPromise = null;
      });

    return this.siteCategoriesPromise;
  }

  private async fetchJson<T>(endpoint: string, context: string, signal?: AbortSignal): Promise<T> {
    const response = await this.http.request(this.requestUrl(endpoint), {
      credentials: 'include',
      headers: JSON_HEADERS,
      signal,
    });

    if (!response.ok) {
      throw new Error(`Linux.do returned ${response.status} ${context}`);
    }

    return (await response.json()) as T;
  }

  private requestUrl(endpoint: string): string {
    if (!this.useAbsoluteUrls || /^https?:\/\//i.test(endpoint)) {
      return endpoint;
    }

    return new URL(endpoint, this.origin).toString();
  }

  private readReaderCache(cacheKey: string): TopicReaderData | null {
    const raw = this.cache?.get(cacheKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as ReaderCacheRecord;
      if (isReaderCacheRecord(parsed)) {
        if (this.now() - parsed.cachedAt <= READER_CACHE_TTL_MS) {
          return parsed.data;
        }
        this.cache?.remove(cacheKey);
        return null;
      }
    } catch {
      this.cache?.remove(cacheKey);
      return null;
    }

    this.cache?.remove(cacheKey);
    return null;
  }

  private writeReaderCache(cacheKey: string, data: TopicReaderData): void {
    this.cache?.set(
      cacheKey,
      JSON.stringify({
        version: READER_CACHE_VERSION,
        cachedAt: this.now(),
        data,
      } satisfies ReaderCacheRecord),
    );
  }

  private readUserProfileCache(cacheKey: string): ReaderUserProfileData | null {
    const raw = this.cache?.get(cacheKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as UserProfileCacheRecord;
      if (isUserProfileCacheRecord(parsed)) {
        if (this.now() - parsed.cachedAt <= USER_PROFILE_CACHE_TTL_MS) {
          return parsed.data;
        }
        this.cache?.remove(cacheKey);
        return null;
      }
    } catch {
      this.cache?.remove(cacheKey);
      return null;
    }

    this.cache?.remove(cacheKey);
    return null;
  }

  private writeUserProfileCache(cacheKey: string, data: ReaderUserProfileData): void {
    this.cache?.set(
      cacheKey,
      JSON.stringify({
        version: USER_PROFILE_CACHE_VERSION,
        cachedAt: this.now(),
        data,
      } satisfies UserProfileCacheRecord),
    );
  }
}

function hasCategoryMetadata(payload: DiscourseListResponse): boolean {
  return Boolean(payload.categories?.length || payload.category_list?.categories?.length);
}

function readerCacheKey(topicId: number): string {
  return `ldcv:reader:${topicId}`;
}

function userProfileCacheKey(username: string): string {
  return `ldcv:user-profile:${username.toLowerCase()}`;
}

function isReaderCacheRecord(value: unknown): value is ReaderCacheRecord {
  const record = value as Partial<ReaderCacheRecord>;
  return (
    record?.version === READER_CACHE_VERSION &&
    typeof record?.cachedAt === 'number' &&
    isTopicReaderData(record?.data)
  );
}

function isTopicReaderData(value: unknown): value is TopicReaderData {
  const reader = value as Partial<TopicReaderData>;
  const stats = reader?.stats as Partial<TopicReaderData['stats']> | undefined;
  const actions = reader?.actions as Partial<TopicReaderData['actions']> | undefined;
  return (
    typeof reader?.id === 'number' &&
    typeof reader.title === 'string' &&
    typeof reader.url === 'string' &&
    typeof reader.slug === 'string' &&
    typeof stats?.posts === 'number' &&
    typeof stats?.views === 'number' &&
    typeof stats?.likes === 'number' &&
    (actions?.canReply === null || typeof actions?.canReply === 'boolean') &&
    typeof actions?.draftKey === 'string' &&
    typeof actions?.draftSequence === 'number' &&
    Array.isArray(reader.tags) &&
    (reader.category === undefined || typeof reader.category === 'object') &&
    (reader.opAuthor === null || typeof reader.opAuthor === 'object') &&
    Array.isArray(reader.posts) &&
    Array.isArray(reader.tree) &&
    Array.isArray(reader.postStream) &&
    Array.isArray(reader.loadedPostIds) &&
    typeof reader.hasMorePosts === 'boolean'
  );
}

function isUserProfileCacheRecord(value: unknown): value is UserProfileCacheRecord {
  const record = value as Partial<UserProfileCacheRecord>;
  return (
    record?.version === USER_PROFILE_CACHE_VERSION &&
    typeof record.cachedAt === 'number' &&
    isReaderUserProfileData(record.data)
  );
}

function isReaderUserProfileData(value: unknown): value is ReaderUserProfileData {
  const profile = value as Partial<ReaderUserProfileData>;
  return (
    (profile.id === null || typeof profile.id === 'number') &&
    typeof profile.username === 'string' &&
    typeof profile.name === 'string' &&
    typeof profile.avatarUrl === 'string' &&
    typeof profile.joinedAt === 'string' &&
    typeof profile.profileUrl === 'string' &&
    typeof profile.messageUrl === 'string' &&
    typeof profile.canMessage === 'boolean'
  );
}
