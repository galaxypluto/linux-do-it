import type { TopicCardData, TopicListData } from "../discourse/types";

/** @deprecated 旧版已读 key，不再读取；请使用 CREDIT_VIEWED_TOPICS_STORAGE_KEY */
export const VIEWED_TOPICS_STORAGE_KEY = "linuxdoCardViewViewedTopics";
/** 信用浏览计数成功后写入的 topic id 列表 */
export const CREDIT_VIEWED_TOPICS_STORAGE_KEY = "linuxdoCardViewCreditViewedTopics";
export const DEFAULT_CREDIT_VIEWED_TOPIC_STORAGE_MAX = 500;
/** @deprecated 使用 settings.creditViewedTopicStorageMax 或 DEFAULT_CREDIT_VIEWED_TOPIC_STORAGE_MAX */
export const MAX_VIEWED_TOPIC_IDS = DEFAULT_CREDIT_VIEWED_TOPIC_STORAGE_MAX;
const VIEWED_TOPIC_IDS_STORAGE_MERGE_MAX_ATTEMPTS = 3;

type TopicIdStorage = Pick<Storage, "getItem" | "setItem">;

export function mergeLatest(existing: TopicListData, incoming: TopicListData): TopicListData {
  const incomingIds = new Set(incoming.topics.map((topic) => topic.id));
  return {
    endpoint: existing.endpoint,
    topics: [
      ...incoming.topics,
      ...existing.topics.filter((topic) => !incomingIds.has(topic.id))
    ],
    moreTopicsUrl: existing.moreTopicsUrl || incoming.moreTopicsUrl
  };
}

export function mergePendingLatest(
  existing: TopicListData,
  pendingTopics: TopicCardData[],
  latest: TopicListData | null
): TopicListData {
  const pendingIds = new Set(pendingTopics.map((topic) => topic.id));
  const latestTopics = latest?.topics ?? [];
  const latestIds = new Set(latestTopics.map((topic) => topic.id));

  return {
    endpoint: existing.endpoint,
    topics: [
      ...pendingTopics,
      ...latestTopics.filter((topic) => !pendingIds.has(topic.id)),
      ...existing.topics.filter((topic) => !pendingIds.has(topic.id) && !latestIds.has(topic.id))
    ],
    moreTopicsUrl: existing.moreTopicsUrl || latest?.moreTopicsUrl || ""
  };
}

export function mergeAppend(existing: TopicListData, incoming: TopicListData): TopicListData {
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
    moreTopicsUrl: incoming.moreTopicsUrl
  };
}

export function detectNewTopics(
  existing: TopicListData,
  incoming: TopicListData,
  pendingTopics: ReadonlyMap<number, TopicCardData>,
  createdAfterMs: number
): TopicCardData[] {
  const existingIds = new Set(existing.topics.map((topic) => topic.id));
  return incoming.topics.filter(
    (topic) =>
      !existingIds.has(topic.id) &&
      !pendingTopics.has(topic.id) &&
      isTopicCreatedAfterBaseline(topic, createdAfterMs)
  );
}

export function mergePendingTopicMap(
  existing: ReadonlyMap<number, TopicCardData>,
  topics: TopicCardData[]
): Map<number, TopicCardData> {
  const nextPending = new Map<number, TopicCardData>();
  for (const topic of topics) {
    nextPending.set(topic.id, topic);
  }
  for (const topic of existing.values()) {
    if (!nextPending.has(topic.id)) {
      nextPending.set(topic.id, topic);
    }
  }
  return nextPending;
}

export function loadViewedTopicIds(
  storage: TopicIdStorage,
  key = VIEWED_TOPICS_STORAGE_KEY,
  maxIds = MAX_VIEWED_TOPIC_IDS
): Set<number> {
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      return new Set();
    }
    return normalizeViewedTopicIds(JSON.parse(raw), maxIds);
  } catch {
    return new Set();
  }
}

export function persistViewedTopicIds(
  storage: TopicIdStorage,
  ids: ReadonlySet<number>,
  key = VIEWED_TOPICS_STORAGE_KEY,
  maxIds = MAX_VIEWED_TOPIC_IDS
): Set<number> {
  const normalized = normalizeViewedTopicIds(Array.from(ids), maxIds);
  try {
    storage.setItem(key, JSON.stringify(Array.from(normalized)));
  } catch {
    // The visual read marker is best-effort and should never block reading.
  }
  return normalized;
}

export async function loadViewedTopicIdsAsync(
  key = VIEWED_TOPICS_STORAGE_KEY,
  maxIds = MAX_VIEWED_TOPIC_IDS
): Promise<Set<number>> {
  try {
    const result = await chrome.storage.local.get(key);
    const raw = result[key];
    if (!raw) {
      const fallback = window.sessionStorage.getItem(key);
      if (!fallback) return new Set();
      return normalizeViewedTopicIds(JSON.parse(fallback), maxIds);
    }
    return normalizeViewedTopicIds(typeof raw === "string" ? JSON.parse(raw) : raw, maxIds);
  } catch {
    try {
      const fallback = window.sessionStorage.getItem(key);
      if (!fallback) return new Set();
      return normalizeViewedTopicIds(JSON.parse(fallback), maxIds);
    } catch {
      return new Set();
    }
  }
}

export async function persistViewedTopicIdsAsync(
  ids: ReadonlySet<number>,
  key = VIEWED_TOPICS_STORAGE_KEY,
  maxIds = MAX_VIEWED_TOPIC_IDS
): Promise<Set<number>> {
  const normalized = normalizeViewedTopicIds(Array.from(ids), maxIds);
  const data = Array.from(normalized);
  try {
    await chrome.storage.local.set({ [key]: data });
  } catch {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Ignore
    }
  }
  return normalized;
}

export function mergeViewedTopicIds(
  current: ReadonlySet<number>,
  incoming: Iterable<number>,
  maxIds = MAX_VIEWED_TOPIC_IDS
): Set<number> {
  return normalizeViewedTopicIds([...current, ...incoming], maxIds);
}

/**
 * Merge topic ids into persisted storage via a read-modify-write cycle. This
 * avoids the race where an in-memory snapshot is written back and overwrites
 * ids added concurrently from another tab.
 *
 * Returns the post-merge normalized set (the single source of truth for the
 * caller to adopt in memory).
 */
export async function mergeViewedTopicIdsStorage(
  topicIds: Iterable<number>,
  key = VIEWED_TOPICS_STORAGE_KEY,
  maxIds = MAX_VIEWED_TOPIC_IDS
): Promise<Set<number>> {
  const desired = normalizeViewedTopicIds(Array.from(topicIds), maxIds);
  let current = await loadViewedTopicIdsAsync(key, maxIds);
  let merged = mergeViewedTopicIds(current, desired, maxIds);
  if (viewedTopicIdsEqual(current, merged)) {
    // No write needed; the id is already persisted. Avoids a redundant
    // storage.set that would re-fire onChanged in the originating tab.
    return current;
  }

  // Another tab can still overwrite our first write after both sides loaded
  // the same stale value. Re-read and retry a few times until storage itself
  // contains the ids we were asked to merge.
  for (let attempt = 0; attempt < VIEWED_TOPIC_IDS_STORAGE_MERGE_MAX_ATTEMPTS; attempt += 1) {
    await persistViewedTopicIdsAsync(merged, key, maxIds);
    const stored = await loadViewedTopicIdsAsync(key, maxIds);
    const verified = mergeViewedTopicIds(stored, desired, maxIds);
    if (viewedTopicIdsEqual(stored, verified)) {
      return stored;
    }
    current = stored;
    merged = mergeViewedTopicIds(current, desired, maxIds);
  }

  throw new Error("viewed topic ids storage merge did not converge");
}

export async function mergeViewedTopicIdStorage(
  topicId: number,
  key = VIEWED_TOPICS_STORAGE_KEY,
  maxIds = MAX_VIEWED_TOPIC_IDS
): Promise<Set<number>> {
  return mergeViewedTopicIdsStorage([topicId], key, maxIds);
}

/** Structural equality check for two id sets, independent of iteration order. */
export function viewedTopicIdsEqual(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a === b) {
    return true;
  }
  if (a.size !== b.size) {
    return false;
  }
  for (const id of a) {
    if (!b.has(id)) {
      return false;
    }
  }
  return true;
}

export function newestTopicCreatedAtMs(topics: TopicCardData[]): number {
  return topics.reduce((newest, topic) => Math.max(newest, topicCreatedAtMs(topic)), 0);
}

export function topicCreatedAtMs(topic: TopicCardData): number {
  const time = Date.parse(topic.dates.createdAt);
  return Number.isFinite(time) ? time : 0;
}

function isTopicCreatedAfterBaseline(topic: TopicCardData, createdAfterMs: number): boolean {
  const createdAt = topicCreatedAtMs(topic);
  return createdAt > 0 && createdAt > createdAfterMs;
}

export function normalizeViewedTopicIds(value: unknown, maxIds: number): Set<number> {
  if (!Array.isArray(value)) {
    return new Set();
  }

  const boundedMax =
    Number.isFinite(maxIds) && maxIds > 0 ? Math.floor(maxIds) : DEFAULT_CREDIT_VIEWED_TOPIC_STORAGE_MAX;
  return new Set(
    value
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .slice(-boundedMax)
  );
}
