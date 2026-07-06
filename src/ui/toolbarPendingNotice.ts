import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { ToolbarPendingNotice } from "./react/components/ToolbarPendingNotice";

const TOOLBAR_PENDING_NOTICE_SELECTOR = "[data-toolbar-pending-notice-root]";
const toolbarPendingNoticeRoots = new WeakMap<HTMLElement, Root>();

/**
 * Emits the stable `.ldcv-toolbar-pending` host element.
 *
 * The host is only present when there are pending topics so React never
 * mounts an empty summary (mirrors the legacy early return).
 */
export function toolbarPendingTemplate(count: number, expanded: boolean): string {
  if (count <= 0) {
    return "";
  }

  return `<div class="ldcv-toolbar-pending" data-toolbar-pending-notice-root data-pending-notice-count="${count}" data-pending-notice-expanded="${
    expanded ? "true" : "false"
  }"></div>`;
}

export function renderToolbarPendingNotices(
  root: ShadowRoot | HTMLElement,
  count: number,
  expanded: boolean
): void {
  root.querySelectorAll<HTMLElement>(TOOLBAR_PENDING_NOTICE_SELECTOR).forEach((host) => {
    let reactRoot = toolbarPendingNoticeRoots.get(host);
    if (!reactRoot) {
      reactRoot = createRoot(host);
      toolbarPendingNoticeRoots.set(host, reactRoot);
    }

    host.dataset.reactToolbarPendingNotice = "true";
    flushSync(() => {
      reactRoot.render(createElement(ToolbarPendingNotice, { count, expanded }));
    });
  });
}

export function unmountToolbarPendingNotices(root: ShadowRoot | HTMLElement): void {
  root.querySelectorAll<HTMLElement>(TOOLBAR_PENDING_NOTICE_SELECTOR).forEach((host) => {
    const reactRoot = toolbarPendingNoticeRoots.get(host);
    if (!reactRoot) {
      return;
    }

    flushSync(() => {
      reactRoot.unmount();
    });
    toolbarPendingNoticeRoots.delete(host);
  });
}
