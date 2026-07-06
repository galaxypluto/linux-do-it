import { describe, expect, it } from "vitest";
import { cardTemplate, cardVariantForTopic, shouldUseTitlePreview, topicLabelRowTemplate } from "../../src/ui/cards";
import type { TopicCardData } from "../../src/discourse/types";

function topic(overrides: Partial<TopicCardData> = {}): TopicCardData {
  return {
    id: 1,
    title: "Escaped <topic>",
    url: "/t/escaped-topic/1",
    slug: "escaped-topic",
    excerpt: "Excerpt",
    thumbnailUrl: "",
    category: {
      id: 2,
      name: "General",
      parentName: "Parent",
      color: "aabbcc",
      textColor: "ffffff"
    },
    tags: ["one", "two", "three", "four"],
    stats: {
      replies: 10,
      views: 1000,
      likes: 2,
      score: 0
    },
    dates: {
      createdAt: "2026-05-01T00:00:00.000Z",
      activityAt: "2026-05-02T00:00:00.000Z"
    },
    flags: {
      pinned: false,
      closed: false,
      archived: false,
      bookmarked: false,
      unseen: false
    },
    posters: [
      {
        id: 7,
        username: "alice",
        name: "Alice <Admin>",
        avatarUrl: "",
        description: "Original Poster",
        isOriginalPoster: true
      }
    ],
    ...overrides
  };
}

describe("card variants", () => {
  it("uses fixed media cards for grid layout", () => {
    expect(cardVariantForTopic(topic({ thumbnailUrl: "" }), "grid")).toBe("media");
  });

  it("uses text cards for image-less non-grid layouts", () => {
    expect(cardVariantForTopic(topic({ thumbnailUrl: "" }), "reader")).toBe("text");
    expect(cardVariantForTopic(topic({ thumbnailUrl: "" }), "masonry")).toBe("text");
  });

  it("uses feature cards for high-signal masonry image topics", () => {
    expect(
      cardVariantForTopic(
        topic({
          thumbnailUrl: "https://linux.do/image.png",
          stats: { replies: 250, views: 1000, likes: 0, score: 0 }
        }),
        "masonry"
      )
    ).toBe("feature");
  });

  it("uses title preview only when non-masonry text topics have no excerpt", () => {
    expect(shouldUseTitlePreview(topic({ thumbnailUrl: "", excerpt: "" }), "grid")).toBe(true);
    expect(shouldUseTitlePreview(topic({ thumbnailUrl: "", excerpt: "" }), "masonry")).toBe(false);
    expect(shouldUseTitlePreview(topic({ thumbnailUrl: "", excerpt: "Summary" }), "grid")).toBe(false);
  });
});

describe("card templates", () => {
  it("renders escaped card content, author fallback, state, tags, and stats", () => {
    const html = cardTemplate(topic(), 0, "grid", {
      selected: true,
      viewed: false,
      justRead: false
    });
    const doc = new DOMParser().parseFromString(html, "text/html");
    const card = doc.querySelector(".ldcv-card");

    expect(card?.classList.contains("is-selected")).toBe(true);
    expect(card?.getAttribute("data-card-variant")).toBe("media");
    expect(doc.querySelector(".ldcv-card__title")?.innerHTML).toBe("Escaped &lt;topic&gt;");
    expect(doc.querySelector(".ldcv-card__username")?.innerHTML).toBe("Alice &lt;Admin&gt;");
    expect(doc.querySelector(".ldcv-card__body")?.getAttribute("href")).toBe("/t/escaped-topic/1");
    expect(doc.querySelector(".ldcv-card__avatar span")?.textContent).toBe("A");
    expect(doc.querySelector(".ldcv-state.is-reading")?.textContent).toBe("正在阅读");
    expect(doc.querySelector(".ldcv-tag--more")?.textContent).toBe("+2");
    expect(doc.querySelectorAll(".ldcv-stat")).toHaveLength(3);
  });

  it("renders reader topic labels without tags when no label data exists", () => {
    expect(topicLabelRowTemplate(undefined, [])).toBe("");
    expect(topicLabelRowTemplate(topic().category, ["guide"], "", "reader-labels")).toContain(
      "reader-labels"
    );
  });

  it("caps topic tags at two by default and collapses the rest into +N", () => {
    const doc = new DOMParser().parseFromString(
      topicLabelRowTemplate(topic().category, ["one", "two", "three", "four"]),
      "text/html"
    );

    expect(Array.from(doc.querySelectorAll(".ldcv-tag")).map((node) => node.textContent)).toEqual(["one", "two", "+2"]);
    expect(doc.querySelector(".ldcv-tag--more")?.getAttribute("title")).toBe("one / two / three / four");
  });
});
