import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { TopicLoadMore } from "./react/components/TopicLoadMore";

export type TopicLoadMoreState = "arranging" | "loading" | "idle" | "complete";

const TOPIC_LOAD_MORE_SELECTOR = "[data-load-more-root]";
const topicLoadMoreRoots = new WeakMap<HTMLElement, Root>();

export function topicLoadMoreTemplate(state: TopicLoadMoreState): string {
  return `<div class="ldcv-load-more ${stateClassName(state)}" data-load-more-root data-topic-load-more-state="${state}"></div>`;
}

export function renderTopicLoadMore(root: ShadowRoot | HTMLElement): void {
  root.querySelectorAll<HTMLElement>(TOPIC_LOAD_MORE_SELECTOR).forEach((host) => {
    renderTopicLoadMoreHost(host, readState(host));
  });
}

export function unmountTopicLoadMore(root: ShadowRoot | HTMLElement): void {
  root.querySelectorAll<HTMLElement>(TOPIC_LOAD_MORE_SELECTOR).forEach((host) => {
    const reactRoot = topicLoadMoreRoots.get(host);
    if (!reactRoot) {
      return;
    }

    flushSync(() => {
      reactRoot.unmount();
    });
    topicLoadMoreRoots.delete(host);
  });
}

export function setTopicLoadMoreLoadingState(root: ShadowRoot | HTMLElement, loadingMore: boolean): void {
  const host = root.querySelector<HTMLElement>(TOPIC_LOAD_MORE_SELECTOR);
  const button = host?.querySelector<HTMLButtonElement>('[data-action="load-more"]');
  if (!host || !button) {
    return;
  }

  renderTopicLoadMoreHost(host, loadingMore ? "loading" : "idle");
}

function renderTopicLoadMoreHost(host: HTMLElement, state: TopicLoadMoreState): void {
  let reactRoot = topicLoadMoreRoots.get(host);
  if (!reactRoot) {
    reactRoot = createRoot(host);
    topicLoadMoreRoots.set(host, reactRoot);
  }

  host.dataset.topicLoadMoreState = state;
  host.dataset.reactTopicLoadMore = "true";
  syncStateClass(host, state);
  flushSync(() => {
    reactRoot.render(createElement(TopicLoadMore, { state }));
  });
}

function readState(host: HTMLElement): TopicLoadMoreState {
  return normalizeState(host.dataset.topicLoadMoreState);
}

function normalizeState(value: string | undefined): TopicLoadMoreState {
  if (value === "arranging" || value === "loading" || value === "complete") {
    return value;
  }
  return "idle";
}

function syncStateClass(host: HTMLElement, state: TopicLoadMoreState): void {
  host.classList.toggle("is-arranging", state === "arranging");
  host.classList.toggle("is-loading", state === "loading");
  host.classList.toggle("is-idle", state === "idle");
  host.classList.toggle("is-complete", state === "complete");
}

function stateClassName(state: TopicLoadMoreState): string {
  return `is-${state}`;
}
