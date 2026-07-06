import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { TopicCardData } from "../discourse/types";
import { normalizePendingNoticeCount, pendingTopicIds, selectPendingTopics } from "./pendingNoticeModel";
import { NativePendingNotice } from "./react/components/NativePendingNotice";

const NATIVE_PENDING_NOTICE_SELECTOR = "[data-native-pending-notice-root]";
const nativePendingNoticeRoots = new WeakMap<HTMLElement, Root>();

export function nativePendingNoticeTemplate(count: number, topics: TopicCardData[], expanded: boolean): string {
  const hasPendingTopics = count > 0;
  return `<div class="ldcv-native-notice ${expanded && hasPendingTopics ? "is-expanded" : ""} ${
    hasPendingTopics ? "has-pending" : ""
  }" data-native-pending-notice-root data-pending-notice-count="${count}" data-pending-notice-expanded="${
    expanded ? "true" : "false"
  }" data-pending-topic-ids="${pendingTopicIds(topics)}"></div>`;
}

export function renderNativePendingNotices(root: ShadowRoot | HTMLElement, topics: TopicCardData[]): void {
  root.querySelectorAll<HTMLElement>(NATIVE_PENDING_NOTICE_SELECTOR).forEach((host) => {
    let reactRoot = nativePendingNoticeRoots.get(host);
    if (!reactRoot) {
      reactRoot = createRoot(host);
      nativePendingNoticeRoots.set(host, reactRoot);
    }

    const count = normalizePendingNoticeCount(host.dataset.pendingNoticeCount);
    const expanded = host.dataset.pendingNoticeExpanded === "true";
    const noticeTopics = selectPendingTopics(topics, host.dataset.pendingTopicIds);
    host.dataset.reactNativePendingNotice = "true";
    flushSync(() => {
      reactRoot.render(createElement(NativePendingNotice, { count, topics: noticeTopics, expanded }));
    });
  });
}

export function unmountNativePendingNotices(root: ShadowRoot | HTMLElement): void {
  root.querySelectorAll<HTMLElement>(NATIVE_PENDING_NOTICE_SELECTOR).forEach((host) => {
    const reactRoot = nativePendingNoticeRoots.get(host);
    if (!reactRoot) {
      return;
    }

    flushSync(() => {
      reactRoot.unmount();
    });
    nativePendingNoticeRoots.delete(host);
  });
}
