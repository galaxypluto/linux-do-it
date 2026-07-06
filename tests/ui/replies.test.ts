import { describe, expect, it } from "vitest";
import { flattenReplyChildren, replyTargetForPost, sortReplyNodes, userTargetFromPost } from "../../src/ui/replies";
import type { TopicReaderPost, TopicReplyNode } from "../../src/discourse/types";

function post(
  postNumber: number,
  createdAt: string,
  overrides: Partial<TopicReaderPost> = {}
): TopicReaderPost {
  return {
    id: postNumber,
    postNumber,
    replyToPostNumber: null,
    author: {
      id: postNumber,
      username: `user${postNumber}`,
      name: `User ${postNumber}`,
      avatarUrl: `https://linux.do/avatar/${postNumber}.png`
    },
    createdAt,
    html: `<p>Post ${postNumber}</p>`,
    stats: {
      likes: 0,
      reads: 0,
      replies: 0
    },
    actions: {
      canReply: true,
      canLike: true,
      liked: false,
      canBookmark: postNumber === 1,
      bookmarked: false
    },
    url: `/t/topic/10/${postNumber}`,
    isOriginalPost: postNumber === 1,
    isOriginalPoster: postNumber === 1,
    ...overrides
  };
}

function node(postValue: TopicReaderPost, children: TopicReplyNode[] = []): TopicReplyNode {
  return {
    post: postValue,
    children,
    depth: 0
  };
}

describe("reply sorting", () => {
  it("sorts ascending by root post time", () => {
    const early = node(post(2, "2026-05-01T00:00:00.000Z"));
    const late = node(post(3, "2026-05-02T00:00:00.000Z"));

    expect(sortReplyNodes([late, early], "asc").map((item) => item.post.postNumber)).toEqual([2, 3]);
  });

  it("sorts descending by latest post in each thread", () => {
    const oldThreadWithNewChild = node(post(2, "2026-05-01T00:00:00.000Z"), [
      node(post(4, "2026-05-04T00:00:00.000Z"))
    ]);
    const newerRoot = node(post(3, "2026-05-03T00:00:00.000Z"));

    expect(sortReplyNodes([newerRoot, oldThreadWithNewChild], "desc").map((item) => item.post.postNumber)).toEqual([
      2,
      3
    ]);
  });
});

describe("reply targets", () => {
  it("returns author profile targets for known replied posts", () => {
    const parent = post(2, "2026-05-01T00:00:00.000Z");
    const child = post(3, "2026-05-02T00:00:00.000Z", { replyToPostNumber: 2 });
    const target = replyTargetForPost(child, new Map([[2, parent]]));

    expect(target).toMatchObject({
      postNumber: 2,
      label: "User 2",
      href: "/u/user2/summary",
      username: "user2",
      name: "User 2"
    });
  });

  it("uses a local post anchor when the replied post has no username", () => {
    const parent = post(2, "2026-05-01T00:00:00.000Z", {
      author: { id: null, username: "", name: "Anonymous", avatarUrl: "" }
    });
    const child = post(3, "2026-05-02T00:00:00.000Z", { replyToPostNumber: 2 });
    const target = replyTargetForPost(child, new Map([[2, parent]]));

    expect(target).toMatchObject({
      postNumber: 2,
      label: "Anonymous",
      href: "#ldcv-post-2",
      username: "",
      name: "Anonymous"
    });
  });

  it("flattens nested replies and falls back to the nearest parent as target", () => {
    const rootPost = post(2, "2026-05-01T00:00:00.000Z");
    const childPost = post(3, "2026-05-02T00:00:00.000Z", { replyToPostNumber: null });
    const grandChildPost = post(4, "2026-05-03T00:00:00.000Z", { replyToPostNumber: null });
    const root = node(rootPost, [node(childPost, [node(grandChildPost)])]);
    const items = flattenReplyChildren(root, new Map(), "asc");

    expect(items.map((item) => [item.node.post.postNumber, item.target?.postNumber])).toEqual([
      [3, 2],
      [4, 3]
    ]);
  });

  it("creates user preview targets from posts", () => {
    expect(userTargetFromPost(post(2, "2026-05-01T00:00:00.000Z"))).toMatchObject({
      postNumber: 2,
      label: "User 2",
      href: "/u/user2/summary",
      username: "user2"
    });
  });
});
