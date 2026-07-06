import { normalizeViewedTopicIds } from "./topicListState";

export type CreditViewedTopicIdSets = {
  viewed: ReadonlySet<number>;
  local: ReadonlySet<number>;
  pending: ReadonlySet<number>;
  inFlight: ReadonlySet<number>;
};

/** 是否应启动信用浏览计数（未在本地成功计数集合中） */
export function shouldScheduleCreditTopicView(
  topicId: number,
  viewedTopicIds: ReadonlySet<number>,
): boolean {
  return Number.isFinite(topicId) && topicId > 0 && !viewedTopicIds.has(topicId);
}

/** 按配置上限裁剪内存中的已计数 topic 集合 */
export function trimCreditViewedTopicIdSets(
  sets: CreditViewedTopicIdSets,
  maxIds: number,
): {
  viewed: Set<number>;
  local: Set<number>;
  pending: Set<number>;
  inFlight: Set<number>;
} {
  return {
    viewed: normalizeViewedTopicIds(Array.from(sets.viewed), maxIds),
    local: normalizeViewedTopicIds(Array.from(sets.local), maxIds),
    pending: normalizeViewedTopicIds(Array.from(sets.pending), maxIds),
    inFlight: normalizeViewedTopicIds(Array.from(sets.inFlight), maxIds),
  };
}
