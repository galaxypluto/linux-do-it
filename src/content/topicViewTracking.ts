import type { TopicCardData } from "../discourse/types";
import type { CreditViewTrackingPhase } from "../ui/readerTypes";
import {
  CREDIT_TOPIC_VIEW_DWELL_MS,
  CREDIT_TOPIC_VIEW_REQUEST_TIMEOUT_MS,
} from "../shared/creditViewTracking";
import { requestNativeTopicViewTrack } from "./nativeBridge";

export { CREDIT_TOPIC_VIEW_DWELL_MS, CREDIT_TOPIC_VIEW_REQUEST_TIMEOUT_MS };
const JSON_HEADERS = {
  Accept: "application/json",
};

type TopicViewTrackingState = {
  phase: CreditViewTrackingPhase | null;
  startedAt: number | null;
};

type TopicViewTrackingDeps = {
  getTopicId: () => number | null;
  setTrackingState: (state: TopicViewTrackingState) => void;
  renderCurrent: () => void;
  dwellMs?: number;
  getDwellMs?: () => number;
  isAlreadyTracked?: (topicId: number) => boolean;
  onTrackSuccess?: (topic: TopicCardData) => void;
  trackView?: (topic: TopicCardData) => Promise<boolean>;
};
export function readDiscourseTrackViewSessionId(doc: Document = document): string {
  const content = doc.querySelector('meta[name="discourse-track-view-session-id"]')?.getAttribute("content") ?? "";
  if (!content || content.includes("track_view_session_id_placeholder")) {
    return "";
  }
  return content;
}

export function buildCreditTopicViewHeaders(
  topic: TopicCardData,
  {
    referrer = window.location.href,
    sessionId = readDiscourseTrackViewSessionId(),
  }: { referrer?: string; sessionId?: string } = {},
): Record<string, string> {
  const topicUrl = new URL(topic.url, window.location.origin).href;
  const headers: Record<string, string> = {
    ...JSON_HEADERS,
    "X-Requested-With": "XMLHttpRequest",
    "Discourse-Track-View": "true",
    "Discourse-Track-View-Topic-Id": String(topic.id),
    "Discourse-Track-View-Url": topicUrl,
    "Discourse-Track-View-Referrer": referrer,
    "Discourse-Present": "true",
  };

  if (sessionId) {
    headers["Discourse-Track-View-Session-Id"] = sessionId;
  }

  return headers;
}

export async function trackCreditTopicView(
  topic: TopicCardData,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const topicUrl = new URL(topic.url, window.location.origin).href;
  const nativeOk = await requestNativeTopicViewTrack({
    topicId: topic.id,
    slug: topic.slug,
    topicUrl,
    referrer: window.location.href,
  });
  if (nativeOk) {
    return true;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CREDIT_TOPIC_VIEW_REQUEST_TIMEOUT_MS);

  try {
    // pageBridge 不可用时回退：在 content script 上下文附带 Track-View 头发起 JSON 请求
    const response = await fetchImpl(`/t/${topic.slug}/${topic.id}.json`, {
      credentials: "include",
      headers: buildCreditTopicViewHeaders(topic),
      signal: controller.signal,
    });
    return response.ok;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.warn(`[linuxdo-reader] Credit topic view request timed out for ${topic.id}`);
    } else {
      console.warn(`[linuxdo-reader] Failed to track credit topic view for ${topic.id}:`, error);
    }
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

export class TopicViewTrackingController {
  private timer: number | null = null;

  constructor(private readonly deps: TopicViewTrackingDeps) {}

  schedule(topic: TopicCardData): void {
    if (this.deps.isAlreadyTracked?.(topic.id)) {
      return;
    }

    this.cancel({ render: false });
    const startedAt = Date.now();
    this.deps.setTrackingState({ phase: "countdown", startedAt });
    this.deps.renderCurrent();

    const dwellMs = this.resolveDwellMs();
    this.timer = window.setTimeout(() => {
      this.timer = null;
      if (this.deps.getTopicId() !== topic.id) {
        return;
      }

      this.deps.setTrackingState({ phase: "requesting", startedAt });
      this.deps.renderCurrent();

      void (this.deps.trackView ?? trackCreditTopicView)(topic).then((ok) => {
        if (this.deps.getTopicId() !== topic.id) {
          return;
        }
        if (ok) {
          this.deps.onTrackSuccess?.(topic);
          this.deps.setTrackingState({ phase: null, startedAt: null });
        } else {
          this.deps.setTrackingState({ phase: "failed", startedAt });
        }
        this.deps.renderCurrent();
      });
    }, dwellMs);
  }

  private resolveDwellMs(): number {
    if (this.deps.getDwellMs) {
      return this.deps.getDwellMs();
    }
    return this.deps.dwellMs ?? CREDIT_TOPIC_VIEW_DWELL_MS;
  }

  cancel({ render = true }: { render?: boolean } = {}): void {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.deps.setTrackingState({ phase: null, startedAt: null });
    if (render) {
      this.deps.renderCurrent();
    }
  }

  retry(topic: TopicCardData, phase: CreditViewTrackingPhase | null | undefined): boolean {
    if (phase !== "failed") {
      return false;
    }
    this.schedule(topic);
    return true;
  }
}