import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("reader css regressions", () => {
  it("keeps content Tailwind scoped to utilities without preflight", () => {
    const contentCss = readFileSync(resolve(process.cwd(), "src/styles/content.css"), "utf8");
    const reactReaderCss = readFileSync(resolve(process.cwd(), "src/styles/react-reader.css"), "utf8");

    expect(contentCss).toContain('@import "./react-reader.css";');
    expect(reactReaderCss).toContain('@import "tailwindcss/utilities" source(none);');
    expect(reactReaderCss).not.toContain("preflight");
  });

  it("keeps filtered comments visually hidden even when comment blocks set display", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/reader.css"), "utf8");

    expect(css).toContain(".ldcv-reader-comment[hidden]");
    expect(css).toContain(".ldcv-reader-replies[hidden]");
    expect(css).toMatch(/\.ldcv-reader-comment\[hidden\],[\s\S]*display:\s*none\s*!important/);
  });

  it("does not let the three-column reader pane compete with native dropdown z-index", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/reader.css"), "utf8");

    expect(css).toMatch(/\.ldcv-reader-pane\s*\{[\s\S]*z-index:\s*auto;/);
  });

  it("does not compress the list reader grid for native composer reserve", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/reader.css"), "utf8");

    expect(css).not.toMatch(/:host\(\.ldcv-private-message-compose-host\)\s+\.ldcv-reader\s*\{/);
    expect(css).not.toMatch(/\.ldcv-reader\s*\{[\s\S]*--ldcv-private-message-local-reserve/);
    expect(css).toContain(":host(.ldcv-private-message-compose-host) .ldcv-reader-modal");
  });

  it("renders a visible frame for newly refreshed reader replies", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/reader.css"), "utf8");

    expect(css).toContain(".ldcv-reader-comment.is-fresh .ldcv-reader-comment__body");
    expect(css).toContain("@keyframes ldcv-reader-fresh-glow");
  });

  it("keeps reader prose selectable and styles rich cooked content blocks", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles/reader.css"), "utf8");

    expect(css).toMatch(/\.ldcv-reader-prose,[\s\S]*user-select:\s*text;/);
    expect(css).toContain(".ldcv-reader-prose .ldcv-reader-details");
    expect(css).toContain(".ldcv-reader-prose .ldcv-reader-poll");
    expect(css).toContain(".ldcv-reader-poll__option-button");
    expect(css).toContain(".ldcv-reader-poll__voters");
    expect(css).toContain(".ldcv-reader-poll__option-result");
    expect(css).toContain(".ldcv-reader-poll__feedback");
  });

  it("fits the image viewer below the full viewport on first open", () => {
    const imageViewerCss = readFileSync(resolve(process.cwd(), "src/styles/image-viewer.css"), "utf8");
    const responsiveCss = readFileSync(resolve(process.cwd(), "src/styles/responsive.css"), "utf8");

    expect(imageViewerCss).toMatch(/\.ldcv-image-viewer__stage img\s*\{[\s\S]*max-height:\s*min\(82vh,\s*960px\)/);
    expect(imageViewerCss).toMatch(/\.ldcv-image-viewer__stage img\s*\{[\s\S]*max-width:\s*min\(88vw,\s*1280px\)/);
    expect(responsiveCss).toMatch(/\.ldcv-image-viewer__stage img\s*\{[\s\S]*max-height:\s*calc\(100vh - 96px\)/);
    expect(responsiveCss).toMatch(/\.ldcv-image-viewer__stage img\s*\{[\s\S]*max-width:\s*calc\(100vw - 24px\)/);
  });
});
