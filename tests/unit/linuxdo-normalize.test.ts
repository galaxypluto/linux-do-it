import { describe, expect, it } from 'vitest';
import { cleanExcerpt, cleanReaderTitle, normalizeSearchTopics, normalizeTopicList } from '../../src/domain/linuxdo/normalize';
import type { DiscourseListResponse, DiscourseSearchResponse } from '../../src/domain/linuxdo/types';

describe('normalizeTopicList', () => {
  it('normalizes topics, categories, tags, posters, and thumbnails', () => {
    const response: DiscourseListResponse = {
      topic_list: {
        more_topics_url: '/latest?page=1',
        topics: [
          {
            id: 123,
            fancy_title: '<span>:sparkles: Readable &amp; useful</span>',
            slug: 'hello world',
            excerpt: '<p>Hello :wave: <strong>world</strong> 🚀</p>',
            thumbnails: [{ url: '/uploads/thumb.jpg', max_width: 320 }],
            category_id: 2,
            tags: ['guide', { name: '<b>typescript</b>' }, '', null],
            posts_count: 5,
            reply_count: 2,
            views: 100,
            like_count: 7,
            score: 4.5,
            created_at: '2026-05-01T00:00:00.000Z',
            bumped_at: '2026-05-02T00:00:00.000Z',
            pinned: true,
            unseen: true,
            posters: [
              { user_id: 7, extras: 'latest single', description: 'Original Poster' },
              { user_id: 7, description: 'Duplicate' },
            ],
          },
        ],
      },
      users: [
        {
          id: 7,
          username: 'alice',
          name: 'Alice',
          avatar_template: '/user_avatar/linux.do/alice/{size}/1.png',
        },
      ],
      categories: [
        { id: 1, name: 'Parent', slug: 'parent', color: '111111', text_color: 'ffffff' },
        {
          id: 2,
          name: 'Child',
          slug: 'child',
          color: '#aabbcc',
          text_color: '123',
          parent_category_id: 1,
        },
      ],
    };

    const data = normalizeTopicList(response, '/latest.json');
    const topic = data.topics[0];

    expect(data.endpoint).toBe('/latest.json');
    expect(data.moreTopicsUrl).toBe('/latest?page=1');
    expect(data.topics).toHaveLength(1);
    expect(topic.title).toBe('Readable & useful');
    expect(topic.url).toBe('/t/hello%20world/123');
    expect(topic.slug).toBe('hello%20world');
    expect(topic.excerpt).toBe('Hello world 🚀');
    expect(topic.thumbnailUrl).toContain('/uploads/thumb.jpg');
    expect(topic.category).toEqual({
      id: 2,
      name: 'Child',
      parentName: 'Parent',
      color: 'aabbcc',
      textColor: '123',
    });
    expect(topic.tags).toEqual(['guide', 'typescript']);
    expect(topic.stats).toEqual({
      replies: 4,
      views: 100,
      likes: 7,
      score: 4.5,
    });
    expect(topic.dates.activityAt).toBe('2026-05-02T00:00:00.000Z');
    expect(topic.flags.pinned).toBe(true);
    expect(topic.flags.unseen).toBe(true);
    expect(topic.posters).toHaveLength(1);
    expect(topic.posters[0]).toMatchObject({
      id: 7,
      username: 'alice',
      name: 'Alice',
      description: 'Original Poster',
      isOriginalPoster: true,
    });
    expect(topic.posters[0]?.avatarUrl).toContain('/alice/64/1.png');
  });

  it('filters invalid topics and applies safe fallbacks', () => {
    const response = {
      topic_list: {
        topics: [
          { id: Number.NaN, title: 'drop me' },
          {
            id: 456,
            title: '',
            category_id: 3,
            reply_count: 8,
            posters: [{ user_id: 9, description: 'Participant' }],
          },
        ],
      },
      category_list: {
        categories: [{ id: 3, slug: 'fallback-category', color: 'not-a-color' }],
      },
    } as DiscourseListResponse;

    const data = normalizeTopicList(response, '/latest.json');
    const topic = data.topics[0];

    expect(data.topics).toHaveLength(1);
    expect(topic.id).toBe(456);
    expect(topic.title).toBe('Untitled topic');
    expect(topic.url).toBe('/t/topic/456');
    expect(topic.slug).toBe('topic');
    expect(topic.category?.name).toBe('fallback-category');
    expect(topic.category?.color).toBe('6b7280');
    expect(topic.stats.replies).toBe(8);
    expect(topic.posters[0]?.username).toBe('user-9');
    expect(topic.posters[0]?.avatarUrl).toContain('ui-avatars.com');
  });

  it('uses an injected origin for relative media URLs', () => {
    const data = normalizeTopicList(
      {
        topic_list: {
          topics: [{ id: 1, image_url: '/uploads/example.png' }],
        },
      },
      '/latest.json',
      { origin: 'https://example.test' },
    );

    expect(data.topics[0].thumbnailUrl).toBe('https://example.test/uploads/example.png');
  });

  it('maps Discourse read progress into topic flags', () => {
    const data = normalizeTopicList(
      {
        topic_list: {
          topics: [
            {
              id: 1,
              title: 'read',
              posts_count: 3,
              highest_post_number: 3,
              last_read_post_number: 3,
              unread_posts: 0,
              new_posts: 0,
              unseen: false,
            },
            {
              id: 2,
              title: 'unread',
              posts_count: 3,
              highest_post_number: 3,
              last_read_post_number: 2,
              unread_posts: 1,
              unseen: false,
            },
          ],
        },
      },
      '/latest.json',
    );

    expect(data.topics[0].flags.read).toBe(true);
    expect(data.topics[1].flags.read).toBe(false);
  });
});

describe('normalizeSearchTopics', () => {
  it('normalizes Discourse search topic payloads with user and category metadata', () => {
    const response: DiscourseSearchResponse = {
      topics: [
        {
          id: 10,
          title: 'Search topic',
          slug: 'search-topic',
          category_id: 2,
          reply_count: 1,
          posts_count: 2,
          views: 25,
          like_count: 3,
          created_at: '2026-05-01T00:00:00.000Z',
          bumped_at: '2026-05-02T00:00:00.000Z',
          posters: [{ user_id: 7, description: 'Original Poster' }],
        },
      ],
      users: [
        {
          id: 7,
          username: 'alice',
          name: 'Alice',
          avatar_template: '/user_avatar/linux.do/alice/{size}/1.png',
        },
      ],
      categories: [{ id: 2, name: 'General', color: '0284c7', text_color: 'ffffff' }],
    };

    const topics = normalizeSearchTopics(response);

    expect(topics).toHaveLength(1);
    expect(topics[0]).toMatchObject({
      id: 10,
      title: 'Search topic',
      url: '/t/search-topic/10',
      category: { id: 2, name: 'General' },
      stats: { replies: 1, views: 25, likes: 3 },
    });
    expect(topics[0].posters[0]).toMatchObject({
      username: 'alice',
      isOriginalPoster: true,
    });
  });
});

describe('text cleanup helpers', () => {
  it('cleans excerpts and reader titles', () => {
    expect(cleanExcerpt('<p>Hello :wave: <strong>world</strong> 🚀</p>')).toBe('Hello world 🚀');
    expect(cleanReaderTitle(':sparkles: 🚀 Launch plan')).toBe('Launch plan');
  });
});
