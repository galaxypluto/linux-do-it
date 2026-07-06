# Architecture

Linux Do It follows the layering described in [`.agents/skills/chrome-extension-workspace/SKILL.md`](../.agents/skills/chrome-extension-workspace/SKILL.md) and [`.trellis/spec/extension/`](../.trellis/spec/extension/index.md).

## Boundaries

- `entrypoints/`: WXT entrypoints and Chrome lifecycle wiring.
- `src/domain/`: Pure Linux.do URL, normalization, and settings types.
- `src/application/`: Use cases and services (e.g. `LinuxDoApiService`, `SettingsService`).
- `src/ports/`: Storage, HTTP, and cache interfaces.
- `src/adapters/`: Chrome APIs and browser session adapters.
- `src/discourse/`: Discourse JSON fetch, normalize, and reader API helpers.
- `src/sites/`: Site adapters (`linuxdo/`), selectors, fixtures, `_registry.ts`.
- `src/content/`: Content-script mount, Reader runtime, bridges, topic list state.
- `src/ui/`: Card rendering, Reader React islands, settings panel, templates.
- `src/layout/`: Masonry layout and intersection observers.
- `src/preview/`: HTML sanitization before rendering cooked content.
- `src/shared/`: Messaging schemas, credit-view pacing, reply-activity helpers.
- `src/storage/`: Settings persistence helpers (prefer ports/adapters for new code).
- `public/pageBridge.js`: Page-context bridge for native composer, reply, like, and bookmark actions.
- `tests/`: Vitest unit tests and Playwright E2E.

## Content UI host

List routes mount extension UI under `#linuxdo-card-view-root` with an **open shadow root**. Card view, Reader, and settings render inside that shadow tree (`ldcv-*` classes, React islands). Topic-page enhancement on `/n/...` routes patches native Discourse nested DOM outside the shadow host.

## Surfaces

| Surface | Entry | Role |
| --- | --- | --- |
| Content script | `entrypoints/content.ts` → `src/content/mount.ts` | Card view, Reader, topic enhancer |
| Side panel | `entrypoints/sidepanel/` | Linux.do search enhancer |
| Background | `entrypoints/background.ts` | Side panel registration, messaging |
| Debug | `entrypoints/debug/` | Development diagnostics |

## Data flow (simplified)

```text
Linux.do page
  → content script (mount.ts)
  → shadow-root UI render / Reader
  → nativeBridge ↔ pageBridge.js (page context)
  → chrome.storage (settings, read state)

Side panel
  → messaging → content tab
  → LinuxDoApiService → Discourse JSON
```

## Internal identifiers

Active card and Reader UI use the `ldcv-*` prefix (`base-list.css`, `src/ui/render.ts`, React reader components). Storage keys, debug dataset attributes, and some event names may retain `linuxdo*` / `linuxdo-reader*` strings from earlier internal builds for backward compatibility. These are implementation details, not user-facing branding.

## Related docs

- [Development environment](./DEVELOPMENT.md)
- [Engineering boundaries](./ENGINEERING.md)
- [Permissions](./PERMISSIONS.md)
