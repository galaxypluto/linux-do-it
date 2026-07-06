import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { ExtensionSettings } from "../storage/settings";
import { ToolbarActions, type ToolbarActionsVariant } from "./react/components/ToolbarActions";

const TOOLBAR_ACTIONS_HOST_SELECTOR = "[data-toolbar-actions-host]";
const toolbarActionRoots = new WeakMap<HTMLElement, Root>();

export function toolbarActionsTemplate(
  _settings: ExtensionSettings,
  settingsOpen: boolean,
  variant: ToolbarActionsVariant
): string {
  return `<div data-toolbar-actions-host data-toolbar-actions-variant="${variant}" data-toolbar-actions-open="${
    settingsOpen ? "true" : "false"
  }"></div>`;
}

export function renderToolbarActions(root: ShadowRoot | HTMLElement, settings: ExtensionSettings, settingsOpen: boolean): void {
  root.querySelectorAll<HTMLElement>(TOOLBAR_ACTIONS_HOST_SELECTOR).forEach((host) => {
    const variant = normalizeToolbarActionsVariant(host.dataset.toolbarActionsVariant);
    let reactRoot = toolbarActionRoots.get(host);
    if (!reactRoot) {
      reactRoot = createRoot(host);
      toolbarActionRoots.set(host, reactRoot);
    }

    host.dataset.toolbarActionsVariant = variant;
    host.dataset.toolbarActionsOpen = String(settingsOpen);
    flushSync(() => {
      reactRoot.render(createElement(ToolbarActions, { settings, settingsOpen, variant }));
    });
  });
}

export function unmountToolbarActions(root: ShadowRoot | HTMLElement): void {
  root.querySelectorAll<HTMLElement>(TOOLBAR_ACTIONS_HOST_SELECTOR).forEach((host) => {
    const reactRoot = toolbarActionRoots.get(host);
    if (!reactRoot) {
      return;
    }

    flushSync(() => {
      reactRoot.unmount();
    });
    toolbarActionRoots.delete(host);
  });
}

function normalizeToolbarActionsVariant(value: string | undefined): ToolbarActionsVariant {
  return value === "native" ? "native" : "toolbar";
}
