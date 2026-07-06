import { RuntimeMessage } from "../../shared/messaging/messages";
import type { ReplyActivity } from "../../shared/replyActivity";

export function recordReplyActivity(activity: ReplyActivity): Promise<boolean> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        RuntimeMessage.parse({
          type: "reply.activity.record",
          activity
        }),
        (response: { ok?: boolean } | undefined) => {
          resolve(!chrome.runtime.lastError && Boolean(response?.ok));
        }
      );
    } catch {
      resolve(false);
    }
  });
}
