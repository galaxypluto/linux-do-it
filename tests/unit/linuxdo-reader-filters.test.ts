import { describe, expect, it } from 'vitest';
import { visibleReaderPosts } from '../../src/domain/linuxdo/readerFilters';
import type { TopicReaderData, TopicReaderPost } from '../../src/domain/linuxdo/types';

describe('visibleReaderPosts', () => {
  it('keeps the original post first and sorts comments by selected order', () => {
    const reader = readerWithPosts([
      post(1, 'alice', true),
      post(2, 'bob'),
      post(4, 'dave'),
      post(3, 'carol'),
    ]);

    expect(visibleReaderPosts(reader, { sortOrder: 'asc' }).map((item) => item.postNumber)).toEqual([1, 2, 3, 4]);
    expect(visibleReaderPosts(reader, { sortOrder: 'desc' }).map((item) => item.postNumber)).toEqual([1, 4, 3, 2]);
  });

  it('filters OP posts and text queries', () => {
    const reader = readerWithPosts([
      post(1, 'alice', true, '<p>Main post</p>'),
      post(2, 'bob', false, '<p>Plain reply</p>'),
      post(3, 'alice', true, '<p>OP follow up</p>'),
    ]);

    expect(visibleReaderPosts(reader, { sortOrder: 'asc', opOnly: true }).map((item) => item.postNumber)).toEqual([
      1,
      3,
    ]);
    expect(visibleReaderPosts(reader, { sortOrder: 'asc', query: 'follow' }).map((item) => item.postNumber)).toEqual([
      3,
    ]);
  });
});

function readerWithPosts(posts: TopicReaderPost[]): TopicReaderData {
  return {
    id: 1,
    title: 'Reader',
    url: '/t/reader/1',
    slug: 'reader',
    stats: { posts: posts.length, views: 0, likes: 0 },
    actions: { canReply: true, draftKey: '', draftSequence: 0 },
    tags: [],
    opAuthor: posts[0]?.author ?? null,
    posts,
    tree: [],
    postStream: posts.map((item) => item.id),
    loadedPostIds: posts.map((item) => item.id),
    hasMorePosts: false,
  };
}

function post(postNumber: number, username: string, isOriginalPoster = false, html = '<p>Body</p>'): TopicReaderPost {
  return {
    id: postNumber * 10,
    postNumber,
    replyToPostNumber: null,
    author: {
      id: postNumber,
      username,
      name: username,
      avatarUrl: '',
    },
    createdAt: '',
    html,
    stats: { likes: 0, reads: 0, replies: 0 },
    actions: {
      canReply: true,
      canLike: true,
      liked: false,
      canBookmark: true,
      bookmarked: false,
    },
    url: `/t/reader/1/${postNumber}`,
    isOriginalPost: postNumber === 1,
    isOriginalPoster,
  };
}

