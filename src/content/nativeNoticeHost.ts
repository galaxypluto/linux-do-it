export const NATIVE_NOTICE_ID = "linuxdo-card-view-native-notice";

const PINNED_OBSTRUCTION_MAX_TOP = 96;
const NATIVE_CONTROL_MIN_HEIGHT = 30;
const NATIVE_CONTROL_MAX_HEIGHT = 48;
const NATIVE_CONTROL_MIN_WIDTH = 64;
const NATIVE_CONTROL_MAX_WIDTH = 150;
const NATIVE_NOTICE_BACKGROUND_TOKENS = [
  "--secondary",
  "--token-color-surface",
  "--token-color-background-input",
  "--header_background",
  "--primary-50"
];
const NATIVE_NOTICE_BORDER_TOKENS = [
  "--primary-300",
  "--input-border-color",
  "--primary-low-mid",
  "--content-border-color",
  "--token-color-border-default",
  "--primary-200",
  "--primary-400"
];
const NATIVE_NOTICE_COLOR_TOKENS = [
  "--primary-800",
  "--d-button-flat-close-text-color",
  "--jss_header_color",
  "--primary-medium",
  "--primary-med-or-secondary-high",
  "--primary",
  "--header_primary"
];

interface NativeNoticeTarget {
  container: HTMLElement;
  before: ChildNode | null;
}

interface NoticeDockPosition {
  left: number;
  top: number;
  width: number;
}

export interface NativeNoticeHostControllerOptions {
  rootHost: () => HTMLElement | null;
  outlet: () => HTMLElement | null;
  documentRef?: Document;
  windowRef?: Window;
  noticeId?: string;
}

export class NativeNoticeHostController {
  private readonly rootHost: () => HTMLElement | null;
  private readonly outlet: () => HTMLElement | null;
  private readonly documentRef: Document;
  private readonly windowRef: Window;
  private readonly noticeId: string;
  private host: HTMLElement | null = null;
  private root: ShadowRoot | null = null;
  private styleSyncFrame: number | undefined;
  private styleSyncTimers: number[] = [];
  private styleSyncGeneration = 0;
  private themeObserver: MutationObserver | undefined;

  constructor(options: NativeNoticeHostControllerOptions) {
    this.rootHost = options.rootHost;
    this.outlet = options.outlet;
    this.documentRef = options.documentRef ?? document;
    this.windowRef = options.windowRef ?? window;
    this.noticeId = options.noticeId ?? NATIVE_NOTICE_ID;
  }

  hostElement(): HTMLElement | null {
    return this.host;
  }

  ensureRoot(): ShadowRoot | null {
    if (this.windowRef.innerWidth <= 760) {
      this.removeRoot();
      return null;
    }

    const target = this.nativeNoticeTarget();
    if (!target) {
      this.removeRoot();
      return null;
    }

    const existing = this.documentRef.getElementById(this.noticeId) as HTMLElement | null;
    this.host = existing || this.host || this.documentRef.createElement("span");
    this.host.id = this.noticeId;
    this.host.setAttribute("aria-label", "Linux.do 阅读器顶栏控制");
    this.host.style.display = "inline-flex";
    this.host.style.alignItems = "center";
    this.host.style.alignSelf = "center";
    this.host.style.flex = "0 0 auto";
    this.host.style.height = "auto";
    this.host.style.maxHeight = `${NATIVE_CONTROL_MAX_HEIGHT}px`;
    this.host.style.minHeight = "0";
    this.host.style.position = "relative";
    this.host.style.zIndex = "2";

    if (this.host.parentElement !== target.container || this.host.nextSibling !== target.before) {
      target.container.insertBefore(this.host, target.before);
    }
    this.syncNativeNoticeChrome(target.container, this.host);

    this.root = this.host.shadowRoot || this.host.attachShadow({ mode: "open" });
    return this.root;
  }

  removeRoot(): void {
    this.host?.remove();
    this.host = null;
    this.root = null;
  }

  startThemeSyncObserver(): void {
    if (this.themeObserver) {
      return;
    }

    this.themeObserver = new MutationObserver(() => this.scheduleStyleSync());
    const themeAttributes = [
      "class",
      "style",
      "data-theme",
      "data-theme-id",
      "data-theme-name",
      "data-color-scheme",
      "color-scheme"
    ];

    this.themeObserver.observe(this.documentRef.documentElement, {
      attributes: true,
      attributeFilter: themeAttributes
    });

    if (this.documentRef.body) {
      this.themeObserver.observe(this.documentRef.body, {
        attributes: true,
        attributeFilter: themeAttributes
      });
    }

    if (this.documentRef.head) {
      this.themeObserver.observe(this.documentRef.head, {
        attributes: true,
        attributeFilter: ["href", "media", "disabled"],
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    this.windowRef.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => this.scheduleStyleSync());
    this.documentRef.addEventListener("click", (event) => this.handlePotentialNativeStyleChangeInteraction(event), true);
    this.documentRef.addEventListener("keyup", (event) => this.handlePotentialNativeStyleChangeInteraction(event), true);
    this.documentRef.addEventListener("transitionend", (event) => this.handleNativeStyleTransition(event), true);
    this.documentRef.addEventListener("animationend", (event) => this.handleNativeStyleTransition(event), true);
  }

  scheduleStyleSync(): void {
    this.styleSyncGeneration += 1;
    const generation = this.styleSyncGeneration;

    if (this.styleSyncFrame !== undefined) {
      this.windowRef.cancelAnimationFrame(this.styleSyncFrame);
    }

    this.styleSyncFrame = this.windowRef.requestAnimationFrame(() => {
      this.styleSyncFrame = undefined;
      this.syncCurrentChrome();
    });

    this.styleSyncTimers.forEach((timer) => this.windowRef.clearTimeout(timer));
    this.styleSyncTimers = [80, 180, 360, 720].map((delay) =>
      this.windowRef.setTimeout(() => {
        if (generation === this.styleSyncGeneration) {
          this.syncCurrentChrome();
        }
      }, delay)
    );
  }

  syncCurrentChrome(): void {
    if (this.host?.isConnected && this.host.parentElement) {
      this.syncNativeNoticeChrome(this.host.parentElement, this.host);
    }
  }

  measureTopObstructionBottom(): number {
    const selectors = [
      ".d-header",
      ".d-header-wrap",
      ".navigation-container",
      ".list-controls",
      ".category-breadcrumb",
      ".nav-pills",
      ".top-lists",
      "#navigation-bar",
      "[data-sticky]",
      "[style*='position: sticky']",
      "[style*='position: fixed']"
    ];
    const candidates = new Set<HTMLElement>();

    for (const selector of selectors) {
      this.documentRef.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        candidates.add(element);
      });
    }

    let bottom = 0;
    candidates.forEach((element) => {
      const rootHost = this.rootHost();
      if (element === rootHost || rootHost?.contains(element)) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const style = this.windowRef.getComputedStyle(element);
      const isPinned = style.position === "fixed" || style.position === "sticky" || rect.top <= 2;
      if (
        !isPinned ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        rect.width < Math.min(this.windowRef.innerWidth * 0.25, 240) ||
        rect.height < 8 ||
        rect.top > PINNED_OBSTRUCTION_MAX_TOP ||
        rect.bottom <= 0 ||
        rect.bottom > Math.min(this.windowRef.innerHeight * 0.4, 180)
      ) {
        return;
      }

      bottom = Math.max(bottom, rect.bottom);
    });

    return bottom;
  }

  measureLeftObstructionRight(): number {
    if (this.windowRef.innerWidth <= 760) {
      return 0;
    }

    const selectors = [
      ".sidebar-wrapper",
      "#d-sidebar",
      ".sidebar-container",
      ".sidebar-footer-wrapper",
      ".hamburger-panel"
    ];
    const maxRight = Math.min(this.windowRef.innerWidth * 0.42, 420);
    let right = 0;

    selectors.forEach((selector) => {
      this.documentRef.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        const rootHost = this.rootHost();
        if (element === rootHost || rootHost?.contains(element)) {
          return;
        }

        const style = this.windowRef.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          rect.width < 48 ||
          rect.height < 80 ||
          rect.left > 80 ||
          rect.right <= 80 ||
          rect.right > maxRight ||
          rect.bottom <= 0 ||
          rect.top >= this.windowRef.innerHeight
        ) {
          return;
        }

        right = Math.max(right, rect.right);
      });
    });

    return right;
  }

  updateDockPosition(topObstructionBottom: number): void {
    const rootHost = this.rootHost();
    if (!rootHost) {
      return;
    }

    const dock = this.measureDockPosition(topObstructionBottom);
    if (!dock) {
      rootHost.style.removeProperty("--ldcv-notice-left");
      rootHost.style.removeProperty("--ldcv-notice-right");
      rootHost.style.removeProperty("--ldcv-notice-top");
      rootHost.style.removeProperty("--ldcv-notice-width");
      return;
    }

    rootHost.style.setProperty("--ldcv-notice-left", `${Math.round(dock.left)}px`);
    rootHost.style.setProperty("--ldcv-notice-right", "auto");
    rootHost.style.setProperty("--ldcv-notice-top", `${Math.round(dock.top)}px`);
    rootHost.style.setProperty("--ldcv-notice-width", `${Math.round(dock.width)}px`);
  }

  private handlePotentialNativeStyleChangeInteraction(event: Event): void {
    const target = event.target;
    const rootHost = this.rootHost();
    if (!(target instanceof HTMLElement) || rootHost?.contains(target)) {
      return;
    }

    if (target.closest(".interface-color-selector, .user-color-palette-selector, .fk-d-menu, .select-kit, .sidebar-footer-actions")) {
      this.scheduleStyleSync();
      return;
    }

    const label = `${target.getAttribute("aria-label") || ""} ${target.getAttribute("title") || ""} ${target.textContent || ""}`;
    if (/颜色模式|主题|配色|dark|light|浅色|深色/i.test(label)) {
      this.scheduleStyleSync();
    }
  }

  private handleNativeStyleTransition(event: Event): void {
    const target = event.target;
    const rootHost = this.rootHost();
    if (!(target instanceof HTMLElement) || rootHost?.contains(target)) {
      return;
    }

    if (target.closest(".category-breadcrumb, .select-kit, .combo-box, .list-controls, .navigation-container")) {
      this.scheduleStyleSync();
    }
  }

  private measureDockPosition(topObstructionBottom: number): NoticeDockPosition | null {
    if (this.windowRef.innerWidth <= 1180) {
      return null;
    }

    const navigation = this.firstVisibleElement(["#navigation-bar", ".nav-pills", ".top-lists"]);
    const row =
      this.closestVisibleElement(navigation, [".navigation-container", ".list-controls"]) ||
      this.firstVisibleElement([".list-controls .navigation-container", ".navigation-container", ".list-controls"]);

    const rowRect = this.visibleRect(row);
    if (!rowRect || rowRect.width < 720 || rowRect.height < 42 || rowRect.top < 0 || rowRect.top > this.windowRef.innerHeight * 0.35) {
      return null;
    }

    const navigationRect = this.visibleRect(navigation);
    const rightControlsRect = this.firstVisibleRect([
      ".list-controls .category-breadcrumb",
      ".navigation-container .category-breadcrumb",
      ".category-breadcrumb"
    ]);

    const slotPadding = 24;
    const minimumWidth = 340;
    const maximumWidth = Math.min(640, this.windowRef.innerWidth - 48);
    const slotLeft = navigationRect && intersectsVertically(rowRect, navigationRect)
      ? navigationRect.right + slotPadding
      : rowRect.left + rowRect.width * 0.48;
    const slotRight = rightControlsRect && intersectsVertically(rowRect, rightControlsRect)
      ? rightControlsRect.left - slotPadding
      : rowRect.right - slotPadding;
    const available = slotRight - slotLeft;

    if (available < minimumWidth) {
      return null;
    }

    const width = Math.min(maximumWidth, available);
    const left = slotRight - width;
    const top = Math.max(rowRect.top + Math.max(8, (rowRect.height - 52) / 2), topObstructionBottom + 8);

    return { left, top, width };
  }

  private firstVisibleElement(selectors: string[]): HTMLElement | null {
    for (const selector of selectors) {
      for (const element of Array.from(this.documentRef.querySelectorAll<HTMLElement>(selector))) {
        if (this.visibleRect(element)) {
          return element;
        }
      }
    }
    return null;
  }

  private firstVisibleRect(selectors: string[]): DOMRect | null {
    const element = this.firstVisibleElement(selectors);
    return this.visibleRect(element);
  }

  private closestVisibleElement(element: HTMLElement | null, selectors: string[]): HTMLElement | null {
    if (!element) {
      return null;
    }

    for (const selector of selectors) {
      const closest = element.closest<HTMLElement>(selector);
      if (this.visibleRect(closest)) {
        return closest;
      }
    }
    return null;
  }

  private visibleRect(element: HTMLElement | null): DOMRect | null {
    const rootHost = this.rootHost();
    if (!element || element === rootHost || rootHost?.contains(element)) {
      return null;
    }

    const style = this.windowRef.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.bottom <= 0 ||
      rect.right <= 0 ||
      rect.left >= this.windowRef.innerWidth
    ) {
      return null;
    }
    return rect;
  }

  private nativeNoticeTarget(): NativeNoticeTarget | null {
    const outlet = this.outlet();
    const controlRows = this.visibleElements([".list-controls", ".navigation-container", ".list-controls .navigation-container"]).filter(
      (row) => !outlet || outlet.contains(row)
    );

    for (const row of controlRows) {
      const categoryBreadcrumb = this.firstVisibleDescendant(row, [".category-breadcrumb"]);
      if (categoryBreadcrumb) {
        return {
          container: categoryBreadcrumb,
          before: this.firstNonNativeNoticeChild(categoryBreadcrumb)
        };
      }
    }

    for (const row of controlRows) {
      const navigation = this.firstVisibleDescendant(row, ["#navigation-bar", ".nav-pills", ".top-lists"]);
      if (navigation?.parentElement) {
        const afterNavigation = navigation.nextSibling;
        const before = afterNavigation && this.host && afterNavigation === this.host ? this.host.nextSibling : afterNavigation;
        return {
          container: navigation.parentElement,
          before
        };
      }
    }

    return controlRows[0]
      ? {
          container: controlRows[0],
          before: null
        }
      : null;
  }

  private firstNonNativeNoticeChild(container: HTMLElement): ChildNode | null {
    return Array.from(container.childNodes).find((node) => node !== this.host) || null;
  }

  private visibleElements(selectors: string[]): HTMLElement[] {
    const result: HTMLElement[] = [];
    for (const selector of selectors) {
      for (const element of Array.from(this.documentRef.querySelectorAll<HTMLElement>(selector))) {
        if (this.visibleRect(element) && !result.includes(element)) {
          result.push(element);
        }
      }
    }
    return result;
  }

  private firstVisibleDescendant(container: HTMLElement, selectors: string[]): HTMLElement | null {
    for (const selector of selectors) {
      if (container.matches(selector) && this.visibleRect(container)) {
        return container;
      }
      for (const element of Array.from(container.querySelectorAll<HTMLElement>(selector))) {
        if (this.visibleRect(element)) {
          return element;
        }
      }
    }
    return null;
  }

  private syncNativeNoticeChrome(container: HTMLElement, host: HTMLElement): void {
    const nativeControls = Array.from(container.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child !== host);
    const firstControl = nativeControls.find((child) => this.visibleRect(child));
    const secondControl = nativeControls.find((child) => child !== firstControl && this.visibleRect(child));
    const styleSource = this.firstVisibleDescendant(firstControl ?? container, ["summary", "button", "a", ".btn"]) ?? firstControl;

    if (styleSource) {
      const nativeStyle = this.windowRef.getComputedStyle(styleSource);
      const sourceRect = styleSource.getBoundingClientRect();
      host.style.setProperty(
        "--ldcv-native-notice-background",
        themeTokenReference(
          nativeStyle.backgroundColor,
          NATIVE_NOTICE_BACKGROUND_TOKENS,
          host.style.getPropertyValue("--ldcv-native-notice-background"),
          this.documentRef,
          this.windowRef
        )
      );
      host.style.setProperty("--ldcv-native-notice-box-shadow", nativeStyle.boxShadow);
      host.style.setProperty("--ldcv-native-notice-font-family", nativeStyle.fontFamily);
      host.style.setProperty("--ldcv-native-notice-font-size", nativeStyle.fontSize);
      host.style.setProperty("--ldcv-native-notice-font-weight", nativeStyle.fontWeight);
      host.style.setProperty("--ldcv-native-notice-letter-spacing", nativeStyle.letterSpacing);
      host.style.setProperty("--ldcv-native-notice-line-height", nativeStyle.lineHeight);
      host.style.setProperty("--ldcv-native-notice-radius", nativeStyle.borderRadius);
      host.style.setProperty("--ldcv-native-notice-transition", nativeStyle.transition || "none");
      host.style.setProperty("--ldcv-native-notice-height", `${clampCssPixel(sourceRect.height, NATIVE_CONTROL_MIN_HEIGHT, NATIVE_CONTROL_MAX_HEIGHT)}px`);
      host.style.setProperty("--ldcv-native-notice-min-width", `${clampCssPixel(sourceRect.width, NATIVE_CONTROL_MIN_WIDTH, NATIVE_CONTROL_MAX_WIDTH)}px`);
      host.style.setProperty("--ldcv-native-notice-padding-y", nativeStyle.paddingTop || "8px");
      host.style.setProperty("--ldcv-native-notice-padding-x", nativeStyle.paddingLeft || "14px");
      host.style.setProperty(
        "--ldcv-native-notice-border-color",
        themeTokenReference(
          nativeStyle.borderColor,
          NATIVE_NOTICE_BORDER_TOKENS,
          host.style.getPropertyValue("--ldcv-native-notice-border-color"),
          this.documentRef,
          this.windowRef
        )
      );
      host.style.setProperty(
        "--ldcv-native-notice-color",
        themeTokenReference(
          nativeStyle.color,
          NATIVE_NOTICE_COLOR_TOKENS,
          host.style.getPropertyValue("--ldcv-native-notice-color"),
          this.documentRef,
          this.windowRef
        )
      );
    }

    const containerStyle = this.windowRef.getComputedStyle(container);
    const flexGap = parseFloat(containerStyle.columnGap || containerStyle.gap || "0");
    if (Number.isFinite(flexGap) && flexGap > 0) {
      host.style.marginInlineEnd = "0";
      return;
    }

    const firstRect = firstControl?.getBoundingClientRect();
    const secondRect = secondControl?.getBoundingClientRect();
    const measuredGap = firstRect && secondRect ? Math.round(secondRect.left - firstRect.right) : 0;
    const firstMarginLeft = firstControl ? parseFloat(this.windowRef.getComputedStyle(firstControl).marginLeft || "0") : 0;
    const targetGap = Math.max(8, Math.min(18, measuredGap || 12));
    host.style.marginInlineEnd = `${Math.max(0, Math.round(targetGap - (Number.isFinite(firstMarginLeft) ? firstMarginLeft : 0)))}px`;
  }
}

export function themeTokenReference(
  value: string,
  candidates: string[],
  currentValue = "",
  documentRef: Document = document,
  windowRef: Window = window
): string {
  const normalizedValue = normalizedCssColor(value);
  if (!normalizedValue) {
    return value;
  }

  const rootStyle = windowRef.getComputedStyle(documentRef.documentElement);
  for (const token of candidates) {
    const tokenValue = rootStyle.getPropertyValue(token).trim();
    if (normalizedCssColor(tokenValue) === normalizedValue) {
      return `var(${token}, ${value})`;
    }
  }
  if (currentValue.trim().startsWith("var(")) {
    return currentValue;
  }
  return value;
}

export function normalizedCssColor(value: string): string {
  const color = value.trim().toLowerCase();
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split("").map((part) => part + part).join("") : hex[1];
    const red = parseInt(raw.slice(0, 2), 16);
    const green = parseInt(raw.slice(2, 4), 16);
    const blue = parseInt(raw.slice(4, 6), 16);
    return `rgb(${red},${green},${blue})`;
  }

  const rgb = color.match(/^rgba?\((.+)\)$/);
  if (!rgb) {
    return "";
  }

  const parts = rgb[1]
    .split(/[,/ ]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const [red, green, blue] = parts.slice(0, 3).map((part) => Math.round(Number.parseFloat(part)));
  if (![red, green, blue].every(Number.isFinite)) {
    return "";
  }

  const alpha = parts[3] === undefined ? 1 : Number.parseFloat(parts[3]);
  return Number.isFinite(alpha) && alpha < 1
    ? `rgba(${red},${green},${blue},${Number(alpha.toFixed(3))})`
    : `rgb(${red},${green},${blue})`;
}

function intersectsVertically(a: DOMRect, b: DOMRect): boolean {
  return Math.max(a.top, b.top) < Math.min(a.bottom, b.bottom);
}

function clampCssPixel(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.round(Math.min(Math.max(value, min), max));
}
