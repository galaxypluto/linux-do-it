import { RuntimeMessage } from "../../shared/messaging/messages";

export interface OpenLinuxDoTabOptions {
  active?: boolean;
}

export function openLinuxDoTopicTab(url: string, options: OpenLinuxDoTabOptions = {}): Promise<boolean> {
  const tabUrl = linuxDoTopicUrl(url);
  if (!tabUrl || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        RuntimeMessage.parse({
          type: "tab.open",
          url: tabUrl,
          active: options.active ?? false
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

function linuxDoTopicUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "linux.do" ||
      (!url.pathname.startsWith("/n/") && !url.pathname.startsWith("/t/"))
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
