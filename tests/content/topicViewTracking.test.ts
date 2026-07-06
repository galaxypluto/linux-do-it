import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TopicCardData } from "../../src/discourse/types";
import {
  TopicViewTrackingController,
  buildCreditTopicViewHeaders,
  readDiscourseTrackViewSessionId,
  trackCreditTopicView,
} from "../../src/content/topicViewTracking";

vi.mock("../../src/content/nativeBridge", () => ({
  requestNativeTopicViewTrack: vi.fn(),
}));

import { requestNativeTopicViewTrack } from "../../src/content/nativeBridge";
const topic: TopicCardData = {
  id: 42,
  title: "Credit topic",
  url: "/n/credit-topic/42",
  slug: "credit-topic",
  excerpt: "",
  thumbnailUrl: "",
  tags: [],
  stats: { replies: 1, views: 10, likes: 0, score: 0 },
  dates: { createdAt: "2026-05-01T00:00:00.000Z", activityAt: "2026-05-02T00:00:00.000Z" },
  flags: {
    pinned: false,
    closed: false,
    archived: false,
    bookmarked: false,
    unseen: false,
  },
  posters: [],
};

describe("topicViewTracking", () => {
  beforeEach(() => {
    vi.mocked(requestNativeTopicViewTrack).mockReset();
    vi.stubGlobal("location", {
      href: "https://linux.do/latest",
      origin: "https://linux.do",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("ignores placeholder discourse session ids", () => {
    const doc = document.implementation.createHTMLDocument();
    const meta = doc.createElement("meta");
    meta.name = "discourse-track-view-session-id";
    meta.content = "[[track_view_session_id_placeholder_abc]]";
    doc.head.appendChild(meta);

    expect(readDiscourseTrackViewSessionId(doc)).toBe("");
  });

  it("builds Discourse browser pageview headers for credit topic views", () => {
    expect(
      buildCreditTopicViewHeaders(topic, {
        referrer: "https://linux.do/latest",
        sessionId: "session-123",
      }),
    ).toMatchObject({
      "Discourse-Track-View": "true",
      "Discourse-Track-View-Topic-Id": "42",
      "Discourse-Track-View-Url": "https://linux.do/n/credit-topic/42",
      "Discourse-Track-View-Referrer": "https://linux.do/latest",
      "Discourse-Track-View-Session-Id": "session-123",
      "Discourse-Present": "true",
      "X-Requested-With": "XMLHttpRequest",
    });
  });

  it("prefers native pageBridge track view before content fetch", async () => {
    vi.mocked(requestNativeTopicViewTrack).mockResolvedValue(true);
    const fetchImpl = vi.fn();

    await expect(trackCreditTopicView(topic, fetchImpl as unknown as typeof fetch)).resolves.toBe(true);

    expect(requestNativeTopicViewTrack).toHaveBeenCalledWith({
      topicId: 42,
      slug: "credit-topic",
      topicUrl: "https://linux.do/n/credit-topic/42",
      referrer: "https://linux.do/latest",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falls back to topic json GET when pageBridge track view fails", async () => {
    vi.mocked(requestNativeTopicViewTrack).mockResolvedValue(false);
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await expect(trackCreditTopicView(topic, fetchImpl as unknown as typeof fetch)).resolves.toBe(true);

    expect(fetchImpl).toHaveBeenCalledWith(
      "/t/credit-topic/42.json",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          "Discourse-Track-View": "true",
          "Discourse-Track-View-Topic-Id": "42",
        }),
      }),
    );
  });

  it("schedules credit tracking after dwell time and cancels on dismiss", async () => {
    vi.useFakeTimers();
    const trackView = vi.fn().mockResolvedValue(true);
    const setTrackingState = vi.fn();
    const renderCurrent = vi.fn();
    let topicId: number | null = 42;
    const controller = new TopicViewTrackingController({
      getTopicId: () => topicId,
      setTrackingState,
      renderCurrent,
      dwellMs: 10_000,
      trackView,
    });

    controller.schedule(topic);
    expect(setTrackingState).toHaveBeenCalledWith({
      phase: "countdown",
      startedAt: expect.any(Number),
    });
    expect(renderCurrent).toHaveBeenCalledTimes(1);

    topicId = null;
    controller.cancel();
    expect(setTrackingState).toHaveBeenLastCalledWith({
      phase: null,
      startedAt: null,
    });

    topicId = 42;
    controller.schedule(topic);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(setTrackingState).toHaveBeenCalledWith({
      phase: "requesting",
      startedAt: expect.any(Number),
    });
    await Promise.resolve();

    expect(trackView).toHaveBeenCalledWith(topic);
    expect(setTrackingState).toHaveBeenLastCalledWith({
      phase: null,
      startedAt: null,
    });
    vi.useRealTimers();
  });

  it("skips scheduling when topic is already tracked locally", () => {
    const setTrackingState = vi.fn();
    const renderCurrent = vi.fn();
    const controller = new TopicViewTrackingController({
      getTopicId: () => 42,
      setTrackingState,
      renderCurrent,
      dwellMs: 10_000,
      isAlreadyTracked: (topicId) => topicId === 42,
      trackView: vi.fn(),
    });

    controller.schedule(topic);

    expect(setTrackingState).not.toHaveBeenCalled();
    expect(renderCurrent).not.toHaveBeenCalled();
  });

  it("invokes onTrackSuccess only after a successful credit request", async () => {
    vi.useFakeTimers();
    const trackView = vi.fn().mockResolvedValue(true);
    const onTrackSuccess = vi.fn();
    const controller = new TopicViewTrackingController({
      getTopicId: () => 42,
      setTrackingState: vi.fn(),
      renderCurrent: vi.fn(),
      dwellMs: 10_000,
      trackView,
      onTrackSuccess,
    });

    controller.schedule(topic);
    await vi.advanceTimersByTimeAsync(10_000);
    await Promise.resolve();

    expect(onTrackSuccess).toHaveBeenCalledWith(topic);
    vi.useRealTimers();
  });

  it("does not invoke onTrackSuccess when credit tracking fails", async () => {
    vi.useFakeTimers();
    const onTrackSuccess = vi.fn();
    const controller = new TopicViewTrackingController({
      getTopicId: () => 42,
      setTrackingState: vi.fn(),
      renderCurrent: vi.fn(),
      dwellMs: 10_000,
      trackView: vi.fn().mockResolvedValue(false),
      onTrackSuccess,
    });

    controller.schedule(topic);
    await vi.advanceTimersByTimeAsync(10_000);
    await Promise.resolve();

    expect(onTrackSuccess).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("keeps a failed indicator when credit tracking request fails", async () => {
    vi.useFakeTimers();
    const trackView = vi.fn().mockResolvedValue(false);
    const setTrackingState = vi.fn();
    const renderCurrent = vi.fn();
    const controller = new TopicViewTrackingController({
      getTopicId: () => 42,
      setTrackingState,
      renderCurrent,
      dwellMs: 10_000,
      trackView,
    });

    controller.schedule(topic);
    await vi.advanceTimersByTimeAsync(10_000);
    await Promise.resolve();

    expect(setTrackingState).toHaveBeenLastCalledWith({
      phase: "failed",
      startedAt: expect.any(Number),
    });
    vi.useRealTimers();
  });

  it("retries credit tracking only from failed state", () => {
    const setTrackingState = vi.fn();
    const renderCurrent = vi.fn();
    const controller = new TopicViewTrackingController({
      getTopicId: () => 42,
      setTrackingState,
      renderCurrent,
      dwellMs: 10_000,
      trackView: vi.fn(),
    });

    expect(controller.retry(topic, "countdown")).toBe(false);
    expect(controller.retry(topic, "requesting")).toBe(false);
    expect(controller.retry(topic, null)).toBe(false);
    expect(setTrackingState).not.toHaveBeenCalled();

    expect(controller.retry(topic, "failed")).toBe(true);
    expect(setTrackingState).toHaveBeenCalledWith({
      phase: "countdown",
      startedAt: expect.any(Number),
    });
  });
});
