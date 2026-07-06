# Architecture

Linux Do It follows the layering described in [`.agents/skills/chrome-extension-workspace/SKILL.md`](../.agents/skills/chrome-extension-workspace/SKILL.md) and [`.trellis/spec/extension/`](../.trellis/spec/extension/index.md).

## Boundaries

- `entrypoints/`: WXT entrypoints and Chrome lifecycle wiring.
- `src/domain/`: Pure Linux.do URL, normalization, and settings types.
- `src/application/`: Use cases (e.g. `LinuxDoApiService`, `SettingsService`).
- `src/ports/`: Storage, HTTP, and cache interfaces.
- `src/adapters/`: Chrome APIs and browser session adapters.
- `src/content/`: Content-script mount, Reader runtime, bridges, topic list state.
- `src/ui/`: Card rendering, Reader React islands, settings panel.
- `src/discourse/`: Discourse JSON fetch, normalize, and reader API.
- `public/pageBridge.js`: Page-context bridge for native composer, reply, like, and bookmark actions.
- `tests/`: Vitest unit tests and Playwright E2E.

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
  → UI render / Reader
  → nativeBridge ↔ pageBridge.js (page context)
  → chrome.storage (settings, read state)

Side panel
  → messaging → content tab
  → LinuxDoApiService → Discourse JSON
```

## Internal identifiers

Some CSS classes use the `ld-reader-*` prefix (Reader UI) and the `ldcv-*` prefix (`base-list.css`). Storage keys and DOM host ids may retain `linuxdo*` / `linuxdo-reader*` strings from earlier internal builds for backward compatibility. These are implementation details, not user-facing branding.
