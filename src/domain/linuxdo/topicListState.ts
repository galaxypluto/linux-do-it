import type { TopicCardData, TopicListData } from './types';

export function mergeAppendTopicList(existing: TopicListData, incoming: TopicListData): TopicListData {
  const byId = new Map<number, TopicCardData>();
  for (const topic of existing.topics) {
    byId.set(topic.id, topic);
  }
  for (const topic of incoming.topics) {
    byId.set(topic.id, topic);
  }

  return {
    endpoint: existing.endpoint,
    topics: Array.from(byId.values()),
    moreTopicsUrl: incoming.moreTopicsUrl,
  };
}

export function mergePendingTopics(
  existing: TopicListData,
  pendingTopics: TopicCardData[],
  latest: TopicListData | null = null,
): TopicListData {
  const pendingIds = new Set(pendingTopics.map((topic) => topic.id));
  const latestTopics = latest?.topics ?? [];
  const latestIds = new Set(latestTopics.map((topic) => topic.id));

  return {
    endpoint: existing.endpoint,
    topics: [
      ...pendingTopics,
      ...latestTopics.filter((topic) => !pendingIds.has(topic.id)),
      ...existing.topics.filter((topic) => !pendingIds.has(topic.id) && !latestIds.has(topic.id)),
    ],
    moreTopicsUrl: existing.moreTopicsUrl || latest?.moreTopicsUrl || '',
  };
}

export function detectNewTopics(
  existing: TopicListData,
  incoming: TopicListData,
  pendingTopics: readonly TopicCardData[],
  createdAfterMs: number,
): TopicCardData[] {
  const existingIds = new Set(existing.topics.map((topic) => topic.id));
  const pendingIds = new Set(pendingTopics.map((topic) => topic.id));

  return incoming.topics.filter(
    (topic) =>
      !existingIds.has(topic.id) &&
      !pendingIds.has(topic.id) &&
      topicCreatedAtMs(topic) > createdAfterMs,
  );
}

export function newestTopicCreatedAtMs(topics: TopicCardData[]): number {
  return topics.reduce((newest, topic) => Math.max(newest, topicCreatedAtMs(topic)), 0);
}

function topicCreatedAtMs(topic: TopicCardData): number {
  const time = Date.parse(topic.dates.createdAt);
  return Number.isFinite(time) ? time : 0;
}

