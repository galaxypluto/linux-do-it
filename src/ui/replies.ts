import type { TopicReaderPost, TopicReplyNode } from "../discourse/types";
import type { CommentSortOrder } from "../storage/settings";

export interface ReplyRenderItem {
  node: TopicReplyNode;
  target: ReplyTarget | null;
}

export interface UserPreviewTarget {
  postNumber: number;
  label: string;
  href: string;
  username: string;
  name: string;
  avatarUrl: string;
}

export type ReplyTarget = UserPreviewTarget;

export function flattenReplyChildren(
  root: TopicReplyNode,
  postIndex: Map<number, TopicReaderPost>,
  sortOrder: CommentSortOrder
): ReplyRenderItem[] {
  const items: ReplyRenderItem[] = [];

  const visit = (node: TopicReplyNode, fallbackParent: TopicReaderPost): void => {
    const target = replyTargetForPost(node.post, postIndex) || replyTargetFromPost(fallbackParent);
    items.push({ node, target });
    node.children.forEach((child) => visit(child, node.post));
  };

  root.children.forEach((child) => visit(child, root.post));
  return sortReplyItems(items, sortOrder);
}

export function sortReplyNodes(nodes: TopicReplyNode[], sortOrder: CommentSortOrder): TopicReplyNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: sortReplyNodes(node.children, sortOrder)
    }))
    .sort((a, b) => compareReplyNodes(a, b, sortOrder));
}

export function replyTargetForPost(
  post: TopicReaderPost,
  postIndex: Map<number, TopicReaderPost>
): ReplyTarget | null {
  if (!post.replyToPostNumber || post.replyToPostNumber === 1) {
    return null;
  }

  const target = postIndex.get(post.replyToPostNumber);
  if (target?.author.username) {
    return replyTargetFromPost(target);
  }

  return {
    postNumber: post.replyToPostNumber,
    label: target ? authorDisplayName(target.author) : `#${post.replyToPostNumber}`,
    href: `#ldcv-post-${post.replyToPostNumber}`,
    username: "",
    name: target ? authorDisplayName(target.author) : "",
    avatarUrl: target?.author.avatarUrl || ""
  };
}

export function userTargetFromPost(post: TopicReaderPost): UserPreviewTarget {
  const displayName = authorDisplayName(post.author);
  if (post.author.username) {
    return {
      postNumber: post.postNumber,
      label: displayName,
      href: profileUrlForUsername(post.author.username),
      username: post.author.username,
      name: displayName,
      avatarUrl: post.author.avatarUrl
    };
  }

  return {
    postNumber: post.postNumber,
    label: displayName,
    href: `#ldcv-post-${post.postNumber}`,
    username: "",
    name: displayName,
    avatarUrl: post.author.avatarUrl
  };
}

function replyTargetFromPost(post: TopicReaderPost): ReplyTarget {
  return userTargetFromPost(post);
}

function sortReplyItems(items: ReplyRenderItem[], sortOrder: CommentSortOrder): ReplyRenderItem[] {
  return items.sort((a, b) =>
    sortOrder === "desc"
      ? postCreatedAtMs(b.node.post) - postCreatedAtMs(a.node.post)
      : postCreatedAtMs(a.node.post) - postCreatedAtMs(b.node.post)
  );
}

function compareReplyNodes(a: TopicReplyNode, b: TopicReplyNode, sortOrder: CommentSortOrder): number {
  if (sortOrder === "desc") {
    return latestThreadCreatedAtMs(b) - latestThreadCreatedAtMs(a);
  }
  return postCreatedAtMs(a.post) - postCreatedAtMs(b.post);
}

function latestThreadCreatedAtMs(node: TopicReplyNode): number {
  return Math.max(
    postCreatedAtMs(node.post),
    ...node.children.map((child) => latestThreadCreatedAtMs(child))
  );
}

function postCreatedAtMs(post: TopicReaderPost): number {
  const time = Date.parse(post.createdAt);
  return Number.isFinite(time) ? time : 0;
}

function authorDisplayName(author: TopicReaderPost["author"]): string {
  return author.name || author.username || "Linux.do 用户";
}

function profileUrlForUsername(username: string): string {
  return `/u/${encodeURIComponent(username)}/summary`;
}
