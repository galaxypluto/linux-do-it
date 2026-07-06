import { describe, expect, it } from "vitest";
import {
  nativeReplyReturnUrl,
  nativeReplyReturnRouteKey,
  postNumberFromTopicPathname,
  shouldIgnoreNativeReplyListRouteRefresh,
  shouldRestoreNativeReplyRoute,
  topicIdFromTopicPathname,
  type NativeReplyRouteGuard
} from "../../src/content/nativeReplyRouteRestore";

function guard(overrides: Partial<NativeReplyRouteGuard> = {}): NativeReplyRouteGuard {
  return {
    topicId: 2283663,
    returnUrl: "/posted",
    expiresAt: 2_000,
    restoreUntil: 3_000,
    submitted: true,
    ...overrides
  };
}

describe("native reply route restore", () => {
  it("extracts topic ids from Discourse topic and post routes", () => {
    expect(topicIdFromTopicPathname("/t/topic/2283663")).toBe(2283663);
    expect(topicIdFromTopicPathname("/t/topic/2283663/4")).toBe(2283663);
    expect(topicIdFromTopicPathname("/posted")).toBeNull();
  });

  it("extracts submitted post numbers from matching Discourse topic routes", () => {
    expect(postNumberFromTopicPathname("/t/topic/2283663/4", 2283663)).toBe(4);
    expect(postNumberFromTopicPathname("/t/topic/2283663", 2283663)).toBeNull();
    expect(postNumberFromTopicPathname("/t/topic/2283664/4", 2283663)).toBeNull();
  });

  it("preserves the full topic-list return URL", () => {
    expect(
      nativeReplyReturnUrl({
        pathname: "/posted",
        search: "?page=2",
        hash: "#reader"
      } as Location)
    ).toBe("/posted?page=2#reader");
  });

  it("extracts route keys from native reply return URLs", () => {
    expect(nativeReplyReturnRouteKey("/posted?page=2#reader")).toBe("/posted?page=2");
    expect(nativeReplyReturnRouteKey("https://linux.do/latest?ascending=true#reader")).toBe("/latest?ascending=true");
    expect(nativeReplyReturnRouteKey("not-a-route")).toBe("");
  });

  it("ignores same-list route watcher refreshes during the native reply restore window", () => {
    expect(shouldIgnoreNativeReplyListRouteRefresh(guard({ returnUrl: "/posted#reader" }), "/posted", "/posted", 1_500)).toBe(
      true
    );
    expect(shouldIgnoreNativeReplyListRouteRefresh(guard({ returnUrl: "/posted" }), "/latest", "/posted", 1_500)).toBe(
      false
    );
    expect(
      shouldIgnoreNativeReplyListRouteRefresh(
        guard({
          returnUrl: "/posted",
          submitted: false
        }),
        "/posted",
        "/posted",
        1_500
      )
    ).toBe(false);
    expect(shouldIgnoreNativeReplyListRouteRefresh(guard({ returnUrl: "/posted" }), "/posted", "/posted", 4_000)).toBe(
      false
    );
  });

  it("restores only same-topic routes while the guard is active", () => {
    expect(shouldRestoreNativeReplyRoute(guard(), "/t/topic/2283663/4", 1_500)).toBe(true);
    expect(shouldRestoreNativeReplyRoute(guard(), "/t/other/2283664/4", 1_500)).toBe(false);
    expect(shouldRestoreNativeReplyRoute(guard(), "/posted", 1_500)).toBe(false);
    expect(shouldRestoreNativeReplyRoute(guard(), "/t/topic/2283663/4", 4_000)).toBe(false);
  });

  it("can restore a same-topic route before the submit event while the open guard has not expired", () => {
    expect(
      shouldRestoreNativeReplyRoute(
        guard({
          submitted: false,
          restoreUntil: 0
        }),
        "/t/topic/2283663/4",
        1_500
      )
    ).toBe(true);
    expect(
      shouldRestoreNativeReplyRoute(
        guard({
          submitted: false,
          restoreUntil: 0
        }),
        "/t/topic/2283663/4",
        2_500
      )
    ).toBe(false);
  });
});
