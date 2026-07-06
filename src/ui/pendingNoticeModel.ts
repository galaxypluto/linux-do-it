import type { TopicCardData } from "../discourse/types";

export function pendingTopicIds(topics: TopicCardData[]): string {
  return topics.map((topic) => String(topic.id)).join(",");
}

export function selectPendingTopics(topics: TopicCardData[], topicIds: string | undefined): TopicCardData[] {
  if (!topicIds) {
    return topics;
  }

  const ids = topicIds
    .split(",")
    .map((value) => Number(value))
    .filter(Number.isFinite);
  if (ids.length === 0) {
    return topics;
  }

  const topicById = new Map(topics.map((topic) => [topic.id, topic]));
  return ids.flatMap((id) => {
    const topic = topicById.get(id);
    return topic ? [topic] : [];
  });
}

export function topicCategoryLabel(topic: TopicCardData): string {
  if (!topic.category) {
    return "新话题";
  }

  return topic.category.parentName ? `${topic.category.parentName} / ${topic.category.name}` : topic.category.name;
}

export function normalizePendingNoticeCount(value: string | undefined): number {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}
