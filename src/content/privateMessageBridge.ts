export const PAGE_BRIDGE_ID = "linuxdo-card-view-page-bridge";
export const PRIVATE_MESSAGE_EVENT = "linuxdo-card-view:private-message";
export const PRIVATE_MESSAGE_RESULT_EVENT = "linuxdo-card-view:private-message-result";
export const PRIVATE_MESSAGE_CLOSE_EVENT = "linuxdo-card-view:close-private-message";
export const NATIVE_POST_ACTION_EVENT = "linuxdo-card-view:native-post-action";
export const NATIVE_POST_ACTION_RESULT_EVENT = "linuxdo-card-view:native-post-action-result";
export const NATIVE_REPLY_SUBMITTED_EVENT = "linuxdo-card-view:native-reply-submitted";
export const NATIVE_ROUTE_RESTORE_EVENT = "linuxdo-card-view:restore-route";

export interface PrivateMessageRequest {
  username: string;
  title: string;
  body: string;
  postUrl: string;
  replaceExisting: boolean;
}

export type NativePostAction = "reply" | "like" | "bookmark" | "flag";
export type NativePostActionStatus = "success" | "opened" | "unsupported" | "error" | "timeout";

export interface NativePostActionRequest {
  action: NativePostAction;
  topicId: number;
  topicUrl: string;
  postUrl: string;
  postId: number;
  postNumber: number;
  title: string;
  username?: string;
  avatarUrl?: string;
  canReply?: boolean | null;
  returnUrl?: string;
  draftKey?: string;
  draftSequence?: number;
  canLike?: boolean | null;
  liked?: boolean | null;
  canBookmark?: boolean | null;
  bookmarked?: boolean | null;
  replaceExisting?: boolean;
}

export interface NativePostActionResult {
  ok: boolean;
  status: NativePostActionStatus;
  message: string;
  fallbackUrl?: string;
  acted?: boolean;
}

export function ensurePageBridge(documentRef: Document = document): boolean {
  if (documentRef.getElementById(PAGE_BRIDGE_ID)) {
    return true;
  }
  const bridgeUrl = pageBridgeUrl();
  if (!bridgeUrl) {
    return false;
  }

  const script = documentRef.createElement("script");
  script.id = PAGE_BRIDGE_ID;
  script.src = bridgeUrl;
  script.async = false;
  script.onload = () => script.remove();
  (documentRef.head || documentRef.documentElement).appendChild(script);
  return true;
}

function pageBridgeUrl(): string {
  try {
    if (typeof chrome === "undefined" || !chrome.runtime?.getURL) {
      return "";
    }
    return chrome.runtime.getURL("pageBridge.js");
  } catch {
    return "";
  }
}

export function requestNativePrivateMessage(
  request: PrivateMessageRequest,
  options: {
    timeoutMs?: number;
    windowRef?: Window;
  } = {}
): Promise<boolean> {
  const windowRef = options.windowRef ?? window;
  const requestId = createRequestId(windowRef);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean): void => {
      if (settled) {
        return;
      }
      settled = true;
      windowRef.clearTimeout(timer);
      windowRef.removeEventListener(PRIVATE_MESSAGE_RESULT_EVENT, handleResult as EventListener);
      resolve(result);
    };

    const timer = windowRef.setTimeout(() => {
      finish(false);
    }, options.timeoutMs ?? 900);

    const handleResult = (event: CustomEvent<{ requestId?: string; ok?: boolean }>): void => {
      if (event.detail?.requestId !== requestId) {
        return;
      }
      finish(Boolean(event.detail.ok));
    };

    windowRef.addEventListener(PRIVATE_MESSAGE_RESULT_EVENT, handleResult as EventListener);
    void ensurePageBridgeLoaded(windowRef.document).then((loaded) => {
      if (settled) {
        return;
      }
      if (!loaded) {
        finish(false);
        return;
      }
      windowRef.dispatchEvent(
        new CustomEvent(PRIVATE_MESSAGE_EVENT, {
          detail: {
            ...request,
            requestId
          }
        })
      );
    });
  });
}

export function requestNativePostAction(
  request: NativePostActionRequest,
  options: {
    timeoutMs?: number;
    windowRef?: Window;
  } = {}
): Promise<NativePostActionResult> {
  const windowRef = options.windowRef ?? window;
  const requestId = createRequestId(windowRef);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: NativePostActionResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      windowRef.clearTimeout(timer);
      windowRef.removeEventListener(NATIVE_POST_ACTION_RESULT_EVENT, handleResult as EventListener);
      resolve(result);
    };

    const timer = windowRef.setTimeout(() => {
      finish({
        ok: false,
        status: "timeout",
        message: "原生操作超时，请稍后重试。"
      });
    }, options.timeoutMs ?? 5000);

    const handleResult = (
      event: CustomEvent<{
        requestId?: string;
        ok?: boolean;
        status?: NativePostActionStatus;
        message?: string;
        fallbackUrl?: string;
        acted?: boolean;
      }>
    ): void => {
      if (event.detail?.requestId !== requestId) {
        return;
      }
      finish({
        ok: Boolean(event.detail.ok),
        status: event.detail.status || "error",
        message: event.detail.message || "原生操作失败。",
        fallbackUrl: event.detail.fallbackUrl,
        acted: event.detail.acted
      });
    };

    windowRef.addEventListener(NATIVE_POST_ACTION_RESULT_EVENT, handleResult as EventListener);
    void ensurePageBridgeLoaded(windowRef.document).then((loaded) => {
      if (settled) {
        return;
      }
      if (!loaded) {
        finish({
          ok: false,
          status: "unsupported",
          message: "原生页面桥接不可用，请在原贴中重试。"
        });
        return;
      }
      windowRef.dispatchEvent(
        new CustomEvent(NATIVE_POST_ACTION_EVENT, {
          detail: {
            ...request,
            requestId
          }
        })
      );
    });
  });
}

export function requestNativePrivateMessageClose(windowRef: Window = window): void {
  ensurePageBridge(windowRef.document);
  windowRef.dispatchEvent(new Event(PRIVATE_MESSAGE_CLOSE_EVENT));
}

export function requestNativeRouteRestore(
  returnUrl: string,
  options: {
    windowRef?: Window;
  } = {}
): void {
  const route = returnUrl.trim();
  if (!route) {
    return;
  }

  const windowRef = options.windowRef ?? window;
  void ensurePageBridgeLoaded(windowRef.document).then((loaded) => {
    if (!loaded) {
      return;
    }
    windowRef.dispatchEvent(
      new CustomEvent(NATIVE_ROUTE_RESTORE_EVENT, {
        detail: {
          returnUrl: route
        }
      })
    );
  });
}

function createRequestId(windowRef: Window): string {
  if (typeof windowRef.crypto !== "undefined" && "randomUUID" in windowRef.crypto) {
    return windowRef.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ensurePageBridgeLoaded(documentRef: Document): Promise<boolean> {
  const existing = documentRef.getElementById(PAGE_BRIDGE_ID);
  if (existing instanceof HTMLScriptElement) {
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
    });
  }

  const bridgeUrl = pageBridgeUrl();
  if (!bridgeUrl) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const script = documentRef.createElement("script");
    script.id = PAGE_BRIDGE_ID;
    script.src = bridgeUrl;
    script.async = false;
    script.onload = () => {
      script.remove();
      resolve(true);
    };
    script.onerror = () => {
      script.remove();
      resolve(false);
    };
    (documentRef.head || documentRef.documentElement).appendChild(script);
  });
}
