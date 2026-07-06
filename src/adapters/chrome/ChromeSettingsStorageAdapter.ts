import type { StoragePort } from '../../ports/StoragePort';

export class ChromeSettingsStorageAdapter implements StoragePort {
  async get<T>(key: string): Promise<T | null> {
    const local = await chrome.storage.local.get(key);
    if (local[key] !== undefined) {
      return local[key] as T;
    }

    const sync = await chrome.storage.sync.get(key);
    return (sync[key] as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }
}

