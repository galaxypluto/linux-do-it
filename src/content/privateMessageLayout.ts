import { PRIVATE_MESSAGE_HOST_CLASS, PRIVATE_MESSAGE_LAYOUT_CLASS } from "./pageStyle";

export const PRIVATE_MESSAGE_LAYOUT_GRACE_MS = 6000;

export interface PrivateMessageLayoutControllerOptions {
  rootHost: () => HTMLElement | null;
  readerSurface: () => HTMLElement | null | undefined;
  canDock: () => boolean;
  shouldUseReaderGeometry?: () => boolean;
  onDeactivate?: () => void;
  documentRef?: Document;
  windowRef?: Window;
  graceMs?: number;
}

export class PrivateMessageLayoutController {
  private readonly rootHost: () => HTMLElement | null;
  private readonly readerSurface: () => HTMLElement | null | undefined;
  private readonly canDock: () => boolean;
  private readonly shouldUseReaderGeometry: () => boolean;
  private readonly onDeactivate: () => void;
  private readonly documentRef: Document;
  private readonly windowRef: Window;
  private readonly graceMs: number;
  private observer: MutationObserver | undefined;
  private frame: number | undefined;
  private timers: number[] = [];
  private requestedAt = 0;
  private hasSeenNativeComposer = false;

  constructor(options: PrivateMessageLayoutControllerOptions) {
    this.rootHost = options.rootHost;
    this.readerSurface = options.readerSurface;
    this.canDock = options.canDock;
    this.shouldUseReaderGeometry = options.shouldUseReaderGeometry ?? (() => true);
    this.onDeactivate = options.onDeactivate ?? (() => {});
    this.documentRef = options.documentRef ?? document;
    this.windowRef = options.windowRef ?? window;
    this.graceMs = options.graceMs ?? PRIVATE_MESSAGE_LAYOUT_GRACE_MS;
  }

  activate(): void {
    this.requestedAt = Date.now();
    this.hasSeenNativeComposer = false;
    this.documentRef.documentElement.classList.add(PRIVATE_MESSAGE_LAYOUT_CLASS);
    this.rootHost()?.classList.add(PRIVATE_MESSAGE_HOST_CLASS);
    this.startObserver();
    this.scheduleSync();
    this.scheduleChecks();
  }

  deactivate(): void {
    const wasActive = this.isActive();
    this.documentRef.documentElement.classList.remove(PRIVATE_MESSAGE_LAYOUT_CLASS);
    this.rootHost()?.classList.remove(PRIVATE_MESSAGE_HOST_CLASS);
    this.clearGeometry();
    this.requestedAt = 0;
    this.observer?.disconnect();
    this.observer = undefined;
    if (this.frame !== undefined) {
      this.windowRef.cancelAnimationFrame(this.frame);
      this.frame = undefined;
    }
    this.timers.forEach((timer) => this.windowRef.clearTimeout(timer));
    this.timers = [];
    this.hasSeenNativeComposer = false;
    if (wasActive) {
      this.onDeactivate();
    }
  }

  isActive(): boolean {
    return this.documentRef.documentElement.classList.contains(PRIVATE_MESSAGE_LAYOUT_CLASS);
  }

  resetGraceWindow(): void {
    this.requestedAt = 0;
    this.hasSeenNativeComposer = true;
  }

  scheduleChecks(): void {
    this.timers.forEach((timer) => this.windowRef.clearTimeout(timer));
    const checks = Array.from(new Set([120, 320, 800, 1600, 2600, 4200, this.graceMs + 120])).sort(
      (first, second) => first - second
    );
    this.timers = checks.map((delay) =>
      this.windowRef.setTimeout(() => this.scheduleSync(), delay)
    );
  }

  scheduleSync(): void {
    if (this.frame !== undefined) {
      this.windowRef.cancelAnimationFrame(this.frame);
    }
    this.frame = this.windowRef.requestAnimationFrame(() => this.sync());
  }

  nativeComposerVisible(): boolean {
    return Boolean(this.visibleNativeComposerRect());
  }

  private visibleNativeComposerRect(): DOMRect | null {
    const selectors = [
      "#reply-control.open",
      "#reply-control.composer-open",
      "#reply-control:not(.closed)",
      ".composer-popup",
      ".d-editor"
    ];

    for (const selector of selectors) {
      const visibleRect = Array.from(this.documentRef.querySelectorAll<HTMLElement>(selector)).find((element) => {
        if (this.rootHost()?.contains(element)) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        const style = this.windowRef.getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 160 &&
          rect.height > 80 &&
          rect.bottom > 0 &&
          rect.right > 0
        );
      })?.getBoundingClientRect();
      if (visibleRect) {
        return visibleRect;
      }
    }

    return null;
  }

  private startObserver(): void {
    if (this.observer || !this.documentRef.body) {
      return;
    }

    this.observer = new MutationObserver(() => this.scheduleSync());
    this.observer.observe(this.documentRef.body, {
      attributes: true,
      attributeFilter: ["class", "style", "aria-hidden"],
      childList: true,
      subtree: true
    });
  }

  private sync(): void {
    this.frame = undefined;
    if (!this.isActive()) {
      return;
    }

    if (!this.canDock()) {
      this.deactivate();
      return;
    }

    const composerVisible = this.nativeComposerVisible();
    if (composerVisible) {
      this.hasSeenNativeComposer = true;
    }

    if (composerVisible || (!this.hasSeenNativeComposer && Date.now() - this.requestedAt < this.graceMs)) {
      if (!this.syncGeometry()) {
        this.deactivate();
        return;
      }
      this.rootHost()?.classList.add(PRIVATE_MESSAGE_HOST_CLASS);
      return;
    }

    this.deactivate();
  }

  private syncGeometry(): boolean {
    if (!this.shouldUseReaderGeometry() || this.windowRef.innerWidth <= 1180) {
      this.clearGeometry();
      return true;
    }

    const rect = this.readerSurface()?.getBoundingClientRect();
    if (!rect || rect.width < 320 || rect.height < 320 || rect.left <= 0 || rect.top < 0) {
      this.clearGeometry();
      return false;
    }

    const gap = 18;
    const pagePadding = 18;
    const availableLeft = rect.left - gap - pagePadding;
    const minimumWidth = 360;
    if (availableLeft < minimumWidth) {
      this.clearGeometry();
      return false;
    }

    const width = Math.min(640, availableLeft);
    const left = Math.max(pagePadding, rect.left - gap - width);
    const desiredReserve = left + width + gap;
    const composerRect = this.visibleNativeComposerRect();
    const measuredReserve = composerRect ? composerRect.right + gap : desiredReserve;
    const minimumReaderWidth = 320;
    const rootRect = this.rootHost()?.getBoundingClientRect();
    const readerRight = Math.min(
      this.windowRef.innerWidth - pagePadding,
      rootRect && rootRect.right > rootRect.left ? rootRect.right : this.windowRef.innerWidth - pagePadding
    );
    const maxReserve = Math.max(pagePadding, readerRight - gap - minimumReaderWidth);
    const leftReserve = Math.min(Math.max(desiredReserve, measuredReserve), maxReserve);
    const localReserve = rootRect && rootRect.right > rootRect.left ? Math.max(0, leftReserve - rootRect.left) : leftReserve;
    this.setGeometryVariable("--ldcv-private-message-left", `${Math.round(left)}px`);
    this.setGeometryVariable("--ldcv-private-message-left-reserve", `${Math.round(leftReserve)}px`);
    this.setGeometryVariable("--ldcv-private-message-local-reserve", `${Math.round(localReserve)}px`);
    this.setGeometryVariable("--ldcv-private-message-top", `${Math.round(rect.top)}px`);
    this.setGeometryVariable("--ldcv-private-message-height", `${Math.round(rect.height)}px`);
    this.setGeometryVariable("--ldcv-private-message-width", `${Math.round(width)}px`);
    return true;
  }

  private clearGeometry(): void {
    [
      "--ldcv-private-message-left",
      "--ldcv-private-message-left-reserve",
      "--ldcv-private-message-local-reserve",
      "--ldcv-private-message-top",
      "--ldcv-private-message-height",
      "--ldcv-private-message-width"
    ].forEach((name) => this.removeGeometryVariable(name));
  }

  private setGeometryVariable(name: string, value: string): void {
    this.documentRef.documentElement.style.setProperty(name, value);
    this.rootHost()?.style.setProperty(name, value);
  }

  private removeGeometryVariable(name: string): void {
    this.documentRef.documentElement.style.removeProperty(name);
    this.rootHost()?.style.removeProperty(name);
  }
}
