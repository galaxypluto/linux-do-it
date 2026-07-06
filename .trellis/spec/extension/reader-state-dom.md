# Reader State And DOM

This guide owns Reader state preservation, layout stability, modal/nested-overlay behavior, and animation-sensitive DOM contracts.

Reference files:

- `src/content/mount.ts`
- `src/content/scrollState.ts`
- `src/content/topicListState.ts`
- `src/ui/render.ts`
- `src/ui/readerTemplates.ts`
- `src/styles/content.css`
- `src/styles/reader.css`
- `tests/ui/render.test.ts`
- `tests/ui/imageViewer.test.ts`
- `tests/layout/masonry.test.ts`
- `tests/content/progressiveTopics.test.ts`

## Reader Nested Overlay Preservation

### Scope / Trigger

- A nested overlay such as the image viewer opens from inside an already-open Reader modal.
- A background-only update such as pending-topic notice state changes while modal Reader content itself has not changed.
- A Reader-only state change occurs while grid or masonry background content is visible behind the modal.

### Contracts

- Preserve the existing Reader DOM subtree while a nested overlay is active.
- Restoring or closing a nested overlay must not reset Reader scroll position, loaded posts, search/filter state, or open user preview state.
- Animate nested overlays from the clicked origin independently of Reader open/close motion.
- Closing a nested overlay should update local Reader state and remove only that overlay DOM. Do not call a full content-root render just to close the overlay.
- For modal Reader renders, compute and compare the Reader-content fingerprint. If unchanged, preserve the existing React Reader host across background root renders.
- Preserved Reader hosts must not be rebound with duplicate Reader event listeners.
- Reader modal open/close and nested overlay open/close must not capture or restore page scroll anchors. Page anchor restoration is only for background list mutations that can move existing cards.
- While a modal Reader is open or closing in grid/masonry layouts, keep the background shell/grid/load-more DOM frozen. Reader-only renders may update or remove the overlay, but must not replace the background list in the same frame.
- Bottom intersection observers and progressive topic reveal must not consume background append/reveal work while a modal Reader overlay is active.
- The first load-more intersection at the same scroll position after closing Reader must be suppressed until the user scrolls again.
- Image viewer wheel zoom actions must use raw wheel delta and continuous multiplicative scaling. Toolbar button zoom can stay as bounded step controls.

### Tests Required

- Grid and masonry UI regression test: open Reader image, assert the same `.ldcv-reader-modal` remains mounted, and verify `.ldcv-reader-scroll.scrollTop` is unchanged after opening and closing image viewer.
- Grid and masonry UI regression test: open Reader image and assert the same `.ldcv-shell`, `.ldcv-reader-modal`, and scroll container remain mounted while image viewer is active.
- Unit test image viewer wheel zoom: small wheel deltas produce continuous scale changes smaller than the toolbar step size.
- UI regression test image viewer close: remove `[data-image-viewer-backdrop]` without replacing `.ldcv-shell`, `.ldcv-reader-modal`, or the Reader scroll container.
- UI regression test expanded comment: render a background-only pending-topic notice and assert the same modal/comment nodes remain mounted, the comment remains expanded, and a subsequent toggle changes state only once.
- UI regression test modal Reader + background append: simulate appended/entering topics behind it, close Reader, and assert the same `.ldcv-shell`, `.ldcv-grid`, and `[data-load-more-root]` remain mounted while read state is patched in place.

## Reader Modal Shell Refactors

### Scope / Trigger

- A UI refactor changes the React-owned Reader modal shell, backdrop, surface classes, state attributes, or animation wrapper.
- The refactor intentionally keeps the Reader article body rendered by `readerContentTemplate(...)`.

### Contracts

- Preserve the existing modal selectors: `.ldcv-reader-backdrop`, `.ldcv-reader-modal`, `[data-reader-backdrop]`, and `[data-react-reader-modal="true"]`.
- Keep `readerContentTemplate(...)` output as the direct child content of `.ldcv-reader-modal` until the specific body section is migrated with dedicated tests. Existing CSS and behavior depend on direct children such as `.ldcv-reader-article`, `.ldcv-reader-status`, and `.ldcv-reader-empty`.
- If the React shell adds observability attributes such as `data-reader-shell-state`, synchronize them on the same immediate DOM path as `is-closing` classes. Close motion currently mutates the live DOM before a React re-render.
- Do not move comment search, OP-only, sort, post action, poll vote, image viewer, or user preview controls out of the template as part of a shell-only refactor.
- Shell styling should live with the React shell layer and must not require broad rewrites of `reader.css` content-body selectors.

### Tests Required

- Render test asserting the modal still has the legacy selectors and the new shell state attributes for entering, open, and closing states.
- Preservation tests from Reader Nested Overlay Preservation must still pass after shell changes.
- Typecheck and build must pass because shell components are TSX and bundled through the content script.

### Wrong vs Correct

Wrong:

```tsx
<section className="ldcv-reader-modal">
  <div className="new-shell-body" dangerouslySetInnerHTML={{ __html: contentHtml }} />
</section>
```

Correct:

```tsx
<section
  className="ldcv-reader-modal ldcv-reader-shell"
  data-reader-template-mode="html"
  dangerouslySetInnerHTML={{ __html: contentHtml }}
/>
```

## Masonry And New Topic Layout Stability

- Existing masonry cards must not be re-laid out when appending newly loaded topics.
- Append/reveal code should place only new topics into layout slots; it must not recalculate existing item coordinates unless the user explicitly changes layout mode or viewport width.
- Switching from card/list to masonry must reinitialize the bottom observer after the masonry container exists.
- New-topic refresh may prepare pending topics in memory, but visual reveal must be a controlled append path that preserves existing scroll anchors.
- Masonry bottom loading should feel like card view: the load-more sentinel must use a pre-bottom observer margin and honor intersection immediately, not require an extra downward scroll after the page has already reached the bottom.
- After a next-page fetch succeeds in grid or masonry mode, reveal the first bounded visible batch in the same render that clears loading state; do not wait for a second sentinel intersection before showing newly fetched cards.
- Bottom appends and progressive reveal in grid or masonry must not call page-anchor restoration, because appended cards are below the current reading position and `window.scrollBy(...)` restoration causes visible bounce-back. Reserve page-anchor preservation for changes that insert or expand content above the current viewport.
- Avoid layout work during Reader modal open/close frames. Queue or suppress background load-more work until the modal is closed and user scroll resumes.

Bad cases:

- A large one-time new-topic reveal overlaps masonry cards.
- Background refresh while Reader is open empties the root or scrolls to top.
- Appending new topics recalculates positions for already visible masonry cards.

## Route And Root Preservation

- The extension root is `#linuxdo-card-view-root`.
- The extension root should stay mounted in the list route surface. If Discourse unexpectedly injects topic DOM during a fallback path, hide native topic DOM only during the guarded restore window.
- Preferred fix for Reader-originated reply submit is controlled `/posts.json`, not root-preserving restore after native topic render.
- Route watcher refresh must distinguish real list-route changes from same-route Discourse/composer mutations.

## Animation Performance

- Preserve high-value Reader and card animations, but avoid full root replacement when a local state patch would suffice.
- Do not use broad rerenders to close nested overlays, patch read state, or merge a submitted reply.
- Keep expensive visual effects scoped to elements that actually animate. If a future performance fix changes blur, shadow, or backdrop behavior, verify Reader open/close and image viewer flows in desktop and mobile-sized viewports.

## Content-Control React Islands

### Scope / Trigger

- A refactor moves extension-owned content controls, such as settings panels, toolbar controls, or pending-topic notices, from string templates toward React.
- The content control still participates in existing `data-*` imperative binding or Reader background preservation.

### Contracts

- Do not import `react-dom/server` into the content-script path for compatibility rendering by default. It can add a large content bundle cost for a small UI island.
- Prefer a live `react-dom/client` island when the content script already ships the React client runtime, or use a lightweight local string renderer when lifecycle risk is higher than React migration value.
- Keep a stable host element for each island, such as `[data-settings-panel-host]`, and mount the React panel before binding legacy `data-*` event handlers.
- If the island host is also a runtime sentinel or preserved node, such as `[data-load-more-root]`, keep that exact outer element template-owned and mount React into its children. Do not let React replace the observed/preserved element identity.
- If legacy imperative handlers remain the source of truth, React must only render compatible DOM attributes in that slice. Do not also wire React callbacks for the same setting unless the old handlers are removed in the same tested change.
- Before replacing a root with `innerHTML`, unmount React islands that are still inside that root. If a background subtree is deliberately detached and restored to preserve Reader/image-viewer state, do not unmount that detached subtree unless the task also rebinds its events.
- Keep local motion ownership in the existing DOM mutation path until a dedicated task migrates it. For settings panels, `syncSettingsPanelState(...)` owns `hidden`, `aria-hidden`, and `data-motion-state`.
- If a close helper still directly removes nested pending-notice DOM, keep that removal limited to template-owned nodes. For a React-owned floating notice such as `.ldcv-update-float[data-react-floating-pending-notice="true"]`, close helpers may remove compatibility classes or hide legacy list nodes, but must not remove the React-owned child subtree as the primary close mechanism.

### Tests Required

- Render test proving the old selectors and `data-*` controls still exist after the island mounts.
- Behavior test proving a `data-setting-*` change still reaches the existing settings persistence callback.
- Build-size measurement for content-script output whenever a render strategy changes dependency shape.

### Wrong vs Correct

Wrong:

```ts
import { renderToStaticMarkup } from "react-dom/server";

root.innerHTML = renderToStaticMarkup(<SettingsPanel settings={settings} open={open} />);
bindSettingsControls(root, settings, onSettingsChange);
```

Observer/preservation sentinel example:

Wrong:

```tsx
root.innerHTML = `<div data-topic-load-more-host></div>`;
createRoot(root.querySelector("[data-topic-load-more-host]")!).render(<LoadMoreRoot />);
```

Correct:

```ts
root.innerHTML = `<div class="ldcv-load-more is-idle" data-load-more-root data-topic-load-more-state="idle"></div>`;
renderTopicLoadMore(root);
```

Correct:

```ts
root.innerHTML = settingsPanelHostTemplate(open);
renderSettingsPanels(root, settings, open);
bindSettingsControls(root, settings, onSettingsChange);
```
