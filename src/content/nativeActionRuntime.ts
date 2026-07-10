import type { ReplyActivity } from "../shared/replyActivity";
import type { ReaderPostActionFeedback, ReaderPostAction, NativeComposerAction, ReaderState } from "../ui/readerTypes";
import type { NativePostActionResult } from "./privateMessageBridge";
import {
  shouldAutoDismissNativePostActionFeedback,
  shouldClearComposerOpenedFeedback,
} from "./nativePostActionFeedback";
import {
  nativeReplyReturnUrl,
  shouldRestoreNativeReplyRoute,
  type NativeReplyRouteGuard,
} from "./nativeReplyRouteRestore";

const NATIVE_WRITE_RETRY_COOLDOWN_MS = 60_000;
const NATIVE_ACTION_SUCCESS_FEEDBACK_MS = 2400;
const NATIVE_REPLY_ROUTE_GUARD_MS = 120_000;
const NATIVE_REPLY_ROUTE_RESTORE_MS = 45_000;
const NATIVE_REPLY_ROUTE_RETRY_MS = 500;
const NATIVE_REPLY_ROUTE_RESTORE_ATTEMPTS = 8;

type NativeActionRuntimeDeps = {
  getReaderState: () => ReaderState;
  setReaderState: (updater: (state: ReaderState) => ReaderState) => void;
  renderCurrent: () => void;
  ensureRoot: () => void;
  syncNativeReplyRootPreserveClass: () => void;
  captureNativeReplyRootFrame: () => void;
  requestNativeRouteRestore: (returnUrl: string) => void;
};

export class NativeActionRuntime {
  private readonly nativeWriteRetryAfter = new Map<string, number>();
  private nativePostActionFeedbackTimer: number | undefined;
  private nativeReplyRouteGuard: NativeReplyRouteGuard | null = null;
  private nativeReplyRouteRestoreTimer: number | undefined;
  private nativeReplyRouteRestoreAttempts = 0;

  constructor(private readonly deps: NativeActionRuntimeDeps) {}

  get routeGuard(): NativeReplyRouteGuard | null {
    return this.nativeReplyRouteGuard;
  }

  reset(): void {
    this.clearNativePostActionFeedbackTimer();
    window.clearTimeout(this.nativeReplyRouteRestoreTimer);
    this.nativeReplyRouteRestoreTimer = undefined;
    this.nativeReplyRouteGuard = null;
    this.nativeReplyRouteRestoreAttempts = 0;
  }

  armNativeReplyRouteGuard(topicId: number): void {
    if (!Number.isFinite(topicId)) {
      return;
    }

    this.deps.captureNativeReplyRootFrame();
    const now = Date.now();
    this.nativeReplyRouteGuard = {
      topicId,
      returnUrl: nativeReplyReturnUrl(window.location),
      expiresAt: now + NATIVE_REPLY_ROUTE_GUARD_MS,
      restoreUntil: 0,
      submitted: false,
    };
    this.nativeReplyRouteRestoreAttempts = 0;
    window.clearTimeout(this.nativeReplyRouteRestoreTimer);
    this.nativeReplyRouteRestoreTimer = undefined;
    this.deps.syncNativeReplyRootPreserveClass();
    this.deps.ensureRoot();
  }

  markNativeReplySubmittedForRouteRestore(topicId: number): void {
    if (!Number.isFinite(topicId)) {
      return;
    }

    this.deps.captureNativeReplyRootFrame();
    const now = Date.now();
    if (!this.nativeReplyRouteGuard || this.nativeReplyRouteGuard.topicId !== topicId) {
      this.nativeReplyRouteGuard = {
        topicId,
        returnUrl: nativeReplyReturnUrl(window.location),
        expiresAt: now + NATIVE_REPLY_ROUTE_GUARD_MS,
        restoreUntil: 0,
        submitted: false,
      };
      this.nativeReplyRouteRestoreAttempts = 0;
    }

    this.nativeReplyRouteGuard = {
      ...this.nativeReplyRouteGuard,
      submitted: true,
      restoreUntil: now + NATIVE_REPLY_ROUTE_RESTORE_MS,
    };
    this.nativeReplyRouteRestoreAttempts = 0;
    this.deps.syncNativeReplyRootPreserveClass();
    this.deps.ensureRoot();
    this.requestNativeReplyRouterRestore();
    this.scheduleNativeReplyRouteRestore();
  }

  restoreNativeReplyListRouteIfNeeded(): boolean {
    const guard = shouldRestoreNativeReplyRoute(this.nativeReplyRouteGuard, window.location.pathname, Date.now())
      ? this.nativeReplyRouteGuard
      : null;
    if (!guard) {
      return false;
    }

    this.deps.ensureRoot();
    this.requestNativeReplyRouterRestore();
    this.scheduleNativeReplyRouteRestore();
    return true;
  }

  setNativePostActionFeedback(
    action: NativeComposerAction,
    postNumber: number,
    status: "success" | "unsupported" | "error" | "timeout",
    message: string,
  ): void {
    this.deps.setReaderState((state) => ({
      ...state,
      nativePostAction: {
        requestId: createLocalRequestId(),
        action,
        postNumber,
        status,
        message,
      },
    }));
    const feedback = this.deps.getReaderState().nativePostAction;
    this.scheduleNativePostActionFeedbackDismiss(feedback);
    this.deps.renderCurrent();
  }

  scheduleNativePostActionFeedbackDismiss(feedback: ReaderState["nativePostAction"]): void {
    this.clearNativePostActionFeedbackTimer();
    if (!feedback || !shouldAutoDismissNativePostActionFeedback(feedback)) {
      return;
    }

    this.nativePostActionFeedbackTimer = window.setTimeout(() => {
      this.nativePostActionFeedbackTimer = undefined;
      if (this.deps.getReaderState().nativePostAction?.requestId !== feedback.requestId) {
        return;
      }
      this.deps.setReaderState((state) => ({
        ...state,
        nativePostAction: null,
      }));
      this.deps.renderCurrent();
    }, NATIVE_ACTION_SUCCESS_FEEDBACK_MS);
  }

  clearNativePostActionFeedbackTimer(): void {
    if (this.nativePostActionFeedbackTimer === undefined) {
      return;
    }
    window.clearTimeout(this.nativePostActionFeedbackTimer);
    this.nativePostActionFeedbackTimer = undefined;
  }

  clearComposerOpenedFeedback(enabled: boolean): void {
    const feedback = this.deps.getReaderState().nativePostAction;
    if (!shouldClearComposerOpenedFeedback(feedback)) {
      return;
    }

    this.clearNativePostActionFeedbackTimer();
    this.deps.setReaderState((state) => ({
      ...state,
      nativePostAction: null,
    }));
    if (enabled) {
      this.deps.renderCurrent();
    }
  }

  nativeWriteCooldownMessage(action: ReaderPostAction, postId: number): string {
    if (action !== "like" && action !== "bookmark") {
      return "";
    }
    const retryAt = this.nativeWriteRetryAfter.get(nativeWriteCooldownKey(action, postId)) || 0;
    if (retryAt <= Date.now()) {
      this.nativeWriteRetryAfter.delete(nativeWriteCooldownKey(action, postId));
      return "";
    }
    const seconds = Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
    return `操作刚刚失败，为避免触发站点限制，请 ${seconds} 秒后再试。`;
  }

  updateNativeWriteCooldown(
    action: ReaderPostAction,
    postId: number,
    ok: boolean,
    status: NativePostActionResult["status"],
  ): void {
    if (action !== "like" && action !== "bookmark") {
      return;
    }
    const key = nativeWriteCooldownKey(action, postId);
    if (ok || status === "unsupported") {
      this.nativeWriteRetryAfter.delete(key);
      return;
    }
    this.nativeWriteRetryAfter.set(key, Date.now() + NATIVE_WRITE_RETRY_COOLDOWN_MS);
  }

  private requestNativeReplyRouterRestore(): boolean {
    const guard = this.nativeReplyRouteGuard;
    if (!guard || this.nativeReplyRouteRestoreAttempts >= NATIVE_REPLY_ROUTE_RESTORE_ATTEMPTS) {
      return false;
    }
    if (!this.shouldRequestNativeReplyRouterRestore(guard)) {
      return false;
    }

    this.nativeReplyRouteRestoreAttempts += 1;
    this.deps.requestNativeRouteRestore(guard.returnUrl);
    return true;
  }

  private shouldRequestNativeReplyRouterRestore(guard: NativeReplyRouteGuard): boolean {
    const now = Date.now();
    if (now > Math.max(guard.expiresAt, guard.restoreUntil)) {
      return false;
    }

    const currentUrl = nativeReplyReturnUrl(window.location);
    return currentUrl === guard.returnUrl || shouldRestoreNativeReplyRoute(guard, window.location.pathname, now);
  }

  private scheduleNativeReplyRouteRestore(): void {
    window.clearTimeout(this.nativeReplyRouteRestoreTimer);
    const guard = this.nativeReplyRouteGuard;
    if (
      !guard ||
      Date.now() > guard.restoreUntil ||
      this.nativeReplyRouteRestoreAttempts >= NATIVE_REPLY_ROUTE_RESTORE_ATTEMPTS
    ) {
      this.nativeReplyRouteRestoreTimer = undefined;
      return;
    }

    this.nativeReplyRouteRestoreTimer = window.setTimeout(() => {
      this.nativeReplyRouteRestoreTimer = undefined;
      if (!this.nativeReplyRouteGuard) {
        return;
      }

      const currentGuard = this.nativeReplyRouteGuard;
      if (shouldRestoreNativeReplyRoute(currentGuard, window.location.pathname, Date.now())) {
        this.restoreNativeReplyListRouteIfNeeded();
        return;
      }

      if (!this.requestNativeReplyRouterRestore()) {
        return;
      }
      this.scheduleNativeReplyRouteRestore();
    }, NATIVE_REPLY_ROUTE_RETRY_MS);
  }
}

export function nativeReplyActivityId(topicId: number, submittedPostNumber: number | null, submittedUrl: string | undefined): string {
  if (submittedPostNumber) {
    return `reply:${topicId}:${submittedPostNumber}`;
  }
  if (submittedUrl) {
    return `reply:${topicId}:${submittedUrl}`;
  }
  return `reply:${topicId}:${createLocalRequestId()}`;
}

export function positiveNumberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
}

export function absoluteLinuxDoUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return undefined;
  }
}

export function readerPostActionLabel(action: NativeComposerAction): string {
  if (action === "reply") {
    return "回复";
  }
  if (action === "private-message") {
    return "私信";
  }
  if (action === "like") {
    return "点赞";
  }
  if (action === "flag") {
    return "举报窗口";
  }
  return "书签";
}

export function readerPostActionFallbackMessage(action: NativeComposerAction): string {
  return `${readerPostActionLabel(action)}失败，请在原贴中重试。`;
}

export function nativeResultStatusForReader(status: string): "unsupported" | "error" | "timeout" {
  if (status === "unsupported" || status === "timeout") {
    return status;
  }
  return "error";
}

export function createLocalRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createReplyActivity(
  reader: ReaderState["data"],
  topicId: number | null,
  id: string,
  status: ReplyActivity["status"],
  message: string,
  {
    submittedPostNumber,
    submittedUrl,
    targetPostNumber,
  }: {
    submittedPostNumber: number | null;
    submittedUrl?: string;
    targetPostNumber: number | null;
  },
): ReplyActivity | null {
  const topicUrl = absoluteLinuxDoUrl(reader?.url || submittedUrl || window.location.href) || window.location.href;
  const activity: ReplyActivity = {
    id,
    topicId: reader?.id || topicId || 0,
    topicTitle: reader?.title || "Linux.do 回复",
    topicUrl,
    targetPostNumber,
    submittedPostNumber,
    ...(submittedUrl ? { submittedUrl } : {}),
    status,
    message,
    createdAt: new Date().toISOString(),
  };
  return activity.topicId > 0 ? activity : null;
}

function nativeWriteCooldownKey(action: ReaderPostAction, postId: number): string {
  return `${action}:${postId}`;
}
