import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinuxDoApiService } from '../../src/application/services/LinuxDoApiService';
import type { DiscourseListResponse, DiscourseTopicResponse, TopicCardData } from '../../src/domain/linuxdo/types';
import type { CachePort } from '../../src/ports/CachePort';
import type { HttpPort, HttpRequestOptions, HttpResponsePort } from '../../src/ports/HttpPort';

const topic: TopicCardData = {
  id: 10,
  title: 'Reader topic',
  url: '/n/reader-topic/10',
  slug: 'reader-topic',
  excerpt: '',
  thumbnailUrl: '',
  tags: ['reader'],
  stats: {
    replies: 3,
    views: 100,
    likes: 5,
    score: 0,
  },
  dates: {
    createdAt: '2026-05-01T00:00:00.000Z',
    activityAt: '2026-05-02T00:00:00.000Z',
  },
  flags: {
    pinned: false,
    closed: false,
    archived: false,
    bookmarked: false,
    unseen: false,
  },
  posters: [
    {
      id: 1,
      username: 'alice',
      name: 'Alice',
      avatarUrl: 'https://linux.do/avatar/alice.png',
      description: 'Original Poster',
      isOriginalPoster: true,
    },
  ],
};

const initialPayload: DiscourseTopicResponse = {
  id: 10,
  title: 'Reader topic',
  slug: 'reader-topic',
  posts_count: 4,
  views: 100,
  like_count: 5,
  tags: ['reader'],
  draft_key: 'topic_10',
  draft_sequence: 3,
  bookmarked: true,
  details: {
    can_create_post: true,
  },
  bookmarks: [
    {
      bookmarkable_id: 100,
      bookmarkable_type: 'Post',
      post_number: 1,
    },
  ],
  post_stream: {
    stream: [100, 101, 102, 103],
    posts: [
      {
        id: 100,
        post_number: 1,
        user_id: 1,
        username: 'alice',
        name: 'Alice',
        avatar_template: '/avatar/alice/{size}.png',
        created_at: '2026-05-01T00:00:00.000Z',
        cooked: '<p>Main post</p>',
        like_count: 2,
        reads: 10,
        reply_count: 1,
        can_bookmark: true,
        actions_summary: [
          {
            id: 2,
            acted: false,
            can_act: true,
            can_undo: false,
          },
        ],
      },
      {
        id: 101,
        post_number: 2,
        user_id: 2,
        username: 'bob',
        name: 'Bob',
        avatar_template: '/avatar/bob/{size}.png',
        created_at: '2026-05-01T01:00:00.000Z',
        cooked: '<p>First reply</p>',
        like_count: 1,
        reads: 5,
        reply_count: 1,
        can_bookmark: true,
        actions_summary: [
          {
            id: 2,
            acted: true,
            can_act: false,
            can_undo: true,
          },
        ],
      },
      {
        id: 102,
        post_number: 3,
        reply_to_post_number: 2,
        user_id: 1,
        username: 'alice',
        name: 'Alice',
        avatar_template: '/avatar/alice/{size}.png',
        created_at: '2026-05-01T02:00:00.000Z',
        cooked: '<p>OP nested reply</p>',
        like_count: 0,
        reads: 3,
        reply_count: 0,
        actions_summary: [
          {
            id: 2,
            acted: false,
            can_act: true,
            can_undo: false,
          },
        ],
      },
    ],
  },
};

const morePayload: DiscourseTopicResponse = {
  post_stream: {
    posts: [
      {
        id: 103,
        post_number: 4,
        reply_to_post_number: 3,
        user_id: 3,
        username: 'carol',
        name: 'Carol',
        avatar_template: '/avatar/carol/{size}.png',
        created_at: '2026-05-01T03:00:00.000Z',
        cooked: '<p>Late nested reply</p>',
        like_count: 0,
        reads: 2,
        reply_count: 0,
      },
    ],
  },
};

class FakeHttp implements HttpPort {
  readonly request = vi.fn<Parameters<HttpPort['request']>, ReturnType<HttpPort['request']>>();

  enqueue(payload: unknown, status = 200): void {
    this.request.mockResolvedValueOnce(jsonResponse(payload, status));
  }
}

class MemoryCache implements CachePort {
  readonly items = new Map<string, string>();

  get(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.items.set(key, value);
  }

  remove(key: string): void {
    this.items.delete(key);
  }
}

function jsonResponse(payload: unknown, status = 200): HttpResponsePort {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

describe('LinuxDoApiService topic list requests', () => {
  let http: FakeHttp;
  let cache: MemoryCache;
  let service: LinuxDoApiService;

  beforeEach(() => {
    http = new FakeHttp();
    cache = new MemoryCache();
    service = new LinuxDoApiService({ http, cache, origin: 'https://linux.do', now: () => 1000 });
  });

  it('fetches and normalizes a topic list without requesting topic detail JSON', async () => {
    const listPayload: DiscourseListResponse = {
      topic_list: {
        topics: [{ id: 1, title: 'List topic', slug: 'list-topic', category_id: 2 }],
      },
      users: [],
    };
    http.enqueue(listPayload);
    http.enqueue({ categories: [{ id: 2, name: 'General', color: '111111', text_color: 'ffffff' }] });

    const list = await service.fetchTopicList('/latest.json');

    expect(list.topics[0]).toMatchObject({
      id: 1,
      title: 'List topic',
      category: { id: 2, name: 'General' },
    });
    expect(http.request).toHaveBeenNthCalledWith(1, '/latest.json', expectRequest());
    expect(http.request).toHaveBeenNthCalledWith(2, '/site.json', expectRequest());
    expect(http.request.mock.calls.some(([url]) => String(url).startsWith('/t/'))).toBe(false);
  });

  it('does not request site categories when the list payload already includes metadata', async () => {
    const listPayload: DiscourseListResponse = {
      topic_list: {
        topics: [{ id: 1, title: 'List topic', slug: 'list-topic', category_id: 2 }],
      },
      categories: [{ id: 2, name: 'General', color: '111111', text_color: 'ffffff' }],
      users: [],
    };
    http.enqueue(listPayload);

    const list = await service.fetchTopicList('/latest.json');

    expect(list.topics[0]?.category?.name).toBe('General');
    expect(http.request).toHaveBeenCalledTimes(1);
    expect(http.request).toHaveBeenCalledWith('/latest.json', expectRequest());
  });

  it('fetches and normalizes search topics', async () => {
    http.enqueue({
      topics: [{ id: 10, title: 'Search topic', slug: 'search-topic', category_id: 2 }],
      categories: [{ id: 2, name: 'General', color: '111111', text_color: 'ffffff' }],
      users: [],
    });

    const topics = await service.searchTopics('reader mode', 2);

    expect(topics[0]).toMatchObject({
      id: 10,
      title: 'Search topic',
      category: { id: 2, name: 'General' },
    });
    expect(http.request).toHaveBeenCalledWith('/search.json?q=reader%20mode&page=2', expectRequest());
    expect(http.request).toHaveBeenCalledTimes(1);
  });

  it('keeps the search signal as the second argument for existing callers', async () => {
    const controller = new AbortController();
    http.enqueue({
      topics: [],
      categories: [],
      users: [],
    });

    await service.searchTopics('reader mode', controller.signal);

    expect(http.request).toHaveBeenCalledWith(
      '/search.json?q=reader%20mode&page=1',
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });

  it('maps more-topics URLs to JSON endpoints using the configured origin', () => {
    expect(service.endpointFromMoreTopicsUrl('/latest?page=1')).toBe('/latest.json?page=1');
    expect(service.endpointFromMoreTopicsUrl('https://linux.do/top?period=weekly&page=2')).toBe(
      '/top.json?period=weekly&page=2',
    );
    expect(service.endpointFromMoreTopicsUrl('')).toBe('');
  });

  it('can issue absolute requests for extension pages outside the Linux.do origin', async () => {
    service = new LinuxDoApiService({ http, cache, origin: 'https://linux.do', useAbsoluteUrls: true });
    http.enqueue({ topic_list: { topics: [] } });
    http.enqueue({ categories: [] });

    await service.fetchTopicList('/latest.json');

    expect(http.request).toHaveBeenNthCalledWith(1, 'https://linux.do/latest.json', expectRequest());
    expect(http.request).toHaveBeenNthCalledWith(2, 'https://linux.do/site.json', expectRequest());
  });
});

describe('LinuxDoApiService reader requests', () => {
  let http: FakeHttp;
  let cache: MemoryCache;
  let service: LinuxDoApiService;

  beforeEach(() => {
    http = new FakeHttp();
    cache = new MemoryCache();
    service = new LinuxDoApiService({ http, cache, origin: 'https://linux.do', now: () => 1000 });
  });

  it('builds reader posts, OP markers, loaded ids, and reply trees from topic JSON', async () => {
    http.enqueue(initialPayload);

    const reader = await service.fetchTopicReader(topic, undefined, { skipCache: true });

    expect(http.request).toHaveBeenCalledWith('/t/reader-topic/10.json', expectRequest());
    expect(reader.url).toBe('/n/reader-topic/10');
    expect(reader.posts[0]?.url).toBe('/n/reader-topic/10/1');
    expect(reader.posts).toHaveLength(3);
    expect(reader.postStream).toEqual([100, 101, 102, 103]);
    expect(reader.loadedPostIds).toEqual([100, 101, 102]);
    expect(reader.hasMorePosts).toBe(true);
    expect(reader.actions).toEqual({ canReply: true, draftKey: 'topic_10', draftSequence: 3 });
    expect(reader.posts.find((post) => post.postNumber === 1)?.actions.bookmarked).toBe(true);
    expect(reader.posts.find((post) => post.postNumber === 2)?.actions.liked).toBe(true);
    expect(reader.posts.find((post) => post.postNumber === 2)?.actions.canLike).toBe(true);
    expect(reader.opAuthor?.username).toBe('alice');
    expect(reader.posts.find((post) => post.postNumber === 3)?.isOriginalPoster).toBe(true);
    expect(reader.tree).toHaveLength(1);
    expect(reader.tree[0]?.post.postNumber).toBe(2);
    expect(reader.tree[0]?.children[0]?.post.postNumber).toBe(3);
    expect(reader.tree[0]?.children[0]?.depth).toBe(1);
  });

  it('loads missing posts in batches, deduplicates, sorts, and rebuilds the reply tree', async () => {
    http.enqueue(initialPayload);
    const reader = await service.fetchTopicReader(topic, undefined, { skipCache: true });
    http.enqueue(morePayload);

    const merged = await service.fetchMoreReaderPosts(reader, 20);

    expect(http.request).toHaveBeenLastCalledWith('/t/10/posts.json?post_ids%5B%5D=103', expectRequest());
    expect(merged.posts.map((post) => post.postNumber)).toEqual([1, 2, 3, 4]);
    expect(merged.loadedPostIds).toEqual([100, 101, 102, 103]);
    expect(merged.hasMorePosts).toBe(false);
    expect(merged.tree[0]?.post.postNumber).toBe(2);
    expect(merged.tree[0]?.children[0]?.post.postNumber).toBe(3);
    expect(merged.tree[0]?.children[0]?.children[0]?.post.postNumber).toBe(4);
    expect(merged.tree[0]?.children[0]?.children[0]?.depth).toBe(2);
    expect(merged.posts.find((post) => post.postNumber === 4)?.actions.canReply).toBe(true);
  });

  it('remembers locally confirmed native action state in the reader cache', async () => {
    http.enqueue(initialPayload);
    const reader = await service.fetchTopicReader(topic, undefined, { skipCache: true });
    const updated = {
      ...reader,
      posts: reader.posts.map((post) =>
        post.postNumber === 1
          ? {
              ...post,
              actions: {
                ...post.actions,
                liked: true,
                bookmarked: true,
              },
            }
          : post,
      ),
    };

    service.rememberCachedTopicReader(updated);

    const cached = service.getCachedTopicReader(reader.id);
    expect(cached?.posts.find((post) => post.postNumber === 1)?.actions.liked).toBe(true);
    expect(cached?.posts.find((post) => post.postNumber === 1)?.actions.bookmarked).toBe(true);
  });
});

function expectRequest(): HttpRequestOptions {
  return expect.objectContaining({
    credentials: 'include',
    headers: { Accept: 'application/json' },
  }) as HttpRequestOptions;
}
