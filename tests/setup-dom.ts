import { afterEach } from "vitest";
import { unmountFloatingPendingNotices } from "../src/ui/floatingPendingNotice";
import { unmountNativePendingNotices } from "../src/ui/nativePendingNotice";
import { unmountReactReaderModal } from "../src/ui/react/reader/renderReaderModal";
import { unmountReactReaderPane } from "../src/ui/react/reader/renderReaderPane";
import { unmountSettingsPanels } from "../src/ui/settingsPanel";
import { unmountToolbarActions } from "../src/ui/toolbarActions";
import { unmountToolbarPendingNotices } from "../src/ui/toolbarPendingNotice";
import { unmountTopicLoadMore } from "../src/ui/topicLoadMore";

function unmountReactIslands(root: ShadowRoot | HTMLElement): void {
  if (root instanceof ShadowRoot) {
    unmountReactReaderModal(root);
    unmountReactReaderPane(root);
  }
  unmountFloatingPendingNotices(root);
  unmountTopicLoadMore(root);
  unmountToolbarActions(root);
  unmountSettingsPanels(root);
  unmountToolbarPendingNotices(root);
  unmountNativePendingNotices(root);
}

afterEach(async () => {
  for (const element of document.querySelectorAll("*")) {
    if (element.shadowRoot) {
      unmountReactIslands(element.shadowRoot);
    }
  }
  unmountReactIslands(document.body);
  document.body.replaceChildren();
  document.head.replaceChildren();

  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
});
