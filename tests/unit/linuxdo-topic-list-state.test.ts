import { describe, expect, it } from 'vitest';
import {
  detectNewTopics,
  mergeAppendTopicList,
  mergePendingTopics,
  newestTopicCreatedAtMs,
} from '../../src/domain/linuxdo/topicListState';
import type { TopicCardData, TopicListData } from '../../src/domain/linuxdo/types';

describe('topic list state helpers', () => {
  it('appends pages while deduplicating by topic id', () => {
    expect(mergeAppendTopicList(list([topic(1), topic(2)]), list([topic(2), topic(3)], '/more')).topics.map((item) => item.id)).toEqual([
      1,
      2,
      3,
    ]);
  });

  it('detects only new topics created after the current baseline', () => {
    const existing = list([topic(1, '2026-05-01T00:00:00.000Z')]);
    const incoming = list([
      topic(1, '2026-05-01T00:00:00.000Z'),
      topic(2, '2026-05-02T00:00:00.000Z'),
      topic(3, '2026-04-30T00:00:00.000Z'),
    ]);

    expect(detectNewTopics(existing, incoming, [], Date.parse('2026-05-01T12:00:00.000Z')).map((item) => item.id)).toEqual([
      2,
    ]);
  });

  it('merges pending topics ahead of existing topics', () => {
    expect(mergePendingTopics(list([topic(1), topic(2)]), [topic(3), topic(2)]).topics.map((item) => item.id)).toEqual([
      3,
      2,
      1,
    ]);
  });

  it('finds the newest creation timestamp', () => {
    expect(newestTopicCreatedAtMs([topic(1, '2026-05-01T00:00:00.000Z'), topic(2, '2026-05-03T00:00:00.000Z')])).toBe(
      Date.parse('2026-05-03T00:00:00.000Z'),
    );
  });
});

function list(topics: TopicCardData[], moreTopicsUrl = ''): TopicListData {
  return {
    endpoint: '/latest.json',
    topics,
    moreTopicsUrl,
  };
}

function topic(id: number, createdAt = '2026-05-01T00:00:00.000Z'): TopicCardData {
  return {
    id,
    title: `Topic ${id}`,
    url: `/t/topic-${id}/${id}`,
    slug: `topic-${id}`,
    excerpt: '',
    thumbnailUrl: '',
    tags: [],
    stats: { replies: 0, views: 0, likes: 0, score: 0 },
    dates: {
      createdAt,
      activityAt: createdAt,
    },
    flags: {
      pinned: false,
      closed: false,
      archived: false,
      bookmarked: false,
      unseen: false,
    },
    posters: [],
  };
}

