import { describe, expect, it } from "vitest";
import { endpointForCurrentRoute, isTopicListRoute } from "../../src/discourse/endpoints";

function linuxDoLocation(pathAndSearch: string): Location {
  return new URL(pathAndSearch, "https://linux.do") as unknown as Location;
}

describe("isTopicListRoute", () => {
  it("accepts supported topic list routes", () => {
    expect(isTopicListRoute("/")).toBe(true);
    expect(isTopicListRoute("/latest")).toBe(true);
    expect(isTopicListRoute("/new")).toBe(true);
    expect(isTopicListRoute("/unseen")).toBe(true);
    expect(isTopicListRoute("/unread")).toBe(true);
    expect(isTopicListRoute("/hot")).toBe(true);
    expect(isTopicListRoute("/top/weekly")).toBe(true);
    expect(isTopicListRoute("/posted")).toBe(true);
    expect(isTopicListRoute("/bookmarks")).toBe(true);
    expect(isTopicListRoute("/c/development/12")).toBe(true);
    expect(isTopicListRoute("/tag/chrome-extension")).toBe(true);
    expect(isTopicListRoute("/tags")).toBe(true);
  });

  it("rejects topic detail and user routes", () => {
    expect(isTopicListRoute("/t/example-topic/123")).toBe(false);
    expect(isTopicListRoute("/u/example/summary")).toBe(false);
  });
});

describe("endpointForCurrentRoute", () => {
  it.each([
    ["/", "/latest.json"],
    ["/latest", "/latest.json"],
    ["/latest?page=2", "/latest.json?page=2"],
    ["/new", "/new.json"],
    ["/unseen", "/unseen.json"],
    ["/unread", "/unread.json"],
    ["/hot", "/hot.json"],
    ["/posted", "/posted.json"],
    ["/bookmarks", "/bookmarks.json"],
    ["/c/development/12", "/c/development/12.json"],
    ["/c/development/12?page=3", "/c/development/12.json?page=3"],
    ["/tag/chrome-extension", "/tag/chrome-extension.json"],
    ["/tags", "/tags.json"]
  ])("maps %s to %s", (route, endpoint) => {
    expect(endpointForCurrentRoute(linuxDoLocation(route))).toBe(endpoint);
  });

  it("preserves top period routes", () => {
    expect(endpointForCurrentRoute(linuxDoLocation("/top/weekly"))).toBe("/top.json?period=weekly");
    expect(endpointForCurrentRoute(linuxDoLocation("/top/monthly?page=2"))).toBe(
      "/top.json?period=monthly&page=2"
    );
  });

  it("normalizes encoded tag segments", () => {
    expect(endpointForCurrentRoute(linuxDoLocation("/tag/%E6%8F%92%E4%BB%B6"))).toBe(
      "/tag/%E6%8F%92%E4%BB%B6.json"
    );
  });
});
