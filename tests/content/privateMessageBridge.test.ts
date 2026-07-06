import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ensurePageBridge,
  NATIVE_POST_ACTION_EVENT,
  NATIVE_POST_ACTION_RESULT_EVENT,
  NATIVE_REPLY_SUBMITTED_EVENT,
  NATIVE_ROUTE_RESTORE_EVENT,
  PAGE_BRIDGE_ID,
  PRIVATE_MESSAGE_CLOSE_EVENT,
  PRIVATE_MESSAGE_EVENT,
  PRIVATE_MESSAGE_RESULT_EVENT,
  requestNativePostAction,
  requestNativePrivateMessage,
  requestNativePrivateMessageClose,
  requestNativeRouteRestore
} from "../../src/content/privateMessageBridge";

describe("private message page bridge", () => {
  afterEach(() => {
    document.getElementById(PAGE_BRIDGE_ID)?.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("injects the page bridge script once when chrome runtime is available", () => {
    const getURL = vi.fn((path: string) => `chrome-extension://id/${path}`);
    vi.stubGlobal("chrome", { runtime: { getURL } });

    expect(ensurePageBridge(document)).toBe(true);
    expect(ensurePageBridge(document)).toBe(true);

    const scripts = document.querySelectorAll(`#${PAGE_BRIDGE_ID}`);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.getAttribute("src")).toBe("chrome-extension://id/pageBridge.js");
    expect(getURL).toHaveBeenCalledTimes(1);
  });

  it("does not throw when the extension context was invalidated", () => {
    const getURL = vi.fn(() => {
      throw new Error("Extension context invalidated.");
    });
    vi.stubGlobal("chrome", { runtime: { getURL } });

    expect(() => ensurePageBridge(document)).not.toThrow();
    expect(ensurePageBridge(document)).toBe(false);
    expect(document.querySelector(`#${PAGE_BRIDGE_ID}`)).toBeNull();
  });

  it("dispatches private message requests and resolves matching results", async () => {
    vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => `chrome-extension://id/${path}` } });
    window.addEventListener(
      PRIVATE_MESSAGE_EVENT,
      ((event: CustomEvent<{ requestId?: string; username?: string }>) => {
        expect(event.detail.username).toBe("alice");
        window.dispatchEvent(
          new CustomEvent(PRIVATE_MESSAGE_RESULT_EVENT, {
            detail: {
              requestId: event.detail.requestId,
              ok: true
            }
          })
        );
      }) as EventListener,
      { once: true }
    );

    const result = requestNativePrivateMessage(
      {
        username: "alice",
        title: "Title",
        body: "Body",
        postUrl: "https://linux.do/t/topic/1/2",
        replaceExisting: false
      },
      { timeoutMs: 50 }
    );
    document.getElementById(PAGE_BRIDGE_ID)?.dispatchEvent(new Event("load"));

    await expect(result).resolves.toBe(true);
  });

  it("resolves false when no matching result arrives", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => `chrome-extension://id/${path}` } });
    const result = requestNativePrivateMessage(
      {
        username: "alice",
        title: "Title",
        body: "Body",
        postUrl: "https://linux.do/t/topic/1/2",
        replaceExisting: false
      },
      { timeoutMs: 50 }
    );
    document.getElementById(PAGE_BRIDGE_ID)?.dispatchEvent(new Event("load"));

    await vi.advanceTimersByTimeAsync(50);
    await expect(result).resolves.toBe(false);
  });

  it("dispatches native close requests", () => {
    const closeHandler = vi.fn();
    window.addEventListener(PRIVATE_MESSAGE_CLOSE_EVENT, closeHandler, { once: true });

    requestNativePrivateMessageClose(window);

    expect(closeHandler).toHaveBeenCalledTimes(1);
  });

  it("dispatches native route restore requests after the page bridge loads", async () => {
    vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => `chrome-extension://id/${path}` } });
    const restoreDetail = new Promise<Record<string, unknown>>((resolve) => {
      window.addEventListener(
        NATIVE_ROUTE_RESTORE_EVENT,
        ((event: CustomEvent<Record<string, unknown>>) => resolve(event.detail)) as EventListener,
        { once: true }
      );
    });

    requestNativeRouteRestore("/posted", { windowRef: window });
    document.getElementById(PAGE_BRIDGE_ID)?.dispatchEvent(new Event("load"));

    await expect(restoreDetail).resolves.toEqual({ returnUrl: "/posted" });
  });

  it("dispatches native post action requests and resolves structured results", async () => {
    vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => `chrome-extension://id/${path}` } });
    window.addEventListener(
      NATIVE_POST_ACTION_EVENT,
      ((event: CustomEvent<{ requestId?: string; action?: string; postNumber?: number }>) => {
        expect(event.detail.action).toBe("reply");
        expect(event.detail.postNumber).toBe(2);
        window.dispatchEvent(
          new CustomEvent(NATIVE_POST_ACTION_RESULT_EVENT, {
            detail: {
              requestId: event.detail.requestId,
              ok: true,
              status: "opened",
              message: "opened"
            }
          })
        );
      }) as EventListener,
      { once: true }
    );

    const result = requestNativePostAction(
      {
        action: "reply",
        topicId: 10,
        topicUrl: "https://linux.do/t/topic/10",
        postUrl: "https://linux.do/t/topic/10/2",
        postId: 22,
        postNumber: 2,
        title: "Title",
        replaceExisting: false
      },
      { timeoutMs: 50 }
    );
    document.getElementById(PAGE_BRIDGE_ID)?.dispatchEvent(new Event("load"));

    await expect(result).resolves.toEqual({
      ok: true,
      status: "opened",
      message: "opened",
      fallbackUrl: undefined
    });
  });

  it("waits for the page bridge script to load before dispatching native post actions", async () => {
    vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => `chrome-extension://id/${path}` } });
    const nativePostAction = vi.fn((event: CustomEvent<{ requestId?: string }>) => {
      window.dispatchEvent(
        new CustomEvent(NATIVE_POST_ACTION_RESULT_EVENT, {
          detail: {
            requestId: event.detail.requestId,
            ok: true,
            status: "opened",
            message: "opened"
          }
        })
      );
    });
    window.addEventListener(NATIVE_POST_ACTION_EVENT, nativePostAction as EventListener);

    const result = requestNativePostAction(
      {
        action: "reply",
        topicId: 10,
        topicUrl: "https://linux.do/t/topic/10",
        postUrl: "https://linux.do/t/topic/10/2",
        postId: 22,
        postNumber: 2,
        title: "Title",
        replaceExisting: false
      },
      { timeoutMs: 50 }
    );

    expect(nativePostAction).not.toHaveBeenCalled();
    document.getElementById(PAGE_BRIDGE_ID)?.dispatchEvent(new Event("load"));

    await expect(result).resolves.toEqual(expect.objectContaining({ ok: true, status: "opened" }));
    expect(nativePostAction).toHaveBeenCalledTimes(1);
    window.removeEventListener(NATIVE_POST_ACTION_EVENT, nativePostAction as EventListener);
  });
});

describe("page bridge native reply action", () => {
  afterEach(() => {
    (window as unknown as { __linuxdoCardViewReplyNavigationGuard?: unknown }).__linuxdoCardViewReplyNavigationGuard = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fetches the native topic before falling back to a local detail topic", async () => {
    const open = vi.fn(() => Promise.resolve());
    const storeFind = vi.fn(() => Promise.resolve(null));
    installPageBridgeWithReplyMocks({ open, storeFind });

    const result = await dispatchPageBridgePostAction({
      action: "reply",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Reader Detail Title",
      canReply: true,
      draftSequence: 7,
      replaceExisting: false
    });

    expect(storeFind).toHaveBeenCalledWith("topic", 10);
    const opts = (open.mock.calls as unknown as Array<[unknown]>)[0]?.[0] as {
      topic?: PageBridgeModel;
      draftKey?: string;
      draftSequence?: number;
    };
    expect(opts).toEqual(
      expect.objectContaining({
        action: "reply",
        draftKey: "topic_10",
        draftSequence: 7
      })
    );
    expect(opts.topic?.get("id")).toBe(10);
    expect(opts.topic?.get("title")).toBe("Reader Detail Title");
    expect(opts.topic?.get("details.can_create_post")).toBe(true);
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "opened"
      })
    );

    const submitted = new Promise<Record<string, unknown>>((resolve) => {
      window.addEventListener(
        NATIVE_REPLY_SUBMITTED_EVENT,
        ((event: CustomEvent<Record<string, unknown>>) => resolve(event.detail)) as EventListener,
        { once: true }
      );
    });
    const previousHref = window.location.href;
    history.pushState({}, "", "/t/topic/10/3");

    await expect(submitted).resolves.toEqual(
      expect.objectContaining({
        topicId: 10,
        postNumber: 1,
        topicPath: "/t/topic/10"
      })
    );
    expect(window.location.href).toBe(previousHref);
  });

  it("normalizes nested Reader topic URLs into native Discourse topic paths", async () => {
    const open = vi.fn(() => Promise.resolve());
    const storeFind = vi.fn(() => Promise.resolve(null));
    installPageBridgeWithReplyMocks({ open, storeFind });

    const result = await dispatchPageBridgePostAction({
      action: "reply",
      topicId: 10,
      topicUrl: "https://linux.do/n/reader-topic/10",
      postUrl: "https://linux.do/n/reader-topic/10/2",
      postId: 202,
      postNumber: 2,
      title: "Reader Detail Title",
      username: "alice",
      canReply: true,
      replaceExisting: false
    });

    const opts = (open.mock.calls as unknown as Array<[unknown]>)[0]?.[0] as {
      post?: PageBridgeModel;
    };
    const topic = opts.post?.get("topic") as PageBridgeModel | undefined;
    expect(topic?.get("slug")).toBe("reader-topic");
    expect(topic?.get("url")).toBe("/t/reader-topic/10");
    expect(opts.post?.get("topic_slug")).toBe("reader-topic");
    expect(opts.post?.get("topic_url")).toBe("/t/reader-topic/10");
    expect(opts.post?.get("url")).toBe("/t/reader-topic/10/2");
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "opened"
      })
    );
  });

  it("keeps reply navigation suppression after the page bridge is reinjected", async () => {
    installPageBridgeWithReplyMocks({
      open: vi.fn(() => Promise.resolve()),
      storeFind: vi.fn(() => Promise.resolve(null))
    });

    const open = vi.fn(() => Promise.resolve());
    installPageBridgeWithReplyMocks({
      open,
      storeFind: vi.fn(() => Promise.resolve(null))
    });

    await dispatchPageBridgePostAction({
      action: "reply",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/2",
      postId: 202,
      postNumber: 2,
      title: "Reader Detail Title",
      canReply: true,
      replaceExisting: false
    });

    const submitted = new Promise<Record<string, unknown>>((resolve) => {
      window.addEventListener(
        NATIVE_REPLY_SUBMITTED_EVENT,
        ((event: CustomEvent<Record<string, unknown>>) => resolve(event.detail)) as EventListener,
        { once: true }
      );
    });
    const previousHref = window.location.href;
    history.replaceState({}, "", "/t/topic/10/4");

    expect(open).toHaveBeenCalledTimes(1);
    await expect(submitted).resolves.toEqual(
      expect.objectContaining({
        topicId: 10,
        postNumber: 2
      })
    );
    expect(window.location.href).toBe(previousHref);
  });

  it("keeps suppressing delayed same-topic redirects after reply submission", async () => {
    vi.useFakeTimers();
    installPageBridgeWithReplyMocks({
      open: vi.fn(() => Promise.resolve()),
      storeFind: vi.fn(() => Promise.resolve(null))
    });

    await dispatchPageBridgePostAction({
      action: "reply",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/2",
      postId: 202,
      postNumber: 2,
      title: "Reader Detail Title",
      canReply: true,
      replaceExisting: false
    });

    const previousHref = window.location.href;
    history.pushState({}, "", "/t/topic/10/3");
    await vi.advanceTimersByTimeAsync(15_000);
    history.replaceState({}, "", "/t/topic/10/4");

    expect(window.location.href).toBe(previousHref);
  });

  it("suppresses native same-topic redirects when the Reader action came from an n/topic URL", async () => {
    vi.useFakeTimers();
    installPageBridgeWithReplyMocks({
      open: vi.fn(() => Promise.resolve()),
      storeFind: vi.fn(() => Promise.resolve(null))
    });

    await dispatchPageBridgePostAction({
      action: "reply",
      topicId: 10,
      topicUrl: "https://linux.do/n/reader-topic/10",
      postUrl: "https://linux.do/n/reader-topic/10/2",
      postId: 202,
      postNumber: 2,
      title: "Reader Detail Title",
      canReply: true,
      replaceExisting: false
    });

    const previousHref = window.location.href;
    history.pushState({}, "", "/t/reader-topic/10/3");
    await vi.advanceTimersByTimeAsync(15_000);
    history.replaceState({}, "", "/t/reader-topic/10/4");

    expect(window.location.href).toBe(previousHref);
  });

  it("does not rerun the Discourse router when suppressing reply navigation on the return route", async () => {
    history.replaceState({}, "", "/posted");
    const transitionTo = vi.fn(() => Promise.resolve());
    installPageBridgeWithReplyMocks({
      open: vi.fn(() => Promise.resolve()),
      storeFind: vi.fn(() => Promise.resolve(null)),
      router: {
        transitionTo
      }
    });

    await dispatchPageBridgePostAction({
      action: "reply",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/2",
      postId: 202,
      postNumber: 2,
      title: "Reader Detail Title",
      canReply: true,
      returnUrl: "/posted",
      replaceExisting: false
    });

    const previousHref = window.location.href;
    history.pushState({}, "", "/t/topic/10/3");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.location.href).toBe(previousHref);
    expect(transitionTo).not.toHaveBeenCalled();
    expect(document.documentElement.classList.contains("ldcv-native-reply-route-restoring")).toBe(true);
  });

  it("submits Reader replies through the posts API without native topic navigation", async () => {
    history.replaceState({}, "", "/posted");
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 320,
      height: 120,
      top: 0,
      right: 320,
      bottom: 120,
      left: 0,
      toJSON: () => ({})
    } as DOMRect);
    document.head.innerHTML = '<meta name="csrf-token" content="csrf-token">';
    document.body.innerHTML = `
      <div id="reply-control" class="open">
        <textarea class="d-editor-input">Reader controlled reply</textarea>
        <a class="composer-actions-reply-target-link btn" title="回复话题" aria-label="回复话题">Reader Detail Title</a>
        <div class="submit-panel">
          <button class="btn btn-primary create" type="button">回复</button>
        </div>
      </div>
    `;
    const transitionTo = vi.fn(() => Promise.resolve());
    const close = vi.fn();
    const destroyDraft = vi.fn(() => Promise.resolve());
    const clearState = vi.fn();
    installPageBridgeWithReplyMocks({
      open: vi.fn(() => Promise.resolve()),
      storeFind: vi.fn(() => Promise.resolve(null)),
      router: {
        transitionTo
      },
      composerOverrides: {
        close,
        destroyDraft,
        model: {
          clearState
        }
      }
    });
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            id: 555,
            topic_id: 10,
            post_number: 5
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          }
        )
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await dispatchPageBridgePostAction({
      action: "reply",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/2",
      postId: 202,
      postNumber: 2,
      title: "Reader Detail Title",
      canReply: true,
      returnUrl: "/posted",
      replaceExisting: false
    });

    document.querySelector<HTMLElement>("#reply-control .composer-actions-reply-target-link")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();

    const submitted = new Promise<Record<string, unknown>>((resolve) => {
      window.addEventListener(
        NATIVE_REPLY_SUBMITTED_EVENT,
        ((event: CustomEvent<Record<string, unknown>>) => resolve(event.detail)) as EventListener,
        { once: true }
      );
    });
    const previousHref = window.location.href;
    document.querySelector<HTMLButtonElement>("#reply-control button.create")?.click();

    await expect(submitted).resolves.toEqual(
      expect.objectContaining({
        topicId: 10,
        postNumber: 2,
        submittedPostNumber: 5,
        submittedUrl: "https://linux.do/t/topic/10/5"
      })
    );
    expect(window.location.href).toBe(previousHref);
    expect(transitionTo).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/posts.json",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "X-CSRF-Token": "csrf-token"
        })
      })
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      raw: "Reader controlled reply",
      topic_id: 10,
      reply_to_post_number: 2
    });
    expect(close).toHaveBeenCalledTimes(1);
    expect(destroyDraft).toHaveBeenCalledTimes(1);
    expect(clearState).toHaveBeenCalledTimes(1);
  });

  it("restores the Discourse router route when requested", () => {
    history.replaceState({}, "", "/latest");
    const transitionTo = vi.fn(() => Promise.resolve());
    installPageBridgeWithReplyMocks({
      open: vi.fn(() => Promise.resolve()),
      storeFind: vi.fn(() => Promise.resolve(null)),
      router: {
        transitionTo
      }
    });

    window.dispatchEvent(
      new CustomEvent(NATIVE_ROUTE_RESTORE_EVENT, {
        detail: {
          returnUrl: "https://linux.do/posted?filter=mine#reader"
        }
      })
    );

    expect(transitionTo).toHaveBeenCalledWith("/posted?filter=mine#reader");
  });

  it("uses a cached native topic when Discourse already has one", async () => {
    const open = vi.fn(() => Promise.resolve());
    const nativeTopic = pageBridgeModel({
      id: 10,
      draft_key: "topic_10",
      draft_sequence: 3,
      details: {
        can_create_post: true
      },
      postStream: {
        posts: []
      }
    });
    const peekRecord = vi.fn(() => nativeTopic);
    const storeFind = vi.fn(() => Promise.resolve(null));
    installPageBridgeWithReplyMocks({
      open,
      peekRecord,
      storeFind
    });

    const result = await dispatchPageBridgePostAction({
      action: "reply",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Reader Detail Title",
      canReply: true,
      draftSequence: 7,
      replaceExisting: false
    });

    expect(storeFind).not.toHaveBeenCalled();
    expect(peekRecord).toHaveBeenCalledWith("topic", 10);
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: nativeTopic,
        draftSequence: 7
      })
    );
    expect(nativeTopic.get("slug")).toBe("topic");
    expect(nativeTopic.get("url")).toBe("/t/topic/10");
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "opened"
      })
    );
  });

  it("does not open reply composers when the reader detail says replies are unavailable", async () => {
    const open = vi.fn(() => Promise.resolve());
    const storeFind = vi.fn(() => Promise.resolve(null));
    installPageBridgeWithReplyMocks({ open, storeFind });

    const result = await dispatchPageBridgePostAction({
      action: "reply",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Reader Detail Title",
      canReply: false,
      replaceExisting: false
    });

    expect(storeFind).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        status: "unsupported",
        fallbackUrl: "https://linux.do/t/topic/10/1"
      })
    );
  });

  it("fetches the native post before falling back to a local detail post", async () => {
    const open = vi.fn(() => Promise.resolve());
    const storeFind = vi.fn(() => Promise.resolve(null));
    installPageBridgeWithReplyMocks({ open, storeFind });

    const result = await dispatchPageBridgePostAction({
      action: "reply",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/2",
      postId: 202,
      postNumber: 2,
      title: "Reader Detail Title",
      username: "alice",
      canReply: true,
      replaceExisting: false
    });

    expect(storeFind).toHaveBeenCalledWith("topic", 10);
    expect(storeFind).toHaveBeenCalledWith("post", 202);
    const opts = (open.mock.calls as unknown as Array<[unknown]>)[0]?.[0] as {
      post?: PageBridgeModel;
      draftKey?: string;
    };
    expect(opts).toEqual(expect.objectContaining({ action: "reply", draftKey: "topic_10" }));
    expect(opts.post?.get("id")).toBe(202);
    expect(opts.post?.get("post_number")).toBe(2);
    const topic = opts.post?.get("topic") as PageBridgeModel | undefined;
    expect(topic?.get("id")).toBe(10);
    expect(topic?.get("slug")).toBe("topic");
    expect(topic?.get("url")).toBe("/t/topic/10");
    expect(opts.post?.get("topic_slug")).toBe("topic");
    expect(opts.post?.get("url")).toBe("/t/topic/10/2");
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "opened"
      })
    );
  });
});

describe("page bridge native bookmark action", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not call bookmark-api create when no reliable native bookmark action exists", async () => {
    const create = vi.fn();
    installPageBridgeWithBookmarkMocks({ create });

    const result = await dispatchPageBridgePostAction({
      action: "bookmark",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Title",
      canBookmark: true,
      bookmarked: false,
      replaceExisting: false
    });

    expect(create).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        status: "unsupported",
        fallbackUrl: "https://linux.do/t/topic/10/1"
      })
    );
  });

  it("uses the native post bookmark action object when available", async () => {
    const bookmarkAct = vi.fn((post: PageBridgeModel) => {
      post.set("bookmarked", true);
    });
    const create = vi.fn();
    installPageBridgeWithBookmarkMocks({
      create,
      postValues: {
        bookmarkAction: {
          canToggle: true,
          act: bookmarkAct
        }
      }
    });

    const result = await dispatchPageBridgePostAction({
      action: "bookmark",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Title",
      canBookmark: true,
      bookmarked: false,
      replaceExisting: false
    });

    expect(create).not.toHaveBeenCalled();
    expect(bookmarkAct).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "success",
        acted: true
      })
    );
  });

  it("uses Discourse post bookmark manager when no action object is exposed", async () => {
    const create = vi.fn();
    const managerCreate = vi.fn(function (this: { post: PageBridgeModel }) {
      this.post.set("bookmarked", true);
      return Promise.resolve();
    });
    installPageBridgeWithBookmarkMocks({
      create,
      bookmarkManager: class PostBookmarkManager {
        post: PageBridgeModel;

        constructor(_owner: unknown, post: PageBridgeModel) {
          this.post = post;
        }

        create = managerCreate;
      }
    });

    const result = await dispatchPageBridgePostAction({
      action: "bookmark",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Title",
      canBookmark: true,
      bookmarked: false,
      replaceExisting: false
    });

    expect(create).not.toHaveBeenCalled();
    expect(managerCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "success",
        acted: true
      })
    );
  });

  it("reports a failed native bookmark manager write as an error", async () => {
    const create = vi.fn();
    const managerCreate = vi.fn(() => Promise.reject(new Error("forbidden")));
    installPageBridgeWithBookmarkMocks({
      create,
      bookmarkManager: class PostBookmarkManager {
        create = managerCreate;
      }
    });

    const result = await dispatchPageBridgePostAction({
      action: "bookmark",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Title",
      canBookmark: true,
      bookmarked: false,
      replaceExisting: false
    });

    expect(create).not.toHaveBeenCalled();
    expect(managerCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        status: "error",
        fallbackUrl: "https://linux.do/t/topic/10/1"
      })
    );
  });

  it("binds the target topic while running Discourse post bookmark manager", async () => {
    const create = vi.fn();
    const managerCreate = vi.fn(() => Promise.resolve());
    const observedTopicIds: unknown[] = [];
    installPageBridgeWithBookmarkMocks({
      create,
      bookmarkManager: class PostBookmarkManager {
        constructor() {
          const discourse = window as unknown as {
            Discourse: { __container__: { lookup(key: string): PageBridgeModel | null } };
          };
          const topic = discourse.Discourse.__container__.lookup("controller:topic")?.get("model") as PageBridgeModel | null;
          observedTopicIds.push(topic?.get("id"));
          if (topic?.get("id") !== 10) {
            throw new Error("missing topic controller model");
          }
        }

        create = managerCreate;
      }
    });

    const result = await dispatchPageBridgePostAction({
      action: "bookmark",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Title",
      canBookmark: true,
      bookmarked: false,
      replaceExisting: false
    });

    expect(create).not.toHaveBeenCalled();
    expect(managerCreate).toHaveBeenCalledTimes(1);
    expect(observedTopicIds).toEqual([10]);
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "success",
        acted: true
      })
    );
  });

  it("uses Discourse post bookmark manager to remove an existing bookmark", async () => {
    const create = vi.fn();
    const managerCreate = vi.fn();
    const managerDelete = vi.fn(() => Promise.resolve({ topic_bookmarked: false }));
    const managerAfterDelete = vi.fn();
    installPageBridgeWithBookmarkMocks({
      create,
      postValues: {
        bookmarked: true
      },
      topicValues: {
        bookmarks: [{ id: 55, bookmarkable_id: 101, bookmarkable_type: "Post" }]
      },
      bookmarkManager: class PostBookmarkManager {
        trackedBookmark = { id: 55 };

        create = managerCreate;
        delete = managerDelete;
        afterDelete = managerAfterDelete;
      }
    });

    const result = await dispatchPageBridgePostAction({
      action: "bookmark",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Title",
      canBookmark: true,
      bookmarked: true,
      replaceExisting: false
    });

    expect(create).not.toHaveBeenCalled();
    expect(managerCreate).not.toHaveBeenCalled();
    expect(managerDelete).toHaveBeenCalledTimes(1);
    expect(managerAfterDelete).toHaveBeenCalledWith({ topic_bookmarked: false }, 55);
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "success",
        acted: false
      })
    );
  });

  it("does not call native bookmark delete when the existing bookmark cannot be confirmed", async () => {
    const create = vi.fn();
    const managerCreate = vi.fn();
    const managerDelete = vi.fn();
    installPageBridgeWithBookmarkMocks({
      create,
      bookmarkManager: class PostBookmarkManager {
        create = managerCreate;
        delete = managerDelete;
      }
    });

    const result = await dispatchPageBridgePostAction({
      action: "bookmark",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Title",
      canBookmark: true,
      bookmarked: true,
      replaceExisting: false
    });

    expect(create).not.toHaveBeenCalled();
    expect(managerCreate).not.toHaveBeenCalled();
    expect(managerDelete).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        status: "unsupported"
      })
    );
  });
});

describe("page bridge native like action", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the Discourse togglePromise path before the lower-level act path", async () => {
    const create = vi.fn();
    const togglePromise = vi.fn((post: PageBridgeModel) => {
      post.set("liked", true);
      return Promise.resolve({ acted: true });
    });
    const act = vi.fn(() => {
      throw new Error("wrong path");
    });
    installPageBridgeWithBookmarkMocks({
      create,
      postValues: {
        likeAction: {
          canToggle: true,
          acted: false,
          togglePromise,
          act
        }
      }
    });

    const result = await dispatchPageBridgePostAction({
      action: "like",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Title",
      canLike: true,
      liked: false,
      replaceExisting: false
    });

    expect(togglePromise).toHaveBeenCalledTimes(1);
    expect(act).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "success",
        acted: true
      })
    );
  });

  it("uses the Discourse togglePromise path to remove an existing like", async () => {
    const create = vi.fn();
    const togglePromise = vi.fn((post: PageBridgeModel) => {
      post.set("liked", false);
      return Promise.resolve({ acted: false });
    });
    const act = vi.fn();
    installPageBridgeWithBookmarkMocks({
      create,
      postValues: {
        likeAction: {
          canToggle: true,
          acted: true,
          togglePromise,
          act
        }
      }
    });

    const result = await dispatchPageBridgePostAction({
      action: "like",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Title",
      canLike: true,
      liked: true,
      replaceExisting: false
    });

    expect(togglePromise).toHaveBeenCalledTimes(1);
    expect(act).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "success",
        acted: false
      })
    );
  });

  it("allows like removal when Discourse exposes can_undo without canToggle", async () => {
    const create = vi.fn();
    const togglePromise = vi.fn((post: PageBridgeModel) => {
      post.set("liked", false);
      return Promise.resolve({ acted: false });
    });
    installPageBridgeWithBookmarkMocks({
      create,
      postValues: {
        likeAction: {
          can_act: false,
          can_undo: true,
          acted: true,
          togglePromise
        }
      }
    });

    const result = await dispatchPageBridgePostAction({
      action: "like",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Title",
      canLike: true,
      liked: true,
      replaceExisting: false
    });

    expect(togglePromise).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "success",
        acted: false
      })
    );
  });

  it("does not run like actions when Discourse exposes only negative capabilities", async () => {
    const create = vi.fn();
    const togglePromise = vi.fn();
    installPageBridgeWithBookmarkMocks({
      create,
      postValues: {
        likeAction: {
          can_act: false,
          can_undo: false,
          togglePromise
        }
      }
    });

    const result = await dispatchPageBridgePostAction({
      action: "like",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/1",
      postId: 101,
      postNumber: 1,
      title: "Title",
      canLike: true,
      liked: false,
      replaceExisting: false
    });

    expect(togglePromise).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        status: "unsupported"
      })
    );
  });

  it("normalizes plain comment post records before running native like actions", async () => {
    const create = vi.fn();
    const togglePromise = vi.fn((post: PageBridgeModel) => {
      expect(post.get("id")).toBe(202);
      post.updateActionsSummary?.({ acted: true });
      return Promise.resolve({ acted: true });
    });
    installPageBridgeWithBookmarkMocks({
      create,
      postValues: {
        id: 202,
        post_number: 5,
        likeAction: {
          canToggle: true,
          acted: false,
          togglePromise
        }
      },
      plainPost: true
    });

    const result = await dispatchPageBridgePostAction({
      action: "like",
      topicId: 10,
      topicUrl: "https://linux.do/t/topic/10",
      postUrl: "https://linux.do/t/topic/10/5",
      postId: 202,
      postNumber: 5,
      title: "Title",
      canLike: true,
      liked: false,
      replaceExisting: false
    });

    expect(togglePromise).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        status: "success",
        acted: true
      })
    );
  });
});

interface PageBridgeModel {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  updateActionsSummary?(summary: unknown): void;
}

function installPageBridgeWithBookmarkMocks({
  create,
  bookmarkManager,
  postValues = {},
  topicValues = {},
  plainPost = false
}: {
  create: ReturnType<typeof vi.fn>;
  bookmarkManager?: unknown;
  postValues?: Record<string, unknown>;
  topicValues?: Record<string, unknown>;
  plainPost?: boolean;
}): void {
  const postData = {
    id: 101,
    post_number: 1,
    post_number_int: 1,
    bookmarked: false,
    ...postValues
  };
  const post = plainPost ? (postData as unknown as PageBridgeModel) : pageBridgeModel(postData);
  const topic = pageBridgeModel({
    id: 10,
    bookmarks: [],
    postStream: {
      posts: [post],
      findLoadedPost: (id: number) => (id === 101 ? post : null)
    },
    ...topicValues
  });
  const topicController = pageBridgeModel({
    model: null
  });
  if (plainPost) {
    (post as unknown as Record<string, unknown>).topic = topic;
  } else {
    post.set("topic", topic);
  }
  const services: Record<string, unknown> = {
    "service:current-user": pageBridgeModel({ id: 1 }),
    "controller:topic": topicController,
    "service:store": {
      find: vi.fn((type: string, id: number) => {
        if (type === "topic" && id === 10) {
          return Promise.resolve(topic);
        }
        if (type === "post" && id === 101) {
          return Promise.resolve(post);
        }
        return Promise.resolve(null);
      })
    },
    "service:bookmark-api": {
      buildNewBookmark: vi.fn(() => pageBridgeModel({ bookmarkable_id: 101, bookmarkable_type: "Post" })),
      create
    }
  };

  vi.stubGlobal("Discourse", {
    __container__: {
      owner: { name: "owner" },
      lookup: (key: string) => services[key] || null
    }
  });
  vi.stubGlobal("require", (name: string) => {
    if (name === "discourse/lib/post-bookmark-manager") {
      return bookmarkManager ? { default: bookmarkManager } : undefined;
    }
    if (name === "discourse/lib/bookmark-form-data") {
      return {
        BookmarkFormData: class BookmarkFormData {
          bookmark: PageBridgeModel;
          saveData: { bookmarkable_id: unknown; bookmarkable_type: string };

          constructor(bookmark: PageBridgeModel) {
            this.bookmark = bookmark;
            this.saveData = {
              bookmarkable_id: bookmark.get("bookmarkable_id"),
              bookmarkable_type: "Post"
            };
          }
        }
      };
    }
    return undefined;
  });

  window.eval(readFileSync(join(process.cwd(), "public/pageBridge.js"), "utf8"));
}

function installPageBridgeWithReplyMocks({
  open,
  peekRecord,
  storeFind = vi.fn(() => Promise.resolve(null)),
  currentTopic = null,
  router = null,
  composerOverrides = {}
}: {
  open: ReturnType<typeof vi.fn>;
  peekRecord?: ReturnType<typeof vi.fn>;
  storeFind?: ReturnType<typeof vi.fn>;
  currentTopic?: PageBridgeModel | null;
  router?: unknown;
  composerOverrides?: Record<string, unknown>;
}): void {
  const topicController = pageBridgeModel({
    model: currentTopic
  });
  const services: Record<string, unknown> = {
    "service:composer": {
      open,
      ...composerOverrides
    },
    "controller:topic": topicController,
    "router:main": router,
    "service:store": {
      ...(peekRecord ? { peekRecord } : {}),
      find: storeFind
    }
  };

  vi.stubGlobal("Discourse", {
    __container__: {
      lookup: (key: string) => services[key] || null
    }
  });
  vi.stubGlobal("require", (name: string) => {
    if (name === "discourse/models/composer") {
      return {
        REPLY: "reply"
      };
    }
    return undefined;
  });

  window.eval(readFileSync(join(process.cwd(), "public/pageBridge.js"), "utf8"));
}

function pageBridgeModel(values: Record<string, unknown>): PageBridgeModel {
  const data = { ...values };
  return {
    ...data,
    get(key: string) {
      return getPath(data, key);
    },
    set(key: string, value: unknown) {
      setPath(data, key, value);
      setPath(this as unknown as Record<string, unknown>, key, value);
    }
  } as PageBridgeModel;
}

function getPath(target: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>(
    (value, part) => (value && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined),
    target
  );
}

function setPath(target: Record<string, unknown>, key: string, value: unknown): void {
  const parts = key.split(".");
  const last = parts.pop();
  if (!last) {
    return;
  }
  const host = parts.reduce<Record<string, unknown>>((current, part) => {
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }
    return current[part] as Record<string, unknown>;
  }, target);
  host[last] = value;
}

function dispatchPageBridgePostAction(detail: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const requestId = crypto.randomUUID();
    window.addEventListener(
      NATIVE_POST_ACTION_RESULT_EVENT,
      ((event: CustomEvent<Record<string, unknown>>) => {
        if (event.detail.requestId === requestId) {
          resolve(event.detail);
        }
      }) as EventListener,
      { once: true }
    );
    window.dispatchEvent(
      new CustomEvent(NATIVE_POST_ACTION_EVENT, {
        detail: {
          ...detail,
          requestId
        }
      })
    );
  });
}
