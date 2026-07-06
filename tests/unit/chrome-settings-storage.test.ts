import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChromeSettingsStorageAdapter } from '../../src/adapters/chrome/ChromeSettingsStorageAdapter';

describe('ChromeSettingsStorageAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads current local settings before sync settings', async () => {
    const adapter = new ChromeSettingsStorageAdapter();
    stubChromeStorage({
      local: { linuxdoReaderSettings: { layout: 'grid' } },
      sync: { linuxdoReaderSettings: { layout: 'masonry' } },
    });

    await expect(adapter.get('linuxdoReaderSettings')).resolves.toEqual({ layout: 'grid' });
  });

  it('falls back to chrome.storage.sync for legacy stable-version settings', async () => {
    const adapter = new ChromeSettingsStorageAdapter();
    stubChromeStorage({
      local: {},
      sync: { linuxdoCardViewSettings: { layout: 'reader' } },
    });

    await expect(adapter.get('linuxdoCardViewSettings')).resolves.toEqual({ layout: 'reader' });
  });

  it('writes only to local storage for the new project key', async () => {
    const adapter = new ChromeSettingsStorageAdapter();
    const storage = stubChromeStorage({ local: {}, sync: {} });

    await adapter.set('linuxdoReaderSettings', { density: 'compact' });

    expect(storage.local.set).toHaveBeenCalledWith({
      linuxdoReaderSettings: { density: 'compact' },
    });
    expect(storage.sync.set).not.toHaveBeenCalled();
  });
});

function stubChromeStorage(initial: {
  local: Record<string, unknown>;
  sync: Record<string, unknown>;
}) {
  const storage = {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: initial.local[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(initial.local, items);
      }),
      remove: vi.fn(async (key: string) => {
        delete initial.local[key];
      }),
    },
    sync: {
      get: vi.fn(async (key: string) => ({ [key]: initial.sync[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(initial.sync, items);
      }),
      remove: vi.fn(async (key: string) => {
        delete initial.sync[key];
      }),
    },
  };

  vi.stubGlobal('chrome', { storage });
  return storage;
}

