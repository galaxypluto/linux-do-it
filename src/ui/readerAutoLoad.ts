export const READER_AUTO_LOAD_COOLDOWN_MS = 2_500;
export const READER_AUTO_LOAD_BOTTOM_THRESHOLD_PX = 120;
export const READER_AUTO_LOAD_MIN_SCROLL_TOP = 10;

export function readerScrollRemaining(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
): number {
  return scrollHeight - scrollTop - clientHeight;
}

export function isReaderScrollNearBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  thresholdPx = READER_AUTO_LOAD_BOTTOM_THRESHOLD_PX,
): boolean {
  return readerScrollRemaining(scrollHeight, scrollTop, clientHeight) <= thresholdPx;
}

export function shouldTriggerReaderAutoLoad(input: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
  hasScrolled: boolean;
  loadingMore: boolean;
  lastTriggeredAt: number;
  now?: number;
  cooldownMs?: number;
  bottomThresholdPx?: number;
}): boolean {
  if (!input.hasScrolled || input.loadingMore) {
    return false;
  }

  if (
    !isReaderScrollNearBottom(
      input.scrollHeight,
      input.scrollTop,
      input.clientHeight,
      input.bottomThresholdPx,
    )
  ) {
    return false;
  }

  const now = input.now ?? Date.now();
  const cooldownMs = input.cooldownMs ?? READER_AUTO_LOAD_COOLDOWN_MS;
  return now - input.lastTriggeredAt >= cooldownMs;
}
