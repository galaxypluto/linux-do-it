import { describe, expect, it } from "vitest";
import {
  CREDIT_TOPIC_VIEW_DWELL_MAX_SECONDS,
  CREDIT_TOPIC_VIEW_DWELL_MIN_SECONDS,
  CREDIT_VIEWED_TOPIC_STORAGE_MAX,
  CREDIT_VIEWED_TOPIC_STORAGE_MIN,
  DEFAULT_SETTINGS,
  NEW_TOPIC_CHECK_INTERVAL_MAX_SECONDS,
  NEW_TOPIC_CHECK_INTERVAL_MIN_SECONDS,
  READER_POST_BATCH_MAX,
  READER_POST_BATCH_MIN,
  normalizeSettings
} from "../../src/storage/settings";

describe("settings normalization", () => {
  it("fills new P3 settings from defaults for older records", () => {
    expect(normalizeSettings({ layout: "reader", density: "compact" })).toEqual({
      ...DEFAULT_SETTINGS,
      layout: "reader",
      density: "compact"
    });
  });

  it("clamps numeric request settings and rejects invalid enum values", () => {
    const low = normalizeSettings({
      layout: "bad",
      density: "roomy",
      commentSortOrder: "newest",
      topicUrlView: "tree",
      readerPostBatchSize: 1,
      newTopicCheckIntervalSeconds: 5,
      creditTopicViewDwellSeconds: 1,
      creditViewedTopicStorageMax: 1,
    });
    const high = normalizeSettings({
      readerPostBatchSize: 999,
      newTopicCheckIntervalSeconds: 9999,
      creditTopicViewDwellSeconds: 999,
      creditViewedTopicStorageMax: 9999,
    });

    expect(low.layout).toBe("grid");
    expect(low.density).toBe("comfortable");
    expect(low.commentSortOrder).toBe("asc");
    expect(low.topicUrlView).toBe("classic");
    expect(low.readerPostBatchSize).toBe(READER_POST_BATCH_MIN);
    expect(low.newTopicCheckIntervalSeconds).toBe(NEW_TOPIC_CHECK_INTERVAL_MIN_SECONDS);
    expect(high.readerPostBatchSize).toBe(READER_POST_BATCH_MAX);
    expect(high.newTopicCheckIntervalSeconds).toBe(NEW_TOPIC_CHECK_INTERVAL_MAX_SECONDS);
    expect(low.creditTopicViewDwellSeconds).toBe(CREDIT_TOPIC_VIEW_DWELL_MIN_SECONDS);
    expect(high.creditTopicViewDwellSeconds).toBe(CREDIT_TOPIC_VIEW_DWELL_MAX_SECONDS);
    expect(low.creditViewedTopicStorageMax).toBe(CREDIT_VIEWED_TOPIC_STORAGE_MIN);
    expect(high.creditViewedTopicStorageMax).toBe(CREDIT_VIEWED_TOPIC_STORAGE_MAX);
  });

  it("keeps valid booleans and bounded integers", () => {
    const settings = normalizeSettings({
      enabled: false,
      autoLoadReaderComments: false,
      newTopicNoticeEnabled: false,
      collapseLongComments: false,
      readerPostBatchSize: 37.4,
      newTopicCheckIntervalSeconds: 91.5
    });

    expect(settings.enabled).toBe(false);
    expect(settings.autoLoadReaderComments).toBe(false);
    expect(settings.newTopicNoticeEnabled).toBe(false);
    expect(settings.collapseLongComments).toBe(false);
    expect(settings.readerPostBatchSize).toBe(37);
    expect(settings.newTopicCheckIntervalSeconds).toBe(92);
  });
});
