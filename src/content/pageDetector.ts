export function mainOutlet(): HTMLElement | null {
  return document.querySelector<HTMLElement>("#main-outlet");
}

export function listInsertionPoint(): HTMLElement | null {
  const listArea = document.querySelector<HTMLElement>("#list-area");
  if (listArea) {
    return listArea;
  }

  const contents = Array.from(document.querySelectorAll<HTMLElement>(".contents")).find(hasTopicListContent);
  if (contents) {
    return contents;
  }

  const outlet = mainOutlet();
  return outlet && hasTopicListContent(outlet) ? outlet : null;
}

export interface RootInsertionTarget {
  parent: HTMLElement;
  before: ChildNode | null;
  mode: "list" | "preserve";
}

export function rootInsertionTarget({
  preserveWithoutList = false
}: {
  preserveWithoutList?: boolean;
} = {}): RootInsertionTarget | null {
  const insertionPoint = listInsertionPoint();
  const outlet = mainOutlet();
  if (insertionPoint?.parentElement && !(preserveWithoutList && insertionPoint === outlet)) {
    return {
      parent: insertionPoint.parentElement,
      before: insertionPoint,
      mode: "list"
    };
  }

  if (!preserveWithoutList) {
    return null;
  }

  return outlet
    ? {
        parent: outlet,
        before: outlet.firstElementChild,
        mode: "preserve"
      }
    : null;
}

function hasTopicListContent(element: HTMLElement): boolean {
  return Boolean(
    element.querySelector(
      "#list-area, .topic-list, .topic-list-body, .topic-list-item, .latest-topic-list, .latest-topic-list-item, .category-list, .category-list-item, .tag-list, .tag-list-item"
    )
  );
}
