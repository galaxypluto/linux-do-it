import type { TopicReaderData } from "../discourse/types";

export const MAX_READER_MEMORY_CACHE = 40;
export const READER_MEMORY_CACHE_TTL_MS = 30 * 60 * 1000;

export interface ReaderMemoryCacheOptions {
  maxEntries?: number;
  ttlMs?: number;
  now?: () => number;
}

interface ReaderMemoryEntry {
  cachedAt: number;
  data: TopicReaderData;
}

export class ReaderMemoryCache {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly entries = new Map<number, ReaderMemoryEntry>();

  constructor(options: ReaderMemoryCacheOptions = {}) {
    this.maxEntries = boundedPositiveInteger(options.maxEntries, MAX_READER_MEMORY_CACHE);
    this.ttlMs = boundedPositiveInteger(options.ttlMs, READER_MEMORY_CACHE_TTL_MS);
    this.now = options.now ?? Date.now;
  }

  get(topicId: number): TopicReaderData | null {
    const entry = this.entries.get(topicId);
    if (!entry) {
      return null;
    }

    this.entries.delete(topicId);
    if (this.now() - entry.cachedAt > this.ttlMs) {
      return null;
    }

    this.entries.set(topicId, entry);
    return entry.data;
  }

  remember(reader: TopicReaderData): void {
    this.entries.delete(reader.id);
    this.entries.set(reader.id, {
      cachedAt: this.now(),
      data: reader
    });
    this.trim();
  }

  size(): number {
    return this.entries.size;
  }

  ids(): number[] {
    return Array.from(this.entries.keys());
  }

  private trim(): void {
    while (this.entries.size > this.maxEntries) {
      const oldestTopicId = this.entries.keys().next().value;
      if (typeof oldestTopicId !== "number") {
        break;
      }
      this.entries.delete(oldestTopicId);
    }
  }
}

function boundedPositiveInteger(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
