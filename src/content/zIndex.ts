/**
 * Document-level stacking for card mode (pageStyle.ts).
 *
 * Normal browsing:
 *   extension root (1) < list-controls (2) < Discourse d-header (~1000)
 *
 * Reader / image overlay (html.ldcv-reader-modal-open):
 *   release extension-root stacking so shadow `position: fixed` backdrops
 *   can paint above site chrome via --ldcv-z-reader-backdrop.
 */
export const LDCV_Z_INDEX = {
  extensionRoot: 1,
  listControls: 2,
  nativeDropdown: 2_147_483_001,
  floatingNotice: 2_147_483_645,
  readerBackdrop: 2_147_483_646,
  imageViewer: 2_147_483_647,
} as const;
