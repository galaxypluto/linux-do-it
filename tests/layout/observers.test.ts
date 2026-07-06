import { describe, expect, it, vi } from "vitest";
import { applyMasonry } from "../../src/layout/masonry";
import {
  isCardChromeMutation,
  masonryCardTopicSelector,
  shouldScheduleLayoutFromMutations,
} from "../../src/layout/observers";

describe("layout observers", () => {
  it("treats card selection and read-badge updates as chrome mutations", () => {
    const card = document.createElement("article");
    card.className = "ldcv-card";
    const status = document.createElement("div");
    status.className = "ldcv-card__status";
    card.append(status);

    expect(
      isCardChromeMutation({
        type: "attributes",
        target: card,
        attributeName: "class",
      } as MutationRecord)
    ).toBe(true);

    const badge = document.createElement("span");
    badge.className = "ldcv-state is-reading";
    badge.textContent = "正在阅读";
    status.append(badge);
    expect(
      isCardChromeMutation({
        type: "childList",
        target: status,
        addedNodes: [badge] as unknown as NodeList,
        removedNodes: [] as unknown as NodeList,
      } as MutationRecord)
    ).toBe(true);
    expect(
      shouldScheduleLayoutFromMutations([
        {
          type: "attributes",
          target: card,
          attributeName: "class",
        } as MutationRecord,
      ])
    ).toBe(false);
  });

  it("still schedules layout for newly appended topic cards", () => {
    const grid = document.createElement("div");
    grid.className = "ldcv-grid";
    const card = document.createElement("article");
    card.className = "ldcv-card";
    expect(
      shouldScheduleLayoutFromMutations([
        {
          type: "childList",
          target: grid,
          addedNodes: [card] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList,
        } as MutationRecord,
      ])
    ).toBe(true);
  });

  it("builds a topic-scoped masonry selector from a card", () => {
    const card = document.createElement("article");
    card.className = "ldcv-card";
    card.dataset.topicId = "42";
    expect(masonryCardTopicSelector(card)).toBe('.ldcv-card[data-topic-id="42"]');
  });
});

describe("masonry placement stability", () => {
  it("keeps existing card spans on a full pass unless remeasureAll is requested", () => {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <div data-card-grid="masonry" style="display: grid; grid-auto-rows: 4px; row-gap: 16px;">
        <article class="ldcv-card" data-topic-id="1" style="grid-row-end: span 6"></article>
        <article class="ldcv-card" data-topic-id="2" style="grid-row-end: span 9"></article>
      </div>
    `;
    const grid = root.querySelector<HTMLElement>("[data-card-grid='masonry']")!;
    const first = root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='1']")!;
    const second = root.querySelector<HTMLElement>(".ldcv-card[data-topic-id='2']")!;

    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      if (element === grid) {
        return {
          getPropertyValue: (property: string) => {
            if (property === "grid-auto-rows") return "4px";
            if (property === "row-gap") return "16px";
            return "";
          },
        } as CSSStyleDeclaration;
      }
      return {} as CSSStyleDeclaration;
    });

    const setHeight = (card: HTMLElement, height: number) => {
      card.getBoundingClientRect = () =>
        ({
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 320,
          bottom: height,
          width: 320,
          height,
          toJSON: () => ({}),
        }) as DOMRect;
      Object.defineProperty(card, "offsetHeight", { configurable: true, value: height });
      Object.defineProperty(card, "scrollHeight", { configurable: true, value: height });
    };
    setHeight(first, 80);
    setHeight(second, 200);

    applyMasonry(root);
    expect(first.style.getPropertyValue("grid-row-end")).toBe("span 6");
    expect(second.style.getPropertyValue("grid-row-end")).toBe("span 9");

    setHeight(first, 240);
    setHeight(second, 40);
    applyMasonry(root, { remeasureAll: true });
    expect(first.style.getPropertyValue("grid-row-end")).not.toBe("span 6");
    expect(second.style.getPropertyValue("grid-row-end")).not.toBe("span 9");
  });
});
