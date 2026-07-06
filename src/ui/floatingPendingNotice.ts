import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { TopicCardData } from "../discourse/types";
import { normalizePendingNoticeCount, pendingTopicIds, selectPendingTopics } from "./pendingNoticeModel";
import { FloatingPendingNotice } from "./react/components/FloatingPendingNotice";

const FLOATING_PENDING_NOTICE_SELECTOR = "[data-floating-pending-notice-root]";
const floatingPendingNoticeRoots = new WeakMap<HTMLElement, Root>();

export function floatingPendingNoticeTemplate(
  count: number,
  topics: TopicCardData[],
  expanded: boolean,
  minimized: boolean
): string {
  const topicIds = pendingTopicIds(topics);

  if (minimized) {
    return `<button type="button" class="ldcv-update-float is-minimized" data-floating-pending-notice-root data-pending-notice-count="${count}" data-pending-notice-expanded="${expanded ? "true" : "false"}" data-pending-notice-minimized="true" data-pending-topic-ids="${topicIds}" data-action="toggle-pending-preview" aria-label="展开新话题提示"></button>`;
  }

  return `<aside class="ldcv-update-float ${expanded ? "is-expanded" : ""}" data-floating-pending-notice-root data-pending-notice-count="${count}" data-pending-notice-expanded="${expanded ? "true" : "false"}" data-pending-notice-minimized="false" data-pending-topic-ids="${topicIds}" role="status" aria-live="polite"></aside>`;
}

export function renderFloatingPendingNotices(root: ShadowRoot | HTMLElement, topics: TopicCardData[]): void {
  root.querySelectorAll<HTMLElement>(FLOATING_PENDING_NOTICE_SELECTOR).forEach((host) => {
    let reactRoot = floatingPendingNoticeRoots.get(host);
    if (!reactRoot) {
      reactRoot = createRoot(host);
      floatingPendingNoticeRoots.set(host, reactRoot);
    }

    const count = normalizePendingNoticeCount(host.dataset.pendingNoticeCount);
    const expanded = host.dataset.pendingNoticeExpanded === "true";
    const minimized = host.dataset.pendingNoticeMinimized === "true";
    const noticeTopics = selectPendingTopics(topics, host.dataset.pendingTopicIds);
    host.dataset.reactFloatingPendingNotice = "true";
    flushSync(() => {
      reactRoot.render(createElement(FloatingPendingNotice, { count, topics: noticeTopics, expanded, minimized }));
    });
  });
}

export function unmountFloatingPendingNotices(root: ShadowRoot | HTMLElement): void {
  root.querySelectorAll<HTMLElement>(FLOATING_PENDING_NOTICE_SELECTOR).forEach((host) => {
    const reactRoot = floatingPendingNoticeRoots.get(host);
    if (!reactRoot) {
      return;
    }

    flushSync(() => {
      reactRoot.unmount();
    });
    floatingPendingNoticeRoots.delete(host);
  });
}
