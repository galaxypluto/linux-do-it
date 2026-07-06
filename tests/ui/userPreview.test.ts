import { describe, expect, it } from "vitest";
import {
  previewMatches,
  sameUserPreviewAnchor,
  userPreviewTemplate,
  type ReaderUserPreviewState
} from "../../src/ui/userPreview";
import type { UserPreviewTarget } from "../../src/ui/replies";

const target: UserPreviewTarget = {
  postNumber: 2,
  label: "Alice",
  href: "/u/alice/summary",
  username: "alice",
  name: "Alice",
  avatarUrl: "https://linux.do/avatar/alice.png"
};

function preview(overrides: Partial<ReaderUserPreviewState> = {}): ReaderUserPreviewState {
  return {
    username: "alice",
    name: "Alice",
    avatarUrl: "https://linux.do/avatar/alice.png",
    href: "/u/alice/summary",
    postNumber: 2,
    anchorPostNumber: 2,
    anchorType: "author",
    loading: false,
    error: "",
    profile: null,
    ...overrides
  };
}

describe("previewMatches", () => {
  it("matches the same username, post, anchor post, and anchor type", () => {
    expect(previewMatches(preview(), target, 2, "author")).toBe(true);
    expect(previewMatches(preview({ anchorType: "reply-target" }), target, 2, "author")).toBe(false);
    expect(previewMatches(preview({ postNumber: 3 }), target, 2, "author")).toBe(false);
    expect(previewMatches(preview(), { ...target, username: "" }, 2, "author")).toBe(false);
  });

  it("compares hydrated preview anchors by identity fields only", () => {
    expect(sameUserPreviewAnchor(preview({ loading: true }), preview({ loading: false }))).toBe(true);
    expect(sameUserPreviewAnchor(preview(), preview({ anchorPostNumber: 3 }))).toBe(false);
    expect(sameUserPreviewAnchor(preview(), preview({ username: "bob" }))).toBe(false);
  });
});

describe("userPreviewTemplate", () => {
  it("renders profile data, joined date, and private message action", () => {
    const html = userPreviewTemplate(
      { ...target, name: "Target <Name>" },
      preview({
        profile: {
          id: 2,
          username: "alice",
          name: "Alice <Admin>",
          avatarUrl: "https://linux.do/profile-avatar.png",
          joinedAt: "2026-05-01T00:00:00.000Z",
          profileUrl: "/u/alice/summary",
          messageUrl: "/new-message?username=alice",
          canMessage: true
        }
      })
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("strong")?.innerHTML).toBe("Alice &lt;Admin&gt;");
    expect(doc.querySelector("img")?.getAttribute("src")).toBe("https://linux.do/profile-avatar.png");
    expect(doc.querySelector(".ldcv-user-preview__joined")?.textContent).toContain("2026/05/01");
    expect(doc.querySelector("[data-action='private-message']")).not.toBeNull();
  });

  it("renders fallback marker, loading/error labels, and disabled private message action", () => {
    const noAvatarTarget = { ...target, avatarUrl: "", name: "Alice" };
    const loadingDoc = new DOMParser().parseFromString(
      userPreviewTemplate(noAvatarTarget, preview({ loading: true, avatarUrl: "", profile: null })),
      "text/html"
    );
    const disabledDoc = new DOMParser().parseFromString(
      userPreviewTemplate(
        noAvatarTarget,
        preview({
          error: "failed",
          avatarUrl: "",
          profile: {
            id: 2,
            username: "alice",
            name: "Alice",
            avatarUrl: "",
            joinedAt: "",
            profileUrl: "/u/alice/summary",
            messageUrl: "/new-message?username=alice",
            canMessage: false
          }
        })
      ),
      "text/html"
    );

    expect(loadingDoc.querySelector(".ldcv-reader-author__mark")?.textContent).toBe("A");
    expect(loadingDoc.querySelector(".ldcv-user-preview__joined")?.textContent).toContain("读取中");
    expect(disabledDoc.querySelector(".ldcv-user-preview__joined")?.textContent).toContain("不可用");
    expect(disabledDoc.querySelector(".ldcv-user-preview__button.is-disabled")).not.toBeNull();
    expect(disabledDoc.querySelector("[data-action='private-message']")).toBeNull();
  });
});
