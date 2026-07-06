import { LDCV_Z_INDEX } from "./zIndex";
import { READER_SCROLL_LOCK_CLASS } from "./pageStyle";

export interface ReaderOverlayLockInput {
  settingsEnabled: boolean;
  layout: string;
  readerTopicId: number | null;
  imageViewerActive: boolean;
}

/** Modal 或图片查看器打开时，释放 extension root 的 stacking context。 */
export function resolveReaderOverlayLockActive(input: ReaderOverlayLockInput): boolean {
  const modalActive = Boolean(
    input.settingsEnabled && input.layout !== "reader" && input.readerTopicId
  );
  return modalActive || input.imageViewerActive;
}

/**
 * 校验 pageStyle 中的 overlay 层叠契约，防止回归：
 * - 日常：extension root < list-controls，不强行覆盖 d-header
 * - overlay：释放 root stacking，不锁 body 滚动、不抬升 root、不压低站点 chrome
 */
export function collectOverlayPageStyleViolations(css: string): string[] {
  const violations: string[] = [];
  const overlayClass = READER_SCROLL_LOCK_CLASS;

  if (!css.includes(`z-index: ${LDCV_Z_INDEX.extensionRoot};`)) {
    violations.push("card mode extension root must stay at extensionRoot z-index");
  }
  if (!css.includes(`z-index: ${LDCV_Z_INDEX.listControls} !important;`)) {
    violations.push("list-controls must stay above extension root");
  }
  if (css.includes("html.ldcv-card-mode .d-header")) {
    violations.push("must not force d-header z-index in normal card mode");
  }
  if (!css.includes("html.ldcv-card-mode {") || !css.includes("scrollbar-gutter: stable")) {
    violations.push("card mode html must reserve scrollbar gutter");
  }
  if (!css.includes(`html.${overlayClass} #linuxdo-card-view-root`)) {
    violations.push("overlay mode must target extension root");
  }
  if (!css.includes("position: static !important") || !css.includes("z-index: auto !important")) {
    violations.push("overlay mode must release extension root stacking");
  }
  if (css.includes(`html.${overlayClass} body`)) {
    violations.push("overlay mode must not lock html/body overflow");
  }
  if (css.includes(`html.${overlayClass},`)) {
    violations.push("overlay mode must not apply scroll-lock styles to html element");
  }
  if (css.includes(`html.${overlayClass} .d-header`)) {
    violations.push("overlay mode must not suppress site header z-index");
  }
  if (css.includes("extensionOverlayRoot") || css.includes("siteChromeOverlay")) {
    violations.push("removed overlay root / site chrome z-index tokens must not return");
  }
  if (/html\.ldcv-reader-modal-open\s+#linuxdo-card-view-root\s*\{[^}]*z-index:\s*214748/.test(css)) {
    violations.push("overlay mode must not raise extension root to document overlay layer");
  }

  return violations;
}
