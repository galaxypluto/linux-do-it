import { describe, expect, it } from 'vitest';
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
  normalizeSettings,
} from '../../src/domain/settings';
import { SettingsService } from '../../src/application/services/SettingsService';
import type { StoragePort } from '../../src/ports/StoragePort';

describe('settings normalization', () => {
  it('fills migrated settings from defaults for older records', () => {
    expect(normalizeSettings({ layout: 'reader', density: 'compact' })).toEqual({
      ...DEFAULT_SETTINGS,
      layout: 'reader',
      density: 'compact',
    });
  });

  it('rejects invalid enum values', () => {
    const low = normalizeSettings({
      layout: 'bad',
      density: 'roomy',
      commentSortOrder: 'newest',
      topicUrlView: 'tree',
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

    expect(low.layout).toBe('grid');
    expect(low.density).toBe('comfortable');
    expect(low.commentSortOrder).toBe('asc');
    expect(low.topicUrlView).toBe('classic');
    expect(low.readerPostBatchSize).toBe(READER_POST_BATCH_MIN);
    expect(low.newTopicCheckIntervalSeconds).toBe(NEW_TOPIC_CHECK_INTERVAL_MIN_SECONDS);
    expect(high.readerPostBatchSize).toBe(READER_POST_BATCH_MAX);
    expect(high.newTopicCheckIntervalSeconds).toBe(NEW_TOPIC_CHECK_INTERVAL_MAX_SECONDS);
    expect(low.creditTopicViewDwellSeconds).toBe(CREDIT_TOPIC_VIEW_DWELL_MIN_SECONDS);
    expect(high.creditTopicViewDwellSeconds).toBe(CREDIT_TOPIC_VIEW_DWELL_MAX_SECONDS);
    expect(low.creditViewedTopicStorageMax).toBe(CREDIT_VIEWED_TOPIC_STORAGE_MIN);
    expect(high.creditViewedTopicStorageMax).toBe(CREDIT_VIEWED_TOPIC_STORAGE_MAX);
  });

  it('keeps valid booleans and bounded integers', () => {
    const settings = normalizeSettings({
      enabled: false,
      autoLoadReaderComments: false,
      newTopicNoticeEnabled: false,
      collapseLongComments: false,
      readerPostBatchSize: 37.4,
      newTopicCheckIntervalSeconds: 91.5,
    });

    expect(settings.enabled).toBe(false);
    expect(settings.autoLoadReaderComments).toBe(false);
    expect(settings.newTopicNoticeEnabled).toBe(false);
    expect(settings.collapseLongComments).toBe(false);
    expect(settings.readerPostBatchSize).toBe(37);
    expect(settings.newTopicCheckIntervalSeconds).toBe(92);
  });
});

describe('SettingsService', () => {
  it('loads current settings through the storage port', async () => {
    const service = new SettingsService(
      memoryStorage({
        linuxdoReaderSettings: { layout: 'masonry' },
      }),
    );

    await expect(service.load()).resolves.toMatchObject({
      layout: 'masonry',
      density: 'comfortable',
    });
  });

  it('can read legacy Card View settings during migration', async () => {
    const service = new SettingsService(
      memoryStorage({
        linuxdoCardViewSettings: { density: 'compact' },
      }),
    );

    await expect(service.load()).resolves.toMatchObject({
      layout: 'grid',
      density: 'compact',
    });
  });

  it('normalizes before saving', async () => {
    const storage = memoryStorage();
    const service = new SettingsService(storage);

    await service.save({ ...DEFAULT_SETTINGS, readerPostBatchSize: 999 });

    await expect(storage.get('linuxdoReaderSettings')).resolves.toMatchObject({
      readerPostBatchSize: READER_POST_BATCH_MAX,
    });
  });
});

function memoryStorage(initial: Record<string, unknown> = {}): StoragePort {
  const store = new Map(Object.entries(initial));
  return {
    async get<T>(key: string): Promise<T | null> {
      return (store.get(key) as T | undefined) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },
    async remove(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

