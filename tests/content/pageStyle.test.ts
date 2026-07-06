import { afterEach, describe, expect, it } from "vitest";
import {
  ensurePageStyle,
  NATIVE_REPLY_ROOT_PRESERVING_CLASS,
  PAGE_STYLE_ID,
  pageStyleText,
  PRIVATE_MESSAGE_LAYOUT_CLASS,
} from "../../src/content/pageStyle";
import { collectOverlayPageStyleViolations } from "../../src/content/overlayStacking";
import { LDCV_Z_INDEX } from "../../src/content/zIndex";

describe("page style injection", () => {
  afterEach(() => {
    document.getElementById(PAGE_STYLE_ID)?.remove();
  });

  it("injects page style once", () => {
    ensurePageStyle(document);
    ensurePageStyle(document);

    const styles = document.querySelectorAll(`#${PAGE_STYLE_ID}`);
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toContain("html.ldcv-card-mode #main-outlet #list-area");
  });

  it("contains reader overlay and private message layout selectors", () => {
    const css = pageStyleText();

    expect(collectOverlayPageStyleViolations(css)).toEqual([]);
    expect(css).toContain(`html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control`);
    expect(css).toContain("margin: 0 !important");
    expect(css).toContain("button.toggle-preview");
  });

  it("keeps Reader clickable and native composer popups visible in floating composer layout", () => {
    const css = pageStyleText();

    expect(css).toMatch(/html\.ldcv-private-message-compose \.modal-backdrop,[\s\S]*pointer-events:\s*none\s*!important/);
    expect(css).toMatch(/html\.ldcv-private-message-compose #reply-control\s*\{[\s\S]*overflow:\s*visible\s*!important/);
    expect(css).toMatch(/html\.ldcv-private-message-compose #reply-control \.composer-popup\s*\{[\s\S]*overflow:\s*visible\s*!important/);
    expect(css).toMatch(/html\.ldcv-private-message-compose #d-menu-portals\s*\{[\s\S]*z-index:\s*2147483647\s*!important/);
    expect(css).toContain(`html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals .fk-d-menu`);
    expect(css).toContain(`html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals .toolbar-popup-menu-options`);
    expect(css).toContain(`html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals [data-popper-placement]`);
    expect(css).toContain(`html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .emoji-picker`);
    expect(css).toContain(`html.${PRIVATE_MESSAGE_LAYOUT_CLASS} body > .emoji-picker`);
    expect(css).toMatch(/html\.ldcv-private-message-compose #reply-control \.d-editor-button-bar,[\s\S]*z-index:\s*2147483647\s*!important/);
    expect(css).toContain("html.ldcv-card-mode.ldcv-native-reply-route-restoring #main-outlet #topic");
    expect(css).toContain("html.ldcv-card-mode.ldcv-native-reply-route-restoring #main-outlet .topic-post");
    expect(css).toContain(`html.ldcv-card-mode.${NATIVE_REPLY_ROOT_PRESERVING_CLASS} #main-outlet #topic`);
    expect(css).toContain(`html.ldcv-card-mode.${NATIVE_REPLY_ROOT_PRESERVING_CLASS} #main-outlet .topic-post`);
  });

  it("raises native navigation menus without lifting the whole navigation row", () => {
    const css = pageStyleText();

    expect(css).not.toContain("html.ldcv-card-mode .navigation-container,");
    expect(css).not.toContain("html.ldcv-card-mode .list-controls,");
    expect(css).not.toContain("html.ldcv-card-mode .category-breadcrumb {");
    expect(css).toContain("html.ldcv-card-mode .category-breadcrumb > .select-kit");
    expect(css).toContain("html.ldcv-card-mode .category-breadcrumb > details");
    expect(css).toContain("html.ldcv-card-mode .category-breadcrumb > .select-kit.is-expanded");
    expect(css).toContain('html.ldcv-card-mode .category-breadcrumb > .select-kit:has([aria-expanded="true"])');
    expect(css).toContain("html.ldcv-card-mode .select-kit .select-kit-body");
    expect(css).toContain(`z-index: ${LDCV_Z_INDEX.nativeDropdown} !important`);
  });

  it("styles topic page enhancement without hiding the native topic stream", () => {
    const css = pageStyleText();

    expect(css).not.toContain("#linuxdo-topic-enhancer-root");
    expect(css).not.toContain("ldcv-topic-enhancer__index");
    expect(css).toContain("html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls");
    expect(css).toContain("--ldcv-topic-float-size: var(--ldcv-native-notice-height");
    expect(css).toContain("--ldcv-topic-float-bg: var(--ldcv-native-notice-background");
    expect(css).toContain("--ldcv-topic-float-border: var(--ldcv-native-notice-border-color");
    expect(css).toContain("position: fixed !important");
    expect(css).toContain("html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls.is-search-open .ldcv-topic-native-controls__search");
    expect(css).toContain("html.ldcv-topic-enhancer-mode :is(.nested-view__op-article, .nested-post__article).ldcv-topic-post-hidden");
    expect(css).toContain("html.ldcv-topic-native-compact .nested-view__op-article");
    expect(css).toContain("html.ldcv-topic-native-compact .nested-post__article");
    expect(css).toContain("html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .topic-body");
    expect(css).not.toContain(".ldcv-topic-native-controls__sort");
    expect(css).not.toContain("html.ldcv-topic-enhancer-mode .nested-sort-selector__trigger");
    expect(css).not.toContain("html.ldcv-topic-enhancer-mode:has(.ldcv-topic-native-controls.is-search-open) .nested-sort-selector__trigger");
    expect(css).not.toContain("html.ldcv-topic-enhancer-mode .ldcv-topic-op-badge");
    expect(css).not.toContain("html.ldcv-topic-enhancer-mode .ldcv-topic-reply-target");
    expect(css).not.toContain("html.ldcv-topic-enhancer-mode :is(.topic-post, article[data-post-id]).ldcv-topic-post-op .topic-body");
    expect(css).not.toContain("html.ldcv-topic-enhancer-mode #main-outlet #topic");
    expect(css).not.toContain("html.ldcv-topic-enhancer-mode #main-outlet .topic-post {\n      display: none");
  });
});
