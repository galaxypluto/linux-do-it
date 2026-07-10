export const PAGE_BRIDGE_ID = 'linuxdo-card-view-page-bridge';
export const PRIVATE_MESSAGE_EVENT = 'linuxdo-card-view:private-message';
export const PRIVATE_MESSAGE_RESULT_EVENT = 'linuxdo-card-view:private-message-result';
export const PRIVATE_MESSAGE_CLOSE_EVENT = 'linuxdo-card-view:close-private-message';
export const NATIVE_POST_ACTION_EVENT = 'linuxdo-card-view:native-post-action';
export const NATIVE_POST_ACTION_RESULT_EVENT = 'linuxdo-card-view:native-post-action-result';
export const TOPIC_VIEW_TRACK_EVENT = 'linuxdo-card-view:track-topic-view';
export const TOPIC_VIEW_TRACK_RESULT_EVENT = 'linuxdo-card-view:track-topic-view-result';

export type NativePostAction = 'reply' | 'like' | 'bookmark' | 'flag';
export type NativePostActionStatus = 'success' | 'opened' | 'unsupported' | 'error' | 'timeout';

export type NativePostActionRequest = {
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
  draftKey?: string;
  draftSequence?: number;
  canLike?: boolean | null;
  liked?: boolean | null;
  canBookmark?: boolean | null;
  bookmarked?: boolean | null;
  replaceExisting?: boolean;
};

export type NativePostActionResult = {
  ok: boolean;
  status: NativePostActionStatus;
  message: string;
  fallbackUrl?: string;
  acted?: boolean;
};

export type PrivateMessageRequest = {
  username: string;
  title: string;
  body: string;
  postUrl: string;
  replaceExisting: boolean;
};

export function ensurePageBridge(documentRef: Document = document): boolean {
  if (documentRef.getElementById(PAGE_BRIDGE_ID)) {
    return true;
  }
  const bridgeUrl = pageBridgeUrl();
  if (!bridgeUrl) {
    return false;
  }

  const script = documentRef.createElement('script');
  script.id = PAGE_BRIDGE_ID;
  script.src = bridgeUrl;
  script.async = false;
  script.onload = () => script.remove();
  (documentRef.head || documentRef.documentElement).appendChild(script);
  return true;
}

export function requestNativePostAction(
  request: NativePostActionRequest,
  options: { timeoutMs?: number; windowRef?: Window } = {},
): Promise<NativePostActionResult> {
  const windowRef = options.windowRef ?? window;
  ensurePageBridge(windowRef.document);
  const requestId = createRequestId(windowRef);

  return new Promise((resolve) => {
    const timer = windowRef.setTimeout(() => {
      windowRef.removeEventListener(NATIVE_POST_ACTION_RESULT_EVENT, handleResult as EventListener);
      resolve({
        ok: false,
        status: 'timeout',
        message: '原生操作超时，请稍后重试。',
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
      }>,
    ): void => {
      if (event.detail?.requestId !== requestId) {
        return;
      }
      windowRef.clearTimeout(timer);
      windowRef.removeEventListener(NATIVE_POST_ACTION_RESULT_EVENT, handleResult as EventListener);
      resolve({
        ok: Boolean(event.detail.ok),
        status: event.detail.status || 'error',
        message: event.detail.message || '原生操作失败。',
        fallbackUrl: event.detail.fallbackUrl,
        acted: event.detail.acted,
      });
    };

    windowRef.addEventListener(NATIVE_POST_ACTION_RESULT_EVENT, handleResult as EventListener);
    windowRef.dispatchEvent(
      new CustomEvent(NATIVE_POST_ACTION_EVENT, {
        detail: {
          ...request,
          requestId,
        },
      }),
    );
  });
}

export function requestNativePrivateMessage(
  request: PrivateMessageRequest,
  options: { timeoutMs?: number; windowRef?: Window } = {},
): Promise<boolean> {
  const windowRef = options.windowRef ?? window;
  ensurePageBridge(windowRef.document);
  const requestId = createRequestId(windowRef);

  return new Promise((resolve) => {
    const timer = windowRef.setTimeout(() => {
      windowRef.removeEventListener(PRIVATE_MESSAGE_RESULT_EVENT, handleResult as EventListener);
      resolve(false);
    }, options.timeoutMs ?? 900);

    const handleResult = (event: CustomEvent<{ requestId?: string; ok?: boolean }>): void => {
      if (event.detail?.requestId !== requestId) {
        return;
      }
      windowRef.clearTimeout(timer);
      windowRef.removeEventListener(PRIVATE_MESSAGE_RESULT_EVENT, handleResult as EventListener);
      resolve(Boolean(event.detail.ok));
    };

    windowRef.addEventListener(PRIVATE_MESSAGE_RESULT_EVENT, handleResult as EventListener);
    windowRef.dispatchEvent(
      new CustomEvent(PRIVATE_MESSAGE_EVENT, {
        detail: {
          ...request,
          requestId,
        },
      }),
    );
  });
}

export type NativeTopicViewTrackRequest = {
  topicId: number;
  slug: string;
  topicUrl?: string;
  referrer?: string;
};

export function requestNativeTopicViewTrack(
  request: NativeTopicViewTrackRequest,
  options: { timeoutMs?: number; windowRef?: Window } = {},
): Promise<boolean> {
  const windowRef = options.windowRef ?? window;
  ensurePageBridge(windowRef.document);
  const requestId = createRequestId(windowRef);

  return new Promise((resolve) => {
    const timer = windowRef.setTimeout(() => {
      windowRef.removeEventListener(TOPIC_VIEW_TRACK_RESULT_EVENT, handleResult as EventListener);
      resolve(false);
    }, options.timeoutMs ?? 8000);

    const handleResult = (event: CustomEvent<{ requestId?: string; ok?: boolean }>): void => {
      if (event.detail?.requestId !== requestId) {
        return;
      }
      windowRef.clearTimeout(timer);
      windowRef.removeEventListener(TOPIC_VIEW_TRACK_RESULT_EVENT, handleResult as EventListener);
      resolve(Boolean(event.detail.ok));
    };

    windowRef.addEventListener(TOPIC_VIEW_TRACK_RESULT_EVENT, handleResult as EventListener);
    windowRef.dispatchEvent(
      new CustomEvent(TOPIC_VIEW_TRACK_EVENT, {
        detail: {
          ...request,
          requestId,
        },
      }),
    );
  });
}

function pageBridgeUrl(): string {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
      return '';
    }
    return chrome.runtime.getURL('pageBridge.js');
  } catch {
    return '';
  }
}

function createRequestId(windowRef: Window): string {
  if (typeof windowRef.crypto !== 'undefined' && 'randomUUID' in windowRef.crypto) {
    return windowRef.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

