import { LDCV_Z_INDEX } from "./zIndex";

export const PAGE_STYLE_ID = "linuxdo-card-view-page-style";
export const READER_SCROLL_LOCK_CLASS = "ldcv-reader-modal-open";
export const PRIVATE_MESSAGE_LAYOUT_CLASS = "ldcv-private-message-compose";
export const PRIVATE_MESSAGE_HOST_CLASS = "ldcv-private-message-compose-host";
export const NATIVE_REPLY_ROOT_PRESERVING_CLASS = "ldcv-native-reply-root-preserving";
/** 抬高 Discourse 原生 d-modal，使其盖过 Reader（举报 Flag 等） */
export const NATIVE_MODAL_ELEVATE_CLASS = "ldcv-elevate-native-modal";

export function ensurePageStyle(documentRef: Document = document): void {
  if (documentRef.getElementById(PAGE_STYLE_ID)) {
    return;
  }

  const style = documentRef.createElement("style");
  style.id = PAGE_STYLE_ID;
  style.textContent = pageStyleText();
  (documentRef.head || documentRef.documentElement).appendChild(style);
}

export function pageStyleText(): string {
  return `
    html.ldcv-card-mode #main-outlet #list-area {
      display: none !important;
    }

    html.ldcv-card-mode #main-outlet .topic-list {
      display: none !important;
    }

    html.ldcv-card-mode {
      scrollbar-gutter: stable;
    }

    html.ldcv-card-mode #linuxdo-card-view-root {
      overflow-anchor: none !important;
      position: relative;
      z-index: ${LDCV_Z_INDEX.extensionRoot};
    }

    html.ldcv-card-mode #main-outlet .list-controls,
    html.ldcv-card-mode #main-outlet .navigation-container {
      z-index: ${LDCV_Z_INDEX.listControls} !important;
    }

    html.${READER_SCROLL_LOCK_CLASS} #linuxdo-card-view-root {
      position: static !important;
      z-index: auto !important;
    }

    html.ldcv-card-mode .category-breadcrumb > .select-kit,
    html.ldcv-card-mode .category-breadcrumb > .combo-box,
    html.ldcv-card-mode .category-breadcrumb > details,
    html.ldcv-card-mode .category-breadcrumb > button,
    html.ldcv-card-mode .category-breadcrumb > .btn {
      position: relative !important;
      z-index: ${LDCV_Z_INDEX.nativeDropdown} !important;
    }

    html.ldcv-card-mode .category-breadcrumb > .select-kit.is-expanded,
    html.ldcv-card-mode .category-breadcrumb > .combo-box.is-expanded,
    html.ldcv-card-mode .category-breadcrumb > .select-kit:focus-within,
    html.ldcv-card-mode .category-breadcrumb > .combo-box:focus-within,
    html.ldcv-card-mode .category-breadcrumb > .select-kit:has([aria-expanded="true"]),
    html.ldcv-card-mode .category-breadcrumb > .combo-box:has([aria-expanded="true"]),
    html.ldcv-card-mode .select-kit.is-expanded,
    html.ldcv-card-mode .combo-box.is-expanded {
      position: relative !important;
      z-index: ${LDCV_Z_INDEX.nativeDropdown} !important;
    }

    html.ldcv-card-mode .select-kit .select-kit-body,
    html.ldcv-card-mode .select-kit .select-kit-collection,
    html.ldcv-card-mode .select-kit-collection,
    html.ldcv-card-mode .combo-box .select-kit-body,
    html.ldcv-card-mode .dropdown-menu,
    html.ldcv-card-mode .fk-d-menu,
    html.ldcv-card-mode .menu-panel {
      z-index: ${LDCV_Z_INDEX.nativeDropdown} !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} {
      --ldcv-private-message-gap: 28px;
      --ldcv-private-message-height: min(88vh, 940px);
      --ldcv-private-message-radius: 8px;
      --ldcv-private-message-top: calc((100vh - var(--ldcv-private-message-height)) / 2);
      --ldcv-private-message-width: min(640px, calc(42vw - 56px));
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .composer-popup {
      z-index: 2147483645 !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals {
      pointer-events: auto !important;
      position: relative !important;
      z-index: 2147483647 !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals .fk-d-menu,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals .fk-d-menu__content,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals .fk-d-menu__inner-content,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals .toolbar-popup-menu-options,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals .dropdown-menu,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals .menu-panel,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals .select-kit-body,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals .emoji-picker,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals .emoji-picker-modal,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals .emoji-picker-container,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals [role="dialog"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals [role="menu"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals [role="listbox"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #d-menu-portals [data-popper-placement] {
      pointer-events: auto !important;
      z-index: 2147483647 !important;
    }

    html.ldcv-card-mode.ldcv-native-reply-route-restoring #main-outlet #topic,
    html.ldcv-card-mode.ldcv-native-reply-route-restoring #main-outlet .topic-area,
    html.ldcv-card-mode.ldcv-native-reply-route-restoring #main-outlet .topic-navigation,
    html.ldcv-card-mode.ldcv-native-reply-route-restoring #main-outlet .topic-post,
    html.ldcv-card-mode.ldcv-native-reply-route-restoring #main-outlet article[data-post-id],
    html.ldcv-card-mode.${NATIVE_REPLY_ROOT_PRESERVING_CLASS} #main-outlet #topic,
    html.ldcv-card-mode.${NATIVE_REPLY_ROOT_PRESERVING_CLASS} #main-outlet .topic-area,
    html.ldcv-card-mode.${NATIVE_REPLY_ROOT_PRESERVING_CLASS} #main-outlet .topic-navigation,
    html.ldcv-card-mode.${NATIVE_REPLY_ROOT_PRESERVING_CLASS} #main-outlet .topic-post,
    html.ldcv-card-mode.${NATIVE_REPLY_ROOT_PRESERVING_CLASS} #main-outlet article[data-post-id] {
      display: none !important;
    }

    html.ldcv-topic-enhancer-mode {
      --ldcv-topic-float-size: var(--ldcv-native-notice-height, 40px);
      --ldcv-topic-float-gap: 8px;
      --ldcv-topic-float-right: max(36px, calc(env(safe-area-inset-right, 0px) + 24px));
      --ldcv-topic-float-bottom: max(96px, calc(env(safe-area-inset-bottom, 0px) + 76px));
      --ldcv-topic-float-search-width: 248px;
      --ldcv-topic-float-row-gap: 16px;
      --ldcv-topic-float-jump-width: 77px;
      --ldcv-topic-float-op-offset: calc(var(--ldcv-topic-float-jump-width) + var(--ldcv-topic-float-gap));
      --ldcv-topic-float-radius: var(--ldcv-native-notice-radius, 999px);
      --ldcv-topic-float-bg: var(--ldcv-native-notice-background, var(--primary-low, rgba(0, 0, 0, 0.08)));
      --ldcv-topic-float-border: var(--ldcv-native-notice-border-color, transparent);
      --ldcv-topic-float-color: var(--tertiary, var(--ldcv-native-notice-color, #6f7480));
      --ldcv-topic-float-hover-bg: var(--ldcv-native-notice-background, var(--primary-low, rgba(0, 0, 0, 0.08)));
      --ldcv-topic-float-hover-border: var(--ldcv-native-notice-hover-border-color, var(--ldcv-topic-float-color));
      --ldcv-topic-float-hover-color: var(--ldcv-native-notice-color, var(--primary, #172033));
      --ldcv-topic-float-font-family: var(--ldcv-native-notice-font-family, inherit);
      --ldcv-topic-float-font-size: var(--ldcv-native-notice-font-size, 12px);
      --ldcv-topic-float-font-weight: var(--ldcv-native-notice-font-weight, 820);
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls {
      align-items: flex-end !important;
      bottom: var(--ldcv-topic-float-bottom) !important;
      box-sizing: border-box !important;
      color: var(--primary, #172033) !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 4px !important;
      max-width: calc(100vw - 32px) !important;
      pointer-events: none !important;
      position: fixed !important;
      right: var(--ldcv-topic-float-right) !important;
      width: auto !important;
      z-index: 2147483000 !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls * {
      box-sizing: border-box !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__summary {
      background: transparent !important;
      border: 0 !important;
      border-radius: 999px !important;
      color: var(--primary-medium, rgba(15, 23, 42, 0.62)) !important;
      display: none !important;
      height: 0 !important;
      font-size: 11px !important;
      font-weight: 720 !important;
      line-height: 14px !important;
      max-width: 260px !important;
      opacity: 0 !important;
      overflow: hidden !important;
      padding: 0 6px !important;
      pointer-events: none !important;
      text-overflow: ellipsis !important;
      transition: height 140ms ease, opacity 140ms ease !important;
      white-space: nowrap !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls.is-status .ldcv-topic-native-controls__summary {
      height: 0 !important;
      opacity: 0 !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__cluster {
      display: block !important;
      height: calc((var(--ldcv-topic-float-size) * 2) + var(--ldcv-topic-float-row-gap)) !important;
      max-width: min(var(--ldcv-topic-float-search-width), calc(100vw - 32px)) !important;
      padding: 0 !important;
      pointer-events: auto !important;
      position: relative !important;
      width: min(var(--ldcv-topic-float-search-width), calc(100vw - 32px)) !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__icon,
    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__jump {
      background: var(--ldcv-topic-float-bg) !important;
      border: 1px solid var(--ldcv-topic-float-border) !important;
      box-shadow: none !important;
      color: var(--ldcv-topic-float-color) !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__icon,
    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__jump button {
      align-items: center !important;
      border-radius: var(--ldcv-topic-float-radius) !important;
      cursor: pointer !important;
      display: inline-flex !important;
      font-family: var(--ldcv-topic-float-font-family) !important;
      font-size: var(--ldcv-topic-float-font-size) !important;
      font-weight: var(--ldcv-topic-float-font-weight) !important;
      height: var(--ldcv-topic-float-size) !important;
      justify-content: center !important;
      line-height: 1 !important;
      min-width: var(--ldcv-topic-float-size) !important;
      padding: 0 !important;
      width: var(--ldcv-topic-float-size) !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__icon {
      border: 1px solid var(--ldcv-topic-float-border) !important;
    }

    html.ldcv-topic-enhancer-mode [data-topic-enhancer-op-only] {
      position: absolute !important;
      right: var(--ldcv-topic-float-op-offset) !important;
      top: calc(var(--ldcv-topic-float-size) + var(--ldcv-topic-float-row-gap)) !important;
      border-radius: 50% !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__icon svg,
    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__jump svg {
      fill: currentColor !important;
      height: 18px !important;
      width: 18px !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__icon:hover,
    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__icon.is-active,
    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__jump button:hover {
      background: var(--ldcv-topic-float-hover-bg) !important;
      border-color: var(--ldcv-topic-float-hover-border) !important;
      color: var(--ldcv-topic-float-hover-color) !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__icon:disabled,
    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__jump button:disabled {
      cursor: default !important;
      opacity: 0.45 !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__search {
      align-items: center !important;
      background: var(--ldcv-topic-float-bg) !important;
      border: 1px solid var(--ldcv-topic-float-border) !important;
      border-radius: var(--ldcv-topic-float-radius) !important;
      box-shadow: none !important;
      display: flex !important;
      gap: 0 !important;
      height: var(--ldcv-topic-float-size) !important;
      overflow: hidden !important;
      position: absolute !important;
      right: 0 !important;
      top: 0 !important;
      transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.2s ease, background 0.2s ease, box-shadow 0.3s ease !important;
      width: var(--ldcv-topic-float-size) !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__search .ldcv-topic-native-controls__icon {
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
      color: var(--ldcv-topic-float-color) !important;
      flex: 0 0 var(--ldcv-topic-float-size) !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__search input {
      appearance: none !important;
      background: transparent !important;
      border: 0 !important;
      color: var(--primary, #172033) !important;
      flex: 1 1 auto !important;
      font-size: 13px !important;
      font-weight: 620 !important;
      height: 100% !important;
      line-height: var(--ldcv-topic-float-size) !important;
      min-width: 0 !important;
      opacity: 0 !important;
      outline: none !important;
      padding: 0 14px 0 0 !important;
      pointer-events: none !important;
      transition: opacity 0.3s ease 0.05s !important;
      width: 0 !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls.is-search-open .ldcv-topic-native-controls__search {
      background: var(--ldcv-topic-float-bg) !important;
      border-color: var(--ldcv-topic-float-color) !important;
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--tertiary) 25%, transparent), 0 4px 16px rgba(0,0,0,0.12) !important;
      width: min(var(--ldcv-topic-float-search-width), calc(100vw - 32px)) !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls.is-search-open .ldcv-topic-native-controls__search input {
      opacity: 1 !important;
      pointer-events: auto !important;
      width: auto !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__jump {
      border-radius: 999px !important;
      display: inline-flex !important;
      flex-direction: row !important;
      height: var(--ldcv-topic-float-size) !important;
      overflow: hidden !important;
      position: absolute !important;
      right: 0 !important;
      top: calc(var(--ldcv-topic-float-size) + var(--ldcv-topic-float-row-gap)) !important;
      width: var(--ldcv-topic-float-jump-width) !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__jump button {
      background: transparent !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      flex: 1 1 0 !important;
      min-width: 0 !important;
      width: auto !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__jump button:first-child {
      border-radius: 999px 0 0 999px !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__jump button:last-child {
      border-radius: 0 999px 999px 0 !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__jump button + button {
      border-left: 0 !important;
      border-top: 0 !important;
      position: relative !important;
    }

    html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__jump button + button::before {
      content: "" !important;
      position: absolute !important;
      left: 0 !important;
      top: 25% !important;
      bottom: 25% !important;
      width: 1px !important;
      background: var(--ldcv-topic-float-color) !important;
      opacity: 0.2 !important;
    }

    html.ldcv-topic-enhancer-mode :is(.topic-post, article[data-post-id], .nested-view__op-article, .nested-post__article).ldcv-topic-post-enhanced {
      transition: opacity 140ms ease, outline-color 140ms ease, background 140ms ease !important;
    }

    html.ldcv-topic-enhancer-mode :is(.topic-post, article[data-post-id], .nested-view__op-article, .nested-post__article).ldcv-topic-post-match {
      outline: none !important;
      border-radius: 8px !important;
      position: relative !important;
      z-index: 2 !important;
    }

    html.ldcv-topic-enhancer-mode :is(.topic-post, article[data-post-id], .nested-view__op-article, .nested-post__article).ldcv-topic-post-match::before {
      content: "" !important;
      position: absolute !important;
      top: -2px !important;
      bottom: -2px !important;
      left: -5px !important;
      right: -2px !important;
      box-shadow: 0 0 0 1px var(--tertiary), 0 0 16px 4px color-mix(in srgb, var(--tertiary) 30%, transparent) !important;
      border-radius: 10px !important;
      pointer-events: none !important;
      z-index: -1 !important;
    }

    html.ldcv-topic-enhancer-mode :is(.nested-view__op-article, .nested-post__article).ldcv-topic-post-hidden {
      display: none !important;
    }

    html.ldcv-topic-enhancer-mode :is(.topic-post, article[data-post-id]).ldcv-topic-post-hidden {
      opacity: 0.34 !important;
    }

    html.ldcv-topic-enhancer-mode :is(.topic-post, article[data-post-id]).ldcv-topic-post-hidden:hover,
    html.ldcv-topic-enhancer-mode :is(.topic-post, article[data-post-id]).ldcv-topic-post-hidden:focus-within {
      opacity: 0.78 !important;
    }

    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced {
      margin-bottom: 4px !important;
      padding-top: 2px !important;
    }

    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .topic-avatar {
      padding-top: 8px !important;
      width: 42px !important;
    }

    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .topic-avatar img,
    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .topic-avatar .avatar {
      height: 34px !important;
      width: 34px !important;
    }

    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .topic-body {
      border-top-color: color-mix(in srgb, var(--primary, #172033) 9%, transparent) !important;
      margin-left: calc(var(--ldcv-topic-reply-depth, 0) * 18px) !important;
      padding-bottom: 8px !important;
      padding-top: 8px !important;
      transition: margin-left 140ms ease !important;
    }

    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced[data-ldcv-reply-depth]:not([data-ldcv-reply-depth="0"]) .topic-body {
      background: color-mix(in srgb, var(--secondary, #fff) 96%, var(--primary, #172033) 4%) !important;
      border-radius: 8px !important;
      padding-left: 10px !important;
      padding-right: 10px !important;
    }

    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .topic-meta-data,
    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .names,
    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .post-infos {
      align-items: center !important;
      gap: 6px !important;
      min-height: 0 !important;
    }

    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .cooked {
      font-size: 15px !important;
      line-height: 1.52 !important;
    }

    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .cooked > :first-child {
      margin-top: 0 !important;
    }

    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .cooked > :last-child {
      margin-bottom: 0 !important;
    }

    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .post-menu-area,
    html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .actions {
      margin-top: 4px !important;
    }

    html.ldcv-topic-native-compact .nested-view {
      --ldcv-nested-compact-gap: 7px;
    }

    html.ldcv-topic-native-compact .nested-view__op-article,
    html.ldcv-topic-native-compact .nested-post__article {
      margin-bottom: var(--ldcv-nested-compact-gap) !important;
    }

    html.ldcv-topic-native-compact .nested-post {
      margin-top: 0 !important;
    }

    html.ldcv-topic-native-compact .nested-post__main,
    html.ldcv-topic-native-compact .nested-post__content {
      min-width: 0 !important;
    }

    html.ldcv-topic-native-compact .nested-post__header,
    html.ldcv-topic-native-compact .nested-view__op-article .topic-meta-data {
      align-items: center !important;
      gap: 6px !important;
      min-height: 0 !important;
    }

    html.ldcv-topic-native-compact .nested-post__content .cooked,
    html.ldcv-topic-native-compact .nested-view__op-article .cooked {
      font-size: 15px !important;
      line-height: 1.52 !important;
    }

    html.ldcv-topic-native-compact .nested-post__content .cooked > :first-child,
    html.ldcv-topic-native-compact .nested-view__op-article .cooked > :first-child {
      margin-top: 0 !important;
    }

    html.ldcv-topic-native-compact .nested-post__content .cooked > :last-child,
    html.ldcv-topic-native-compact .nested-view__op-article .cooked > :last-child {
      margin-bottom: 0 !important;
    }

    html.ldcv-topic-native-compact .nested-post__menu,
    html.ldcv-topic-native-compact .nested-view__op-article .post-menu-area {
      margin-top: 4px !important;
    }

    @media (max-width: 760px) {
      html.ldcv-topic-enhancer-mode {
        --ldcv-topic-float-right: max(14px, calc(env(safe-area-inset-right, 0px) + 14px));
        --ldcv-topic-float-bottom: max(84px, calc(env(safe-area-inset-bottom, 0px) + 64px));
        --ldcv-topic-float-search-width: 224px;
      }

      html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls__cluster {
        max-width: min(var(--ldcv-topic-float-search-width), calc(100vw - 24px)) !important;
        width: min(var(--ldcv-topic-float-search-width), calc(100vw - 24px)) !important;
      }

      html.ldcv-topic-enhancer-mode .ldcv-topic-native-controls.is-search-open .ldcv-topic-native-controls__search {
        width: min(var(--ldcv-topic-float-search-width), calc(100vw - 24px)) !important;
      }

      html.ldcv-topic-native-compact .topic-post.ldcv-topic-post-enhanced .topic-body {
        margin-left: calc(var(--ldcv-topic-reply-depth, 0) * 10px) !important;
      }
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .modal-backdrop,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .d-modal-backdrop,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .d-modal__backdrop,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .dialog-overlay,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .dialog-backdrop,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .d-dialog-backdrop {
      pointer-events: none !important;
      z-index: 2147483642 !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #discourse-modal,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .d-modal,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .d-modal__container,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .dialog-holder,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .dialog-container,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .modal,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .modal-container,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} .modal-outer-container,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} body > [role="dialog"] {
      pointer-events: auto !important;
      z-index: 2147483647 !important;
    }

    /* Reader 打开时抬高原生 Flag/登录等 d-modal，避免被 Reader 遮住 */
    html.${NATIVE_MODAL_ELEVATE_CLASS} .modal-backdrop,
    html.${NATIVE_MODAL_ELEVATE_CLASS} .d-modal-backdrop,
    html.${NATIVE_MODAL_ELEVATE_CLASS} .d-modal__backdrop,
    html.${NATIVE_MODAL_ELEVATE_CLASS} .dialog-overlay,
    html.${NATIVE_MODAL_ELEVATE_CLASS} .dialog-backdrop,
    html.${NATIVE_MODAL_ELEVATE_CLASS} .d-dialog-backdrop {
      z-index: 2147483646 !important;
    }

    html.${NATIVE_MODAL_ELEVATE_CLASS} #discourse-modal,
    html.${NATIVE_MODAL_ELEVATE_CLASS} .d-modal,
    html.${NATIVE_MODAL_ELEVATE_CLASS} .d-modal__container,
    html.${NATIVE_MODAL_ELEVATE_CLASS} .dialog-holder,
    html.${NATIVE_MODAL_ELEVATE_CLASS} .dialog-container,
    html.${NATIVE_MODAL_ELEVATE_CLASS} .modal,
    html.${NATIVE_MODAL_ELEVATE_CLASS} .modal-container,
    html.${NATIVE_MODAL_ELEVATE_CLASS} .modal-outer-container,
    html.${NATIVE_MODAL_ELEVATE_CLASS} body > [role="dialog"] {
      z-index: 2147483647 !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control {
      border-radius: var(--ldcv-private-message-radius) !important;
      bottom: auto !important;
      box-sizing: border-box !important;
      height: var(--ldcv-private-message-height) !important;
      left: var(--ldcv-private-message-left, var(--ldcv-private-message-gap)) !important;
      margin: 0 !important;
      max-height: var(--ldcv-private-message-height) !important;
      max-width: var(--ldcv-private-message-width) !important;
      min-width: 360px !important;
      overflow: visible !important;
      position: fixed !important;
      right: auto !important;
      top: var(--ldcv-private-message-top) !important;
      width: var(--ldcv-private-message-width) !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .composer-popup {
      border-radius: inherit !important;
      box-sizing: border-box !important;
      height: 100% !important;
      max-height: 100% !important;
      overflow: visible !important;
      width: 100% !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .reply-area,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .composer-fields,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor-container,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor-textarea-wrapper,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .submit-panel {
      box-sizing: border-box !important;
      max-width: 100% !important;
      min-width: 0 !important;
      width: 100% !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .composer-action-title {
      box-sizing: border-box !important;
      min-width: 0 !important;
      padding-right: 44px !important;
      position: relative !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .composer-action-title button.close,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .composer-action-title [title*="关闭"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .composer-action-title [aria-label*="关闭"] {
      left: auto !important;
      position: absolute !important;
      right: 0 !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      z-index: 2 !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .composer-controls {
      align-items: center !important;
      display: flex !important;
      flex: 0 0 auto !important;
      gap: 8px !important;
      justify-content: flex-end !important;
      margin-left: auto !important;
      max-width: max-content !important;
      min-width: 0 !important;
      width: auto !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .composer-controls button.cancel,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .composer-controls button.close,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .composer-controls [title*="关闭"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .composer-controls [aria-label*="关闭"] {
      flex: 0 0 auto !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor-container {
      display: flex !important;
      flex-direction: column !important;
      gap: 12px !important;
      min-height: 0 !important;
      overflow: visible !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor-button-bar,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor-modal,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor-popup,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .toolbar-popup-menu,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .select-kit,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .select-kit-body,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .dropdown-menu,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .fk-d-menu,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .menu-panel,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .emoji-picker,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .emoji-picker-modal,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .emoji-picker-container,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} body > .emoji-picker,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} body > .emoji-picker-modal,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} body > .emoji-picker-container,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} body > .select-kit-body,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} body > .dropdown-menu,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} body > .fk-d-menu,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} body > .menu-panel {
      pointer-events: auto !important;
      z-index: 2147483647 !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor-textarea-wrapper,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor-preview-wrapper {
      box-sizing: border-box !important;
      max-width: none !important;
      width: 100% !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor-textarea-wrapper {
      margin: 0 !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor-preview-wrapper {
      background: var(--secondary, rgba(0, 0, 0, 0.04)) !important;
      border: 1px solid var(--primary-low, rgba(0, 0, 0, 0.12)) !important;
      border-radius: 8px !important;
      margin: 0 !important;
      max-height: 30vh !important;
      min-height: 120px !important;
      overflow: auto !important;
      padding: 14px !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor-preview {
      box-sizing: border-box !important;
      margin: 0 !important;
      max-width: 100% !important;
      padding: 0 !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .d-editor-input,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control textarea {
      box-sizing: border-box !important;
      min-height: 180px !important;
      width: 100% !important;
    }

    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control button.toggle-preview,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control button.toggle-preview-button,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control button.fullscreen,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control button.fullscreen-tablet,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control button.minimize,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .toggle-preview,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .toggle-fullscreen,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control .composer-action-minimize,
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control [title*="切换速览"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control [aria-label*="切换速览"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control [title*="显示预览"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control [aria-label*="显示预览"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control [title*="隐藏预览"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control [aria-label*="隐藏预览"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control [title*="全屏"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control [aria-label*="全屏"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control [title*="最小化编辑器"],
    html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control [aria-label*="最小化编辑器"] {
      display: none !important;
    }

    @media (max-width: 1180px) {
      html.${PRIVATE_MESSAGE_LAYOUT_CLASS} {
        --ldcv-private-message-gap: 12px;
        --ldcv-private-message-height: min(70vh, 680px);
        --ldcv-private-message-top: calc(100vh - var(--ldcv-private-message-height) - var(--ldcv-private-message-gap));
        --ldcv-private-message-width: calc(100vw - 24px);
      }

      html.${PRIVATE_MESSAGE_LAYOUT_CLASS} #reply-control {
        min-width: 0 !important;
      }
    }
  `;
}

/* UI update applied */
