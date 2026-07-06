export type LayoutObserverTrigger =
  | { kind: "card"; card: HTMLElement }
  | { kind: "full" };

/** 选中/已读角标与 masonry 行高写入属于卡片 chrome，不应触发全量瀑布流重算。 */
export function isCardChromeMutation(record: MutationRecord): boolean {
  const target = record.target;
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (record.type === "attributes") {
    if (record.attributeName === "class") {
      return target.classList.contains("ldcv-card");
    }
    if (record.attributeName === "style" && target.classList.contains("ldcv-card")) {
      return true;
    }
    return false;
  }

  if (record.type === "childList" && target.classList.contains("ldcv-card__status")) {
    const nodes = [...record.addedNodes, ...record.removedNodes];
    return (
      nodes.length > 0 &&
      nodes.every((node) => node instanceof HTMLElement && node.classList.contains("ldcv-state"))
    );
  }

  return false;
}

export function shouldScheduleLayoutFromMutations(records: readonly MutationRecord[]): boolean {
  if (records.length === 0) {
    return false;
  }
  return records.some((record) => !isCardChromeMutation(record));
}

export function masonryCardTopicSelector(card: HTMLElement): string {
  const topicId = card.dataset.topicId;
  return topicId ? `.ldcv-card[data-topic-id="${topicId}"]` : ".ldcv-card";
}

export function observeLayout(
  target: ShadowRoot,
  callback: (trigger?: LayoutObserverTrigger) => void
): () => void {
  const resizeObserver = new ResizeObserver((entries) => {
    const resizedCard = entries.find(
      (entry) => entry.target instanceof HTMLElement && entry.target.classList.contains("ldcv-card")
    )?.target;

    if (resizedCard instanceof HTMLElement) {
      callback({ kind: "card", card: resizedCard });
      return;
    }

    callback({ kind: "full" });
  });
  const observedElements = new WeakSet<Element>();

  const observeElement = (element: Element): void => {
    if (observedElements.has(element)) {
      return;
    }
    observedElements.add(element);
    resizeObserver.observe(element);
  };

  const observeCards = (grid: HTMLElement): void => {
    grid.querySelectorAll<HTMLElement>(".ldcv-card").forEach(observeElement);
  };

  const mutationObserver = new MutationObserver((records) => {
    if (grid) {
      observeCards(grid);
    }
    if (shouldScheduleLayoutFromMutations(records)) {
      callback({ kind: "full" });
    }
  });

  const grid = target.querySelector<HTMLElement>(".ldcv-grid");
  if (grid) {
    observeElement(grid);
    observeCards(grid);
    mutationObserver.observe(grid, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  }

  return () => {
    resizeObserver.disconnect();
    mutationObserver.disconnect();
  };
}
