import type { CachePort } from '../../ports/CachePort';

export class BrowserSessionCacheAdapter implements CachePort {
  get(key: string): string | null {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): void {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Cache writes should not block the reader flow.
    }
  }

  remove(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore cache removal failures; the next request can rebuild data.
    }
  }
}

