import { describe, expect, it } from "vitest";
import {
  collectOverlayPageStyleViolations,
  resolveReaderOverlayLockActive,
} from "../../src/content/overlayStacking";
import { pageStyleText } from "../../src/content/pageStyle";

describe("overlay stacking regression contract", () => {
  it("keeps pageStyle overlay rules free of scroll-lock and chrome hijacking regressions", () => {
    const violations = collectOverlayPageStyleViolations(pageStyleText());
    expect(violations).toEqual([]);
  });

  it("activates overlay lock for modal reader and image viewer only", () => {
    expect(
      resolveReaderOverlayLockActive({
        settingsEnabled: true,
        layout: "masonry",
        readerTopicId: 42,
        imageViewerActive: false,
      })
    ).toBe(true);

    expect(
      resolveReaderOverlayLockActive({
        settingsEnabled: true,
        layout: "grid",
        readerTopicId: null,
        imageViewerActive: true,
      })
    ).toBe(true);

    expect(
      resolveReaderOverlayLockActive({
        settingsEnabled: true,
        layout: "reader",
        readerTopicId: 42,
        imageViewerActive: false,
      })
    ).toBe(false);

    expect(
      resolveReaderOverlayLockActive({
        settingsEnabled: false,
        layout: "masonry",
        readerTopicId: 42,
        imageViewerActive: false,
      })
    ).toBe(false);

    expect(
      resolveReaderOverlayLockActive({
        settingsEnabled: true,
        layout: "masonry",
        readerTopicId: null,
        imageViewerActive: false,
      })
    ).toBe(false);
  });

  it("rejects the broken overlay strategy that caused header jump and modal clipping", () => {
    const brokenCss = `
      html.ldcv-card-mode #linuxdo-card-view-root {
        z-index: 1;
      }
      html.ldcv-card-mode #main-outlet .list-controls {
        z-index: 2 !important;
      }
      html.ldcv-reader-modal-open,
      html.ldcv-reader-modal-open body {
        overflow: hidden !important;
      }
      html.ldcv-reader-modal-open #linuxdo-card-view-root {
        z-index: 2147483000 !important;
      }
      html.ldcv-reader-modal-open .d-header {
        z-index: 1 !important;
      }
    `;

    const violations = collectOverlayPageStyleViolations(brokenCss);
    expect(violations).toContain("overlay mode must not lock html/body overflow");
    expect(violations).toContain("overlay mode must not suppress site header z-index");
    expect(violations).toContain("overlay mode must not raise extension root to document overlay layer");
    expect(violations).toContain("overlay mode must release extension root stacking");
  });
});
