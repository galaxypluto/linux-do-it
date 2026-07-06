export interface ReaderScrollSnapshot {
  topicId: number;
  scrollTop: number;
  scrollLeft: number;
}

export interface PageScrollAnchor {
  topicId: number;
  top: number;
}

export function captureReaderScroll(root: ShadowRoot | null): ReaderScrollSnapshot | null {
  if (!root) {
    return null;
  }

  const article = root.querySelector<HTMLElement>(".ldcv-reader-article[data-reader-topic-id]");
  const scroller = article?.querySelector<HTMLElement>(".ldcv-reader-scroll");
  const topicId = Number(article?.dataset.readerTopicId);
  if (!article || !scroller || !Number.isFinite(topicId)) {
    return null;
  }

  return {
    topicId,
    scrollTop: scroller.scrollTop,
    scrollLeft: scroller.scrollLeft
  };
}

export function restoreReaderScroll(
  root: ShadowRoot | null,
  snapshot: ReaderScrollSnapshot | null,
  currentTopicId: number | null,
  loading: boolean,
  requestFrame: (callback: FrameRequestCallback) => number = window.requestAnimationFrame.bind(window)
): void {
  if (!snapshot || snapshot.topicId !== currentTopicId || loading) {
    return;
  }

  const apply = (): void => {
    if (!root || snapshot.topicId !== currentTopicId || loading) {
      return;
    }

    const article = root.querySelector<HTMLElement>(
      `.ldcv-reader-article[data-reader-topic-id="${snapshot.topicId}"]`
    );
    const scroller = article?.querySelector<HTMLElement>(".ldcv-reader-scroll");
    if (!scroller) {
      return;
    }

    const maxTop = Math.max(scroller.scrollHeight - scroller.clientHeight, 0);
    scroller.scrollTop = Math.min(snapshot.scrollTop, maxTop);
    scroller.scrollLeft = snapshot.scrollLeft;
  };

  apply();
  requestFrame(apply);
}

export function revealReaderPost(root: ShadowRoot | null, postNumber: number): boolean {
  if (!root || !Number.isFinite(postNumber)) {
    return false;
  }

  const target = root.querySelector<HTMLElement>(`#ldcv-post-${postNumber}`);
  if (!target) {
    return false;
  }

  const scroller = target.closest<HTMLElement>(".ldcv-reader-scroll");
  if (!scroller) {
    target.scrollIntoView({
      block: "center",
      behavior: "smooth"
    });
    return true;
  }

  const scrollerRect = scroller.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const centerOffset = Math.max(24, (scroller.clientHeight - targetRect.height) / 2);
  const nextTop = Math.max(0, scroller.scrollTop + targetRect.top - scrollerRect.top - centerOffset);
  if (typeof scroller.scrollTo === "function") {
    scroller.scrollTo({
      top: nextTop,
      behavior: "smooth"
    });
  } else {
    scroller.scrollTop = nextTop;
  }
  return true;
}

export function capturePageScrollAnchor(
  root: ShadowRoot | null,
  viewportHeight = window.innerHeight
): PageScrollAnchor | null {
  if (!root) {
    return null;
  }

  const cards = Array.from(root.querySelectorAll<HTMLElement>(".ldcv-card[data-topic-id]"));
  const visibleCards = cards
    .map((card) => {
      const topicId = Number(card.dataset.topicId);
      const rect = card.getBoundingClientRect();
      return { topicId, rect };
    })
    .filter(({ topicId, rect }) => Number.isFinite(topicId) && rect.bottom > 0 && rect.top < viewportHeight)
    .sort((a, b) => {
      const aTop = a.rect.top >= 0 ? a.rect.top : Number.MAX_SAFE_INTEGER + Math.abs(a.rect.top);
      const bTop = b.rect.top >= 0 ? b.rect.top : Number.MAX_SAFE_INTEGER + Math.abs(b.rect.top);
      return aTop - bTop;
    });

  const anchor = visibleCards[0];
  if (!anchor) {
    return null;
  }

  return {
    topicId: anchor.topicId,
    top: anchor.rect.top
  };
}

export function restorePageScrollAnchor(
  root: ShadowRoot | null,
  anchor: PageScrollAnchor | null,
  options: {
    scrollBy?: (x: number, y: number) => void;
    requestFrame?: (callback: FrameRequestCallback) => number;
    delay?: (callback: () => void, timeout: number) => number;
  } = {}
): void {
  if (!anchor || !root) {
    return;
  }

  const scrollBy = options.scrollBy ?? window.scrollBy.bind(window);
  const requestFrame = options.requestFrame ?? window.requestAnimationFrame.bind(window);
  const delay = options.delay ?? window.setTimeout.bind(window);

  const apply = (): void => {
    const card = root.querySelector<HTMLElement>(`.ldcv-card[data-topic-id="${anchor.topicId}"]`);
    if (!card) {
      return;
    }

    const top = card.getBoundingClientRect().top;
    const delta = top - anchor.top;
    if (Math.abs(delta) > 0.5) {
      scrollBy(0, delta);
    }
  };

  apply();
  requestFrame(apply);
  delay(apply, 60);
}

export function scrollToPageTop(options: {
  requestFrame?: (callback: FrameRequestCallback) => number;
  now?: () => number;
  scrollY?: () => number;
  scrollTo?: (x: number, y: number) => void;
  durationMs?: number;
} = {}): void {
  const requestFrame = options.requestFrame ?? window.requestAnimationFrame.bind(window);
  const now = options.now ?? (() => performance.now());
  const scrollY = options.scrollY ?? (() => window.scrollY);
  const scrollTo = options.scrollTo ?? ((x: number, y: number) => window.scrollTo(x, y));
  const durationMs = Math.max(0, options.durationMs ?? 680);
  const startY = Math.max(0, scrollY());

  if (startY < 1 || durationMs === 0) {
    scrollTo(0, 0);
    return;
  }

  const startTime = now();
  const step = (timestamp: number): void => {
    const elapsed = Math.max(0, timestamp - startTime);
    const progress = Math.min(1, elapsed / durationMs);
    const eased = easeOutQuint(progress);
    scrollTo(0, Math.round(startY * (1 - eased)));
    if (progress < 1) {
      requestFrame(step);
    }
  };

  requestFrame(step);
}

export function scrollToTopicCard(
  root: ShadowRoot | null,
  topicId: number,
  options: {
    requestFrame?: (callback: FrameRequestCallback) => number;
    now?: () => number;
    scrollY?: () => number;
    scrollTo?: (x: number, y: number) => void;
    offset?: number;
    durationMs?: number;
  } = {}
): boolean {
  if (!root || !Number.isFinite(topicId)) {
    return false;
  }

  const card = root.querySelector<HTMLElement>(`.ldcv-card[data-topic-id="${topicId}"]`);
  if (!card) {
    return false;
  }

  const requestFrame = options.requestFrame ?? window.requestAnimationFrame.bind(window);
  const now = options.now ?? (() => performance.now());
  const scrollY = options.scrollY ?? (() => window.scrollY);
  const scrollTo = options.scrollTo ?? ((x: number, y: number) => window.scrollTo(x, y));
  const durationMs = Math.max(0, options.durationMs ?? 680);
  const startY = scrollY();
  const offset = options.offset ?? topicCardScrollOffset(root);
  const targetY = (): number => Math.max(0, Math.round(scrollY() + card.getBoundingClientRect().top - offset));
  const initialTargetY = targetY();
  const distance = initialTargetY - startY;

  if (Math.abs(distance) < 1 || durationMs === 0) {
    scrollTo(0, initialTargetY);
    return true;
  }

  const startTime = now();
  const step = (timestamp: number): void => {
    const elapsed = Math.max(0, timestamp - startTime);
    const progress = Math.min(1, elapsed / durationMs);
    const eased = easeOutQuint(progress);
    scrollTo(0, Math.round(startY + (targetY() - startY) * eased));
    if (progress < 1) {
      requestFrame(step);
    }
  };

  requestFrame(step);
  return true;
}

function topicCardScrollOffset(root: ShadowRoot): number {
  const host = root.host instanceof HTMLElement ? root.host : null;
  if (!host) {
    return 16;
  }

  const rawOffset = getComputedStyle(host).getPropertyValue("--ldcv-sticky-offset");
  const stickyOffset = Number.parseFloat(rawOffset);
  return Number.isFinite(stickyOffset) ? stickyOffset + 12 : 16;
}

function easeOutQuint(value: number): number {
  return 1 - Math.pow(1 - value, 5);
}
