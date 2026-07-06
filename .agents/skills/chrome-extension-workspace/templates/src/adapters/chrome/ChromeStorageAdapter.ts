import type { StoragePort } from '../../ports/StoragePort';

export class ChromeStorageAdapter implements StoragePort {
  async get<T>(key: string): Promise<T | null> {
    const value = await chrome.storage.local.get(key);
    return (value[key] as T | undefined) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }
}
