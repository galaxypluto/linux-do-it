import type { LinuxDoTopicRoute } from "../domain/linuxdo/routes";
import { linuxDoClassicTopicPath, linuxDoNestedTopicPath } from "../domain/linuxdo/urls";
import { selectors } from "../sites/linuxdo/selectors";
import type { ExtensionSettings } from "../storage/settings";
import { icons } from "../ui/icons";

const TOPIC_ENHANCER_MODE_CLASS = "ldcv-topic-enhancer-mode";
const TOPIC_COMPACT_CLASS = "ldcv-topic-native-compact";
const CONTROLS_CLASS = "ldcv-topic-native-controls";
const POST_ENHANCED_CLASS = "ldcv-topic-post-enhanced";
const POST_HIDDEN_CLASS = "ldcv-topic-post-hidden";
const POST_MATCH_CLASS = "ldcv-topic-post-match";

export type TopicPageFilterState = {
  query: string;
  opOnly: boolean;
  compact: boolean;
};

type TopicPageEnhancerOptions = {
  route: LinuxDoTopicRoute;
  settings: ExtensionSettings;
};

type ApplyNestedTopicPostEnhancementResult = {
  enhanced: number;
  matched: number;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

let activeEnhancer: TopicPageEnhancer | null = null;

export async function mountTopicPageEnhancer(options: TopicPageEnhancerOptions): Promise<void> {
  if (!options.settings.enabled) {
    unmountTopicPageEnhancer();
    return;
  }

  const routeKey = topicRouteKey(options.route);
  if (activeEnhancer?.routeKey === routeKey) {
    activeEnhancer.updateSettings(options.settings);
    return;
  }

  unmountTopicPageEnhancer();
  activeEnhancer = new TopicPageEnhancer(options);
  await activeEnhancer.start();
}

export function unmountTopicPageEnhancer(): void {
  activeEnhancer?.stop();
  activeEnhancer = null;
}

export function nestedTopicPathFromRoute(route: LinuxDoTopicRoute, postNumber = route.postNumber): string {
  return linuxDoNestedTopicPath(route.slug, route.topicId, postNumber);
}

export function classicTopicPathFromRoute(route: LinuxDoTopicRoute, postNumber = route.postNumber): string {
  return linuxDoClassicTopicPath(route.slug, route.topicId, postNumber);
}

export async function nativeNestedTopicAvailable(
  route: LinuxDoTopicRoute,
  signal?: AbortSignal,
  fetcher: FetchLike = fetch
): Promise<boolean> {
  const response = await fetcher(`${nestedTopicPathFromRoute(route, null)}.json`, {
    credentials: "include",
    headers: {
      Accept: "application/json"
    },
    signal
  });
  if (!response.ok) {
    return false;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return false;
  }

  const payload = (await response.json()) as { roots?: unknown; op_post?: unknown };
  return Array.isArray(payload.roots) && Boolean(payload.op_post);
}

export function extractNativeTopicPostNumber(postElement: Element): number | null {
  const explicit = numericAttribute(postElement, "data-post-number") ?? numericAttribute(postElement, "data-ldcv-post-number");
  if (explicit) {
    return explicit;
  }

  const idMatch = postElement.id.match(/(?:^|[-_])post[-_]?(\d+)$/i);
  if (idMatch) {
    return positiveNumber(idMatch[1]);
  }

  const postDate = postElement.querySelector<HTMLAnchorElement>(".post-date[href], a[href*='/t/'][href], a[href*='/n/'][href]");
  return postDate ? postNumberFromHref(postDate.href) : null;
}

export function applyNativeNestedTopicPostEnhancements(
  documentRef: Document,
  state: TopicPageFilterState
): ApplyNestedTopicPostEnhancementResult {
  const query = normalizeQuery(state.query);
  const filterActive = Boolean(query || state.opOnly);
  let enhanced = 0;
  let matched = 0;

  for (const element of nativeTopicPosts(documentRef)) {
    const postNumber = extractNativeTopicPostNumber(element);
    if (!postNumber) {
      continue;
    }

    const isOriginalPoster = nativeTopicPostIsOriginalPoster(element, postNumber);
    const queryMatches = query ? nativeTopicPostMatchesQuery(element, postNumber, query) : true;
    const matches = (!state.opOnly || isOriginalPoster) && queryMatches;
    enhanced += 1;
    if (matches) {
      matched += 1;
    }

    element.classList.add(POST_ENHANCED_CLASS);
    element.classList.toggle(POST_MATCH_CLASS, Boolean(query && matches));
    element.classList.toggle(POST_HIDDEN_CLASS, filterActive && !matches);
    setDatasetValue(element, "ldcvPostNumber", postNumber);
    setDatasetValue(element, "ldcvOriginalPoster", isOriginalPoster ? "true" : "false");
    setDatasetValue(element, "ldcvSearchMatch", query ? (matches ? "true" : "false") : null);
  }

  return { enhanced, matched };
}

export function nativeNavigationPostNumbers(documentRef: Document, state: TopicPageFilterState): number[] {
  const query = normalizeQuery(state.query);
  const seen = new Set<number>();
  const postNumbers: number[] = [];
  for (const element of nativeTopicPosts(documentRef)) {
    const postNumber = extractNativeTopicPostNumber(element);
    if (!postNumber || seen.has(postNumber)) {
      continue;
    }
    const isOriginalPoster = nativeTopicPostIsOriginalPoster(element, postNumber);
    const matches = (!state.opOnly || isOriginalPoster) && (!query || nativeTopicPostMatchesQuery(element, postNumber, query));
    if (!matches) {
      continue;
    }
    seen.add(postNumber);
    postNumbers.push(postNumber);
  }
  return postNumbers;
}

export function nextPostNumberFromCandidates(
  postNumbers: readonly number[],
  currentPostNumber: number | null,
  step: number
): number | null {
  if (!postNumbers.length) {
    return null;
  }
  const currentIndex = currentPostNumber ? postNumbers.findIndex((postNumber) => postNumber === currentPostNumber) : -1;
  const nextIndex =
    currentIndex === -1
      ? step > 0
        ? 0
        : postNumbers.length - 1
      : (currentIndex + step + postNumbers.length) % postNumbers.length;
  return postNumbers[nextIndex] ?? null;
}

class TopicPageEnhancer {
  readonly routeKey: string;
  private readonly route: LinuxDoTopicRoute;
  private readonly controller = new AbortController();
  private controls: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private state: TopicPageFilterState;
  private searchOpen = false;
  private applyTimer: number | undefined;
  private cursorPostNumber: number | null = null;

  constructor(options: TopicPageEnhancerOptions) {
    this.route = options.route;
    this.routeKey = topicRouteKey(options.route);
    this.state = {
      query: "",
      opOnly: false,
      compact: true
    };
  }

  async start(): Promise<void> {
    document.documentElement.classList.add(TOPIC_ENHANCER_MODE_CLASS);
    document.documentElement.classList.add(TOPIC_COMPACT_CLASS);

    this.observeNativePosts();
    this.ensureControls();
    document.addEventListener("pointerdown", this.handleDocumentPointerDown, {
      capture: true,
      signal: this.controller.signal
    });
    this.renderControls("ready");
    this.apply();
  }

  updateSettings(_settings: ExtensionSettings): void {
    this.syncControls();
    this.apply();
  }

  stop(): void {
    this.controller.abort();
    this.observer?.disconnect();
    this.observer = null;
    window.clearTimeout(this.applyTimer);
    this.controls?.remove();
    this.controls = null;
    document.documentElement.classList.remove(TOPIC_ENHANCER_MODE_CLASS, TOPIC_COMPACT_CLASS);
    for (const element of nativeTopicPosts(document)) {
      element.classList.remove(POST_ENHANCED_CLASS, POST_HIDDEN_CLASS, POST_MATCH_CLASS);
      delete element.dataset.ldcvPostNumber;
      delete element.dataset.ldcvOriginalPoster;
      delete element.dataset.ldcvSearchMatch;
    }
  }

  private ensureControls(): HTMLElement | null {
    if (this.controls?.isConnected) {
      return this.controls;
    }

    if (!document.body) {
      return null;
    }

    const controls = document.createElement("section");
    controls.className = CONTROLS_CLASS;
    controls.setAttribute("aria-label", "Topic reading controls");
    controls.addEventListener("input", this.handleInput);
    controls.addEventListener("click", this.handleClick);
    controls.addEventListener("keydown", this.handleKeyDown);
    document.body.appendChild(controls);
    this.controls = controls;
    return controls;
  }

  private renderControls(status: "loading" | "ready" | "error", error = ""): void {
    const controls = this.controls;
    if (!controls) {
      return;
    }
    controls.classList.toggle("is-status", status !== "ready");
    const statusText =
      status === "loading"
        ? "正在进入原生嵌套视图"
        : status === "error"
          ? `增强不可用：${escapeHtml(error)}`
          : "";
    controls.innerHTML = `
      <div class="ldcv-topic-native-controls__summary">
        <span data-topic-enhancer-count>${statusText}</span>
      </div>
      <div class="ldcv-topic-native-controls__cluster">
        <label class="ldcv-topic-native-controls__search" title="搜索评论">
          <button type="button" class="ldcv-topic-native-controls__icon" data-topic-enhancer-toggle-search aria-label="搜索评论" aria-expanded="false" ${
            status === "ready" ? "" : "disabled"
          }>${icons.search}</button>
          <input type="search" data-topic-enhancer-search aria-label="搜索评论" autocomplete="off" placeholder="关键词 / 用户 / 楼层" ${
            status === "ready" ? "" : "disabled"
          }>
        </label>
        <button type="button" class="ldcv-topic-native-controls__icon" data-topic-enhancer-op-only aria-label="只看 OP" title="只看 OP" aria-pressed="false" ${
          status === "ready" ? "" : "disabled"
        }>OP</button>
        <div class="ldcv-topic-native-controls__jump" role="group" aria-label="匹配楼层跳转">
          <button type="button" data-topic-enhancer-jump-step="-1" aria-label="上一个" title="上一个" ${
            status === "ready" ? "" : "disabled"
          }>${icons.previous}</button>
          <button type="button" data-topic-enhancer-jump-step="1" aria-label="下一个" title="下一个" ${
            status === "ready" ? "" : "disabled"
          }>${icons.next}</button>
        </div>
      </div>
    `;
    this.syncControls();
  }

  private syncControls(): void {
    const controls = this.controls;
    if (!controls) {
      return;
    }
    controls.classList.toggle("is-search-open", this.searchOpen);
    const search = controls.querySelector<HTMLInputElement>("[data-topic-enhancer-search]");
    const searchToggle = controls.querySelector<HTMLButtonElement>("[data-topic-enhancer-toggle-search]");
    const opOnly = controls.querySelector<HTMLButtonElement>("[data-topic-enhancer-op-only]");
    if (search && document.activeElement !== search) {
      search.value = this.state.query;
    }
    if (searchToggle) {
      searchToggle.classList.toggle("is-active", this.searchOpen || Boolean(this.state.query));
      searchToggle.setAttribute("aria-expanded", String(this.searchOpen));
    }
    if (opOnly) {
      opOnly.classList.toggle("is-active", this.state.opOnly);
      opOnly.setAttribute("aria-pressed", String(this.state.opOnly));
    }
  }

  private apply(): void {
    document.documentElement.classList.toggle(TOPIC_COMPACT_CLASS, this.state.compact);
    const result = applyNativeNestedTopicPostEnhancements(document, this.state);
    const count = this.controls?.querySelector<HTMLElement>("[data-topic-enhancer-count]");
    if (count) {
      count.textContent = `${result.matched}/${result.enhanced} 匹配`;
    }
  }

  private scheduleApply(): void {
    window.clearTimeout(this.applyTimer);
    this.applyTimer = window.setTimeout(() => {
      this.applyTimer = undefined;
      this.apply();
    }, 80);
  }

  private observeNativePosts(): void {
    this.observer?.disconnect();
    const root = document.querySelector(selectors.nestedTopicView) ?? document.querySelector("#main-outlet") ?? document.body;
    this.observer = new MutationObserver(() => this.scheduleApply());
    this.observer.observe(root, { childList: true, subtree: true });
  }

  private readonly handleInput = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches("[data-topic-enhancer-search]")) {
      return;
    }
    this.cursorPostNumber = null;
    this.searchOpen = true;
    this.state = { ...this.state, query: target.value };
    this.apply();
  };

  private readonly handleClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const searchToggle = target?.closest<HTMLButtonElement>("[data-topic-enhancer-toggle-search]");
    if (searchToggle) {
      this.searchOpen = !this.searchOpen;
      this.syncControls();
      const search = this.controls?.querySelector<HTMLInputElement>("[data-topic-enhancer-search]");
      if (this.searchOpen) {
        window.setTimeout(() => search?.focus(), 0);
      } else {
        search?.blur();
      }
      return;
    }

    const opOnlyButton = target?.closest<HTMLButtonElement>("[data-topic-enhancer-op-only]");
    if (opOnlyButton) {
      this.state = { ...this.state, opOnly: !this.state.opOnly };
      this.cursorPostNumber = null;
      this.syncControls();
      this.apply();
      return;
    }

    const jumpButton = target?.closest<HTMLButtonElement>("[data-topic-enhancer-jump-step]");
    const step = jumpButton ? Number(jumpButton.dataset.topicEnhancerJumpStep) : 0;
    if (!step) {
      return;
    }
    const postNumbers = nativeNavigationPostNumbers(document, this.state);
    const postNumber =
      nextPostNumberFromCandidates(postNumbers, this.cursorPostNumber, step) ??
      (this.state.query && !this.state.opOnly ? positiveNumber(this.state.query) : null);
    if (!postNumber) {
      return;
    }
    this.cursorPostNumber = postNumber;
    const post = nativeTopicPosts(document).find((element) => extractNativeTopicPostNumber(element) === postNumber);
    if (post) {
      post.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    window.location.assign(nestedTopicPathFromRoute(this.route, postNumber));
  };

  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.searchOpen) {
      return;
    }
    const target = event.target;
    if (target instanceof Node && this.controls?.contains(target)) {
      return;
    }
    this.searchOpen = false;
    this.controls?.querySelector<HTMLInputElement>("[data-topic-enhancer-search]")?.blur();
    this.syncControls();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (event.key !== "Escape" || !(target instanceof HTMLInputElement) || !target.matches("[data-topic-enhancer-search]")) {
      return;
    }
    if (this.state.query) {
      this.state = { ...this.state, query: "" };
      this.cursorPostNumber = null;
      this.apply();
      return;
    }
    this.searchOpen = false;
    target.blur();
    this.syncControls();
  };
}

function nativeTopicPosts(documentRef: Document): HTMLElement[] {
  return Array.from(documentRef.querySelectorAll<HTMLElement>(selectors.nestedTopicPost));
}

function nativeTopicPostIsOriginalPoster(element: HTMLElement, postNumber: number): boolean {
  return postNumber === 1 || element.matches(".nested-view__op-article") || Boolean(element.querySelector(selectors.nestedTopicOpBadge));
}

function nativeTopicPostMatchesQuery(element: HTMLElement, postNumber: number, query: string): boolean {
  return normalizeQuery(element.textContent).includes(query) || String(postNumber).includes(query);
}

function topicRouteKey(route: LinuxDoTopicRoute): string {
  return `nested:${route.topicId}:${route.slug}:${route.postNumber ?? ""}`;
}

function normalizeQuery(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function numericAttribute(element: Element, attribute: string): number | null {
  return positiveNumber(element.getAttribute(attribute));
}

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
}

function postNumberFromHref(href: string): number | null {
  try {
    const url = new URL(href, window.location.origin);
    const match = url.pathname.match(/^\/[tn]\/[^/]+\/\d+\/(\d+)\/?$/);
    return match ? positiveNumber(match[1]) : null;
  } catch {
    const match = href.match(/^\/[tn]\/[^/]+\/\d+\/(\d+)\/?$/);
    return match ? positiveNumber(match[1]) : null;
  }
}

function setDatasetValue(element: HTMLElement, key: string, value: string | number | null): void {
  if (value === null || value === undefined || value === "") {
    delete element.dataset[key];
    return;
  }
  element.dataset[key] = String(value);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
