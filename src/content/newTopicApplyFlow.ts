import type { TopicCardData, TopicListData } from "../discourse/types";
import type { ExtensionSettings } from "../storage/settings";
import { mergePendingLatest } from "./topicListState";

export const TOPIC_UPDATE_NAVIGATION_DURATION_MS = 760;
export const TOPIC_UPDATE_REVEAL_DELAY_MS = TOPIC_UPDATE_NAVIGATION_DURATION_MS + 160;

type TopicListLayout = ExtensionSettings["layout"];

export type TopicListVisualState = {
  newTopicIds: Set<number>;
  enteringTopicIds: Set<number>;
};

export type TopicListNavigationRequest = {
  kind: "page-top";
  durationMs: number;
};

export type ApplyPendingRefreshResult = {
  data: TopicListData;
  visualState: TopicListVisualState;
  lastUpdatedAt: string;
  revealDelayMs: number;
  navigation: TopicListNavigationRequest | null;
};

export function createEmptyTopicListVisualState(): TopicListVisualState {
  return {
    newTopicIds: new Set(),
    enteringTopicIds: new Set(),
  };
}

export function createAppliedPendingTopicVisualState(
  pendingTopics: readonly TopicCardData[],
  layout: TopicListLayout,
): TopicListVisualState {
  const newTopicIds = new Set(pendingTopics.map((topic) => topic.id));
  return {
    newTopicIds,
    // Reader/list layout favors reading stability: the cards can keep a stable
    // "new" marker without replaying an entrance animation during later
    // rerenders. Grid and masonry still animate the freshly inserted batch once.
    enteringTopicIds: layout === "reader" ? new Set() : new Set(newTopicIds),
  };
}

export function withEnteringTopicIds(
  visualState: Readonly<TopicListVisualState>,
  topicIds: Iterable<number>,
): TopicListVisualState {
  return {
    newTopicIds: new Set(visualState.newTopicIds),
    enteringTopicIds: new Set(topicIds),
  };
}

export function acknowledgeTopicEntering(
  visualState: Readonly<TopicListVisualState>,
): TopicListVisualState {
  if (visualState.enteringTopicIds.size === 0) {
    return visualState;
  }

  return {
    newTopicIds: new Set(visualState.newTopicIds),
    enteringTopicIds: new Set(),
  };
}

export function clearTopicFromVisualState(
  visualState: Readonly<TopicListVisualState>,
  topicId: number,
): TopicListVisualState {
  if (!visualState.newTopicIds.has(topicId) && !visualState.enteringTopicIds.has(topicId)) {
    return visualState;
  }

  const newTopicIds = new Set(visualState.newTopicIds);
  newTopicIds.delete(topicId);
  const enteringTopicIds = new Set(visualState.enteringTopicIds);
  enteringTopicIds.delete(topicId);
  return {
    newTopicIds,
    enteringTopicIds,
  };
}

export function buildApplyPendingRefreshResult({
  currentData,
  latestData,
  pendingTopics,
  layout,
}: {
  currentData: TopicListData | null;
  latestData: TopicListData | null;
  pendingTopics: readonly TopicCardData[];
  layout: TopicListLayout;
}): ApplyPendingRefreshResult | null {
  if (!latestData) {
    return null;
  }

  const data = currentData
    ? mergePendingLatest(currentData, [...pendingTopics], latestData)
    : latestData;
  const count = pendingTopics.length;
  return {
    data,
    visualState: createAppliedPendingTopicVisualState(pendingTopics, layout),
    lastUpdatedAt: count > 0 ? `已更新 ${count} 个新话题` : "刚刚更新",
    revealDelayMs: TOPIC_UPDATE_REVEAL_DELAY_MS,
    navigation: count > 0
      ? {
          kind: "page-top",
          durationMs: TOPIC_UPDATE_NAVIGATION_DURATION_MS,
        }
      : null,
  };
}
