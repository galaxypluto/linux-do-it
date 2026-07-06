# Package Boundaries

`linux-do-it` is a WXT Chrome MV3 extension. It strictly separates domain logic, Chrome adapters, and UI rendering.

Reference files:

- `docs/ARCHITECTURE.md`
- `entrypoints/content.ts`
- `public/pageBridge.js`
- `src/content/mount.ts`
- `src/content/topicPageEnhancer.ts`
- `src/sites/linuxdo/selectors.ts`
- `docs/PERMISSIONS.md`

## Architecture Layers

### `entrypoints/`

WXT and Chrome lifecycle wiring. Keep content entrypoints thin; boot `src/content/mount.ts` from the content entry.

### `src/domain/`

Pure business rules, state interfaces, and constants.

- Must **NOT** import `chrome.*` or DOM APIs.
- Example: `domain/linuxdo/routes.ts` handles pure URL matching logic.

### `src/application/` & `src/ports/`

Use cases and interfaces for external dependencies.

- `ports/` defines what the application needs (e.g. storage port).
- `application/` orchestrates flows without knowing *how* it's rendered or stored.

### `src/adapters/`

Implementations of ports.

- The only place allowed to import `chrome.*` (besides WXT entrypoints).
- Example: Chrome storage adapters.

### `src/discourse/` & `src/sites/`

Site-specific data extraction and API calls.

- `discourse/api.ts` handles raw API fetching and data normalization.
- Linux.do selectors belong in `src/sites/linuxdo/selectors.ts`, not scattered through domain or application code.

### `src/content/` & `src/ui/`

DOM interaction, script injection, and visual components.

- `content/mount.ts` orchestrates the boot process and state synchronization.
- `ui/` handles rendering (Vanilla JS templates and React components).

### `public/pageBridge.js`

Runs in the page context and owns Linux.do/Discourse native private message, reply, like, and bookmark bridges. Page-context bridge code must not assume content-script globals are available.

## Contracts

- New Chrome permissions must update `docs/PERMISSIONS.md`.
- Raw site captures belong under ignored local capture storage; only reviewed sanitized fixtures belong in plugin source/tests.
- Side panel UI is a separate React surface. Do not reuse Linux.do native DOM in the side panel.
- Content-script code must treat page bridge results as external boundary results, not as proof of local success until the result event says success.

### Topic Page Native Enhancer

Scope / trigger:

- Applies when content-script work targets Linux.do native nested topic routes such as `/n/<slug>/<id>`.
- Regular topic routes such as `/t/<slug>/<id>` remain Linux.do native pages; the extension should remove Reader/Card View state there and must not mount topic-page enhancer controls.
- Topic-page enhancement is not the same surface as Card View or the Reader modal/pane.

Signatures:

- Regular topic route parsing uses `parseLinuxDoTopicRoute(location)` from `src/domain/linuxdo/routes.ts`.
- Native nested route parsing uses `parseLinuxDoNestedTopicRoute(location)` from `src/domain/linuxdo/routes.ts`.
- Topic-page mounting uses `mountTopicPageEnhancer({ route, settings, mode })` and `unmountTopicPageEnhancer()` from `src/content/topicPageEnhancer.ts`.

Contracts:

- Prefer Linux.do's native Discourse nested view (`/n/<slug>/<id>`) as the primary extension-owned user-facing topic-reading route.
- Extension-generated user-facing topic links, including Reader "原贴/原帖" links and comment `#<postNumber>` links, should use `/n/<slug>/<id>` or `/n/<slug>/<id>/<postNumber>`.
- Keep `/t/...` only for native Discourse pages, JSON/data endpoints, and page-bridge/native write flows where the native site still expects regular topic URLs.
- Preserve Linux.do's native topic abilities as native behavior: composer, quote flow, anchors, post menus, like/bookmark/reply buttons, share/report/assign/notification controls, suggested topics, and Discourse route behavior must remain native.
- Do not reuse the Reader modal/pane templates as a replacement topic page.
- Do not insert a standalone extension top bar or panel between the topic title and native post stream. Topic controls should embed into existing native topic navigation/timeline affordances when available.
- Topic controls may use a small lower-right floating tool cluster that behaves like native Discourse quick actions. Keep controls compact: search is a circular button that expands into a capsule input, OP-only is a circular button, and previous/next controls are icon capsules.
- Do not render extension-owned sort-order buttons on native nested topic pages. Preserve Linux.do's native nested sort selector in its native position and style.
- On narrow topic viewports, avoid a wide horizontal control row that crosses the post body.
- Do not rebuild the comment tree from Reader-normalized data or `/t/...json` on topic pages.
- On `/t` routes, do not probe `/n/<slug>/<id>.json`, redirect, bridge, or mount enhancer controls; leave the page native.
- On `/n` routes, search, OP-only, and previous/next controls operate over currently rendered native nested posts such as `.nested-view__op-article[data-post-number]` and `.nested-post__article[data-post-number]`.
- Use native nested OP markers such as `.nested-post__op-badge` and the OP article itself. Do not inject extension-owned OP badges or reply-target labels into topic posts.
- Previous/next topic-page navigation follows the native nested posts' current rendered order.
- Topic pages default to Reader-like compact styling over the native nested view without replacing native post markup.

Tests required:

- Unit tests for topic route parsing and topic enhancement model/filter/navigation behavior.
- DOM tests proving native nested posts are filtered/searched without extension-owned tree markup.
- E2E smoke proving `/t` routes stay native with no enhancer controls, `/n` routes mount controls without `#linuxdo-card-view-root` or standalone topic roots.

## Anti-Patterns

- **❌ Mixing DOM logic in `domain` or `adapters`**: Do not read `window.location` in domain functions; pass it as an argument.
- **❌ Calling `chrome.storage` directly in UI**: Always go through `src/storage/` or the appropriate adapter port.
- **❌ Putting site selectors into domain/application modules**.
- **❌ Turning native topic-page enhancement into a Reader replacement page, standalone topic-top bar, or extension-owned comment tree**.
