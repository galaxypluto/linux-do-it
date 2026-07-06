export const READER_READ_TIMINGS_DEBOUNCE_MS = 1_400;
export const READER_READ_TIMINGS_MAX_BATCH = 6;

export type ReaderReadTimingsSyncOptions = {
  scrollRoot: HTMLElement;
  syncPostNumbers: (postNumbers: ReadonlySet<number>) => Promise<boolean>;
  debounceMs?: number;
  maxBatchSize?: number;
  threshold?: number;
  signal?: AbortSignal;
};

/**
 * 在 Reader 滚动容器内观察楼层进入视口，按小批 POST /t/:id/timings（对齐原生逐步已读）。
 */
export function attachReaderReadTimingsSync(options: ReaderReadTimingsSyncOptions): () => void {
  const { scrollRoot } = options;
  const debounceMs = options.debounceMs ?? READER_READ_TIMINGS_DEBOUNCE_MS;
  const maxBatchSize = options.maxBatchSize ?? READER_READ_TIMINGS_MAX_BATCH;
  const threshold = options.threshold ?? 0.35;
  const synced = new Set<number>();
  const pending = new Set<number>();
  let flushTimer: number | undefined;
  let flushing = false;

  const scheduleFlush = (): void => {
    if (flushTimer !== undefined) {
      window.clearTimeout(flushTimer);
    }
    flushTimer = window.setTimeout(() => {
      flushTimer = undefined;
      void flush();
    }, debounceMs);
  };

  const takeBatch = (): Set<number> => {
    const batch = new Set<number>();
    for (const postNumber of pending) {
      batch.add(postNumber);
      pending.delete(postNumber);
      if (batch.size >= maxBatchSize) {
        break;
      }
    }
    return batch;
  };

  const flush = async (): Promise<void> => {
    if (flushing || pending.size === 0 || options.signal?.aborted) {
      return;
    }

    flushing = true;
    const batch = takeBatch();

    try {
      const ok = await options.syncPostNumbers(batch);
      if (ok) {
        batch.forEach((postNumber) => synced.add(postNumber));
      } else {
        batch.forEach((postNumber) => pending.add(postNumber));
      }
    } finally {
      flushing = false;
      if (pending.size > 0) {
        scheduleFlush();
      }
    }
  };

  const observePost = (element: Element): void => {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    const postNumber = extractPostNumber(element.id);
    if (!postNumber || synced.has(postNumber)) {
      return;
    }
    observer.observe(element);
  };

  const scanPosts = (): void => {
    scrollRoot.querySelectorAll<HTMLElement>("[id^='ldcv-post-']").forEach(observePost);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      if (options.signal?.aborted) {
        return;
      }

      for (const entry of entries) {
        if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) {
          continue;
        }
        const postNumber = extractPostNumber(entry.target.id);
        if (!postNumber || synced.has(postNumber)) {
          continue;
        }
        pending.add(postNumber);
      }

      if (pending.size > 0) {
        scheduleFlush();
      }
    },
    {
      root: scrollRoot,
      threshold,
    },
  );

  const mutationObserver = new MutationObserver(() => {
    scanPosts();
  });
  mutationObserver.observe(scrollRoot, { childList: true, subtree: true });
  scanPosts();

  return () => {
    observer.disconnect();
    mutationObserver.disconnect();
    if (flushTimer !== undefined) {
      window.clearTimeout(flushTimer);
    }
  };
}

export function extractPostNumber(elementId: string): number | null {
  const match = /^ldcv-post-(\d+)$/.exec(elementId);
  if (!match) {
    return null;
  }
  const postNumber = Number(match[1]);
  return Number.isFinite(postNumber) && postNumber > 0 ? postNumber : null;
}
