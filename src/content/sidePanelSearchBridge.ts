import type { TopicCardData } from "../domain/linuxdo/types";
import {
  SidePanelContentMessage,
  type SidePanelContentResponse,
} from "../shared/messaging/messages";

type SendResponse = (response: SidePanelContentResponse) => void;

type SidePanelSearchBridgeDeps = {
  searchTopics: (query: string, page: number) => Promise<unknown>;
  openTopic: (topicId: number, topic: TopicCardData) => Promise<void> | void;
};

export function createSidePanelSearchBridge(deps: SidePanelSearchBridgeDeps) {
  return (rawMessage: unknown, _sender: chrome.runtime.MessageSender, sendResponse: SendResponse): boolean => {
    const parsed = SidePanelContentMessage.safeParse(rawMessage);
    if (!parsed.success) {
      sendResponse({ ok: false, error: "Invalid sidepanel message" });
      return false;
    }

    if (parsed.data.type === "ldcv.searchTopics") {
      void deps
        .searchTopics(parsed.data.query, parsed.data.page ?? 1)
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error: unknown) => {
          sendResponse({ ok: false, error: errorMessage(error, "Search request failed") });
        });
      return true;
    }

    if (parsed.data.topic.id !== parsed.data.topicId) {
      sendResponse({ ok: false, error: "Topic payload id mismatch" });
      return false;
    }

    void Promise.resolve(deps.openTopic(parsed.data.topicId, parsed.data.topic))
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => {
        sendResponse({ ok: false, error: errorMessage(error, "Failed to open topic") });
      });
    return true;
  };
}

export async function fetchLinuxDoSearchJson(
  query: string,
  page = 1,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
  });
  const response = await fetchImpl(`/search.json?${params.toString()}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Linux.do returned ${response.status} for search`);
  }

  return response.json();
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
