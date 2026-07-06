export type CardLayout = "grid" | "masonry" | "reader";
export type CardDensity = "comfortable" | "compact";
export type CommentSortOrder = "asc" | "desc";
export type TopicUrlView = "classic" | "nested";

export interface ExtensionSettings {
  enabled: boolean;
  layout: CardLayout;
  density: CardDensity;
  commentSortOrder: CommentSortOrder;
  topicUrlView: TopicUrlView;
  enrichExcerpts: boolean;
  autoLoadReaderComments: boolean;
  readerPostBatchSize: number;
  newTopicNoticeEnabled: boolean;
  newTopicCheckIntervalSeconds: number;
  collapseLongComments: boolean;
  creditTopicViewDwellSeconds: number;
  creditViewedTopicStorageMax: number;
}

const STORAGE_KEY = "linuxdoCardViewSettings";
export const READER_POST_BATCH_MIN = 10;
export const READER_POST_BATCH_MAX = 50;
export const NEW_TOPIC_CHECK_INTERVAL_MIN_SECONDS = 30;
export const NEW_TOPIC_CHECK_INTERVAL_MAX_SECONDS = 600;
export const CREDIT_TOPIC_VIEW_DWELL_MIN_SECONDS = 5;
export const CREDIT_TOPIC_VIEW_DWELL_MAX_SECONDS = 15;
export const CREDIT_VIEWED_TOPIC_STORAGE_MIN = 200;
export const CREDIT_VIEWED_TOPIC_STORAGE_MAX = 800;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  layout: "grid",
  density: "comfortable",
  commentSortOrder: "asc",
  topicUrlView: "classic",
  enrichExcerpts: false,
  autoLoadReaderComments: true,
  readerPostBatchSize: 20,
  newTopicNoticeEnabled: true,
  newTopicCheckIntervalSeconds: 60,
  collapseLongComments: true,
  creditTopicViewDwellSeconds: 10,
  creditViewedTopicStorageMax: 500,
};

export async function loadSettings(): Promise<ExtensionSettings> {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    return normalizeSettings(result[STORAGE_KEY]);
  } catch {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    try {
      return normalizeSettings(JSON.parse(raw));
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  const normalized = normalizeSettings(settings);
  try {
    await chrome.storage.sync.set({ [STORAGE_KEY]: normalized });
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
}

export function normalizeSettings(value: unknown): ExtensionSettings {
  const input = isRecord(value) ? value : {};
  return {
    enabled: booleanSetting(input.enabled, DEFAULT_SETTINGS.enabled),
    layout: layoutSetting(input.layout),
    density: densitySetting(input.density),
    commentSortOrder: commentSortOrderSetting(input.commentSortOrder),
    topicUrlView: topicUrlViewSetting(input.topicUrlView),
    enrichExcerpts: booleanSetting(input.enrichExcerpts, DEFAULT_SETTINGS.enrichExcerpts),
    autoLoadReaderComments: booleanSetting(input.autoLoadReaderComments, DEFAULT_SETTINGS.autoLoadReaderComments),
    readerPostBatchSize: boundedInteger(input.readerPostBatchSize, READER_POST_BATCH_MIN, READER_POST_BATCH_MAX, DEFAULT_SETTINGS.readerPostBatchSize),
    newTopicNoticeEnabled: booleanSetting(input.newTopicNoticeEnabled, DEFAULT_SETTINGS.newTopicNoticeEnabled),
    newTopicCheckIntervalSeconds: boundedInteger(
      input.newTopicCheckIntervalSeconds,
      NEW_TOPIC_CHECK_INTERVAL_MIN_SECONDS,
      NEW_TOPIC_CHECK_INTERVAL_MAX_SECONDS,
      DEFAULT_SETTINGS.newTopicCheckIntervalSeconds
    ),
    collapseLongComments: booleanSetting(input.collapseLongComments, DEFAULT_SETTINGS.collapseLongComments),
    creditTopicViewDwellSeconds: boundedInteger(
      input.creditTopicViewDwellSeconds,
      CREDIT_TOPIC_VIEW_DWELL_MIN_SECONDS,
      CREDIT_TOPIC_VIEW_DWELL_MAX_SECONDS,
      DEFAULT_SETTINGS.creditTopicViewDwellSeconds,
    ),
    creditViewedTopicStorageMax: boundedInteger(
      input.creditViewedTopicStorageMax,
      CREDIT_VIEWED_TOPIC_STORAGE_MIN,
      CREDIT_VIEWED_TOPIC_STORAGE_MAX,
      DEFAULT_SETTINGS.creditViewedTopicStorageMax,
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function booleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function layoutSetting(value: unknown): CardLayout {
  return value === "masonry" || value === "reader" ? value : "grid";
}

function densitySetting(value: unknown): CardDensity {
  return value === "compact" ? "compact" : "comfortable";
}

function commentSortOrderSetting(value: unknown): CommentSortOrder {
  return value === "desc" ? "desc" : "asc";
}

function topicUrlViewSetting(value: unknown): TopicUrlView {
  return value === "nested" ? "nested" : "classic";
}

function boundedInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(parsed)));
}
