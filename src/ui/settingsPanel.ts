import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { ExtensionSettings } from "../storage/settings";
import { SettingsPanel } from "./react/components/SettingsPanel";

const SETTINGS_PANEL_HOST_SELECTOR = "[data-settings-panel-host]";
const settingsPanelRoots = new WeakMap<HTMLElement, Root>();

export function settingsPanelTemplate(_settings: ExtensionSettings, open: boolean): string {
  return `<div data-settings-panel-host data-settings-panel-open="${open ? "true" : "false"}"></div>`;
}

export function renderSettingsPanels(root: ShadowRoot | HTMLElement, settings: ExtensionSettings, open: boolean): void {
  root.querySelectorAll<HTMLElement>(SETTINGS_PANEL_HOST_SELECTOR).forEach((host) => {
    let reactRoot = settingsPanelRoots.get(host);
    if (!reactRoot) {
      reactRoot = createRoot(host);
      settingsPanelRoots.set(host, reactRoot);
    }

    host.dataset.settingsPanelOpen = String(open);
    flushSync(() => {
      reactRoot.render(createElement(SettingsPanel, { settings, open }));
    });
  });
}

export function unmountSettingsPanels(root: ShadowRoot | HTMLElement): void {
  root.querySelectorAll<HTMLElement>(SETTINGS_PANEL_HOST_SELECTOR).forEach((host) => {
    const reactRoot = settingsPanelRoots.get(host);
    if (!reactRoot) {
      return;
    }

    flushSync(() => {
      reactRoot.unmount();
    });
    settingsPanelRoots.delete(host);
  });
}
