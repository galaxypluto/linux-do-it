# Engineering boundaries

Layering rules for Linux Do It (summarized from the original Chrome-EXE engineering spec).

## Layers

### `src/domain/`

Pure business rules and types. **Must not** import `chrome.*` or touch the DOM.

### `src/application/` and `src/ports/`

Use cases and interfaces. Application code depends on ports, not concrete Chrome APIs.

### `src/adapters/`

Chrome and browser implementations of ports. **Only layer** that may import `chrome.*` directly (besides WXT entrypoints).

### `src/discourse/`

Linux.do / Discourse JSON fetch and normalization.

### `src/content/` and `src/ui/`

Content-script mount, Reader runtime, templates, and React UI islands.

### `entrypoints/`

WXT lifecycle wiring only — keep thin; boot `src/content/mount.ts` from content entry.

## Stable identifiers (do not rename casually)

- CSS prefix: `ldcv-`
- Storage keys: `linuxdoCardViewSettings`, `linuxdoReaderSettings`, `linuxdoCardViewCreditViewedTopics`, etc.

These predate the Linux Do It brand and preserve user data across upgrades.

## Anti-patterns

- DOM or `window` access inside `src/domain/`.
- Direct `chrome.storage` calls from UI components — use `src/storage/` or adapters.
- Broad host permissions without updating `docs/PERMISSIONS.md`.

## Quality gate

```powershell
pnpm check
```
