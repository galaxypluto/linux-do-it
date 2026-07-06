interface MasonryOptions {
  cardSelector?: string;
  /** 全量 pass 时是否重算已有 grid-row-end 的卡片（如列宽变化）。 */
  remeasureAll?: boolean;
}

const pendingMasonryFrames = new WeakMap<ShadowRoot, MasonryOptions | undefined>();

export function scheduleMasonry(root: ShadowRoot, options?: MasonryOptions): void {
  if (pendingMasonryFrames.has(root)) {
    const pending = pendingMasonryFrames.get(root);
    if (pending?.cardSelector && !options?.cardSelector) {
      pendingMasonryFrames.set(root, undefined);
    }
    return;
  }

  pendingMasonryFrames.set(root, options);
  window.requestAnimationFrame(() => {
    const pending = pendingMasonryFrames.get(root);
    pendingMasonryFrames.delete(root);
    applyMasonry(root, pending);
  });
}

export function applyMasonry(root: ShadowRoot, options: MasonryOptions = {}): void {
  const grid = root.querySelector<HTMLElement>("[data-card-grid='masonry']");
  if (!grid) {
    return;
  }

  const gridStyle = getComputedStyle(grid);
  const rowHeight = parseCssLength(gridStyle.getPropertyValue("grid-auto-rows"));
  const rowGap = parseCssLength(gridStyle.getPropertyValue("row-gap")) ?? 0;
  const visualGap = parseCssLength(gridStyle.getPropertyValue("--ldcv-masonry-row-gap")) ?? rowGap;
  if (!rowHeight || Number.isNaN(rowHeight)) {
    return;
  }

  let cards = Array.from(grid.querySelectorAll<HTMLElement>(options.cardSelector ?? ".ldcv-card"));
  if (!options.cardSelector && !options.remeasureAll) {
    cards = cards.filter(
      (card) => card.classList.contains("is-entering") || !card.style.getPropertyValue("grid-row-end")
    );
  }
  if (cards.length === 0) {
    return;
  }

  // Pass 1: Prepare cards to measure their natural un-stretched height
  const originalAligns = cards.map((card) => ({
    val: card.style.getPropertyValue("align-self"),
    prio: card.style.getPropertyPriority("align-self"),
  }));

  cards.forEach((card) => {
    card.style.setProperty("align-self", "start", "important");
  });

  // Pass 2: Batch layout reads to prevent layout thrashing
  const heights = cards.map((card) => masonryCardHeight(card));

  // Pass 3: Apply spans and restore styles
  cards.forEach((card, index) => {
    const height = heights[index];
    const span = Math.ceil((height + visualGap) / (rowHeight + rowGap));
    const nextGridRowEnd = `span ${Math.max(span, 1)}`;

    const orig = originalAligns[index];
    if (orig.val) {
      card.style.setProperty("align-self", orig.val, orig.prio);
    } else {
      card.style.removeProperty("align-self");
    }

    if (card.style.getPropertyValue("grid-row-end") !== nextGridRowEnd) {
      card.style.setProperty("grid-row-end", nextGridRowEnd);
    }
  });
}

function masonryCardHeight(card: HTMLElement): number {
  // The visual `transform: scale(1.015)` on `.is-selected` does NOT change the
  // layout box (CSS transforms are visual-only), so it cannot by itself shift
  // the masonry `grid-row-end: span N` which is computed from the layout box.
  // The real reflow source is image async load changing content height and
  // recomputing a larger span on the next masonry pass — that is handled
  // elsewhere (observers re-run applyMasonry), not here.
  //
  // Why we still prefer offsetHeight for selected cards: the scale makes the
  // selected card overflow its grid cell and overlap neighbors visually; using
  // the unscaled layout height (offsetHeight) keeps the span from absorbing the
  // 1.5% visual overshoot. getBoundingClientRect().height returns the SCALED
  // (visual) height on a real browser, which would inflate the span.
  // jsdom returns 0 for both rect height and offsetHeight, so the
  // scrollHeight/offsetHeight fallbacks below keep tests stable.
  const isSelected = card.classList.contains("is-selected");
  const rectHeight = card.getBoundingClientRect().height;
  const layoutHeight = isSelected && card.offsetHeight > 0 ? card.offsetHeight : rectHeight;
  return Math.max(layoutHeight, card.scrollHeight, card.offsetHeight, 0);
}

function parseCssLength(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}
