# Development environment

This document describes how to set up a **fresh clone** of Linux Do It for day-to-day development, quality checks, and logged-in Linux.do QA.

Canonical repository: **https://github.com/galaxypluto/linux-do-it**

## Toolchain

| Tool | Version / note |
| --- | --- |
| Node.js | 22 LTS (or current LTS) |
| pnpm | 9+ (`packageManager` in `package.json` pins `pnpm@9.15.9`; enable via Corepack: `corepack enable`) |
| PowerShell | 7+ optional on Windows; repo scripts under `scripts/` are `.ps1` |
| Python | 3.10+ optional; only needed for Trellis workflow scripts under `.trellis/scripts/` |

The extension itself targets **Chrome Manifest V3** (Chromium-based browsers).

## First-time setup (fresh clone)

```powershell
git clone https://github.com/galaxypluto/linux-do-it.git
cd linux-do-it
pnpm install
pnpm exec playwright install chromium
```

Then verify the full gate:

```powershell
pnpm check
```

`pnpm check` runs, in order: `typecheck` → unit tests (`vitest`) → production `build` (including icon generation) → Playwright E2E.

### What `pnpm install` does *not* include

Node dependencies are installed into `node_modules/`, but **Playwright browser binaries are separate**. They are downloaded by `playwright install` into a global cache on your machine, not into the repository.

If you skip the Playwright install step, `pnpm e2e` and `pnpm check` will fail with an error like *Executable doesn't exist* for `chromium_headless_shell-*` or `chromium-*`.

## npm scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | WXT dev server; writes to `.output/chrome-mv3` |
| `pnpm build` | Production build to `.output/chrome-mv3` |
| `pnpm typecheck` | `wxt prepare` + `tsc --noEmit` |
| `pnpm test` | Vitest unit tests (jsdom) |
| `pnpm e2e` | Playwright: `basic.spec.ts` (headless) + `extension-smoke.spec.ts` (headed, requires build) |
| `pnpm check` | All of the above in sequence |
| `pnpm icons` | Regenerate PNG icons from `assets/icon.svg` |
| `pnpm zip` | Release zip via WXT |

Load the unpacked extension in Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → `.output/chrome-mv3`.

Run `pnpm build` (or `pnpm dev`) before loading or before E2E.

## Playwright browsers

### Version pin

`@playwright/test` is pinned in `package.json` (currently **1.60.0**). The matching Chromium revision is managed by Playwright (e.g. `chromium-1223` under the cache). After upgrading `@playwright/test`, run:

```powershell
pnpm exec playwright install chromium
```

### Default cache locations

Playwright stores browsers outside the repo:

| OS | Typical path |
| --- | --- |
| Windows | `%LOCALAPPDATA%\ms-playwright\` |
| macOS | `~/Library/Caches/ms-playwright/` |
| Linux | `~/.cache/ms-playwright/` |

You may point Playwright at a custom directory:

```powershell
# PowerShell
$env:PLAYWRIGHT_BROWSERS_PATH = "D:\tools\ms-playwright"
pnpm exec playwright install chromium
```

### Reusing an existing install

If you already develop other Playwright projects on the same machine, you often already have a compatible `chromium-*` folder under `ms-playwright`. You do **not** need a second download unless the revision changed.

`playwright.config.ts` includes a small fallback: when the active `PLAYWRIGHT_BROWSERS_PATH` has no Chromium build (for example, an empty IDE sandbox cache), it reuses `%LOCALAPPDATA%\ms-playwright` on Windows if present.

### IDE / agent sandboxes

Some environments (including Cursor agent shells) redirect browser downloads to a temporary cache that starts empty. Symptoms:

- `pnpm test` and `pnpm build` pass
- `pnpm e2e` fails with *Executable doesn't exist* under `...\cursor-sandbox-cache\...\playwright\...`

Fix options:

1. Rely on the `playwright.config.ts` fallback (Windows + existing host `ms-playwright`).
2. Set `PLAYWRIGHT_BROWSERS_PATH` to your real cache before running tests.
3. Run `pnpm exec playwright install chromium` once in a normal (non-sandbox) terminal.

## Logged-in Linux.do manual QA

Unit tests and the current E2E smoke test do **not** require a Linux.do login. For real-site validation, use an **isolated** Chrome profile — never your daily browser profile.

```powershell
pnpm build
pwsh -File scripts/start-agent-chrome.ps1
```

Defaults:

| Setting | Value |
| --- | --- |
| Extension | `.output/chrome-mv3` |
| Profile | `.profiles/manual-linux-do-it-qa` |
| CDP port | `9222` |
| Start URL | `https://linux.do/posted` |

`start-agent-chrome.ps1` prefers **Playwright Chromium** from `ms-playwright` when available, because recent Chrome Stable builds may ignore command-line unpacked extension loading. Override with `CHROME_EXTENSION_DEV_BROWSER` or `CHROME_PATH` if needed.

See also [QA checklist](./QA_CHECKLIST.md) and `.trellis/spec/extension/quality-live-qa.md`.

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `PLAYWRIGHT_BROWSERS_PATH` | Playwright | Custom browser cache directory |
| `CHROME_EXTENSION_DEV_BROWSER` | `scripts/start-agent-chrome.ps1` | Explicit Chrome/Chromium executable |
| `CHROME_PATH` | QA scripts | Fallback browser path |
| `E2E_CHROME_PATH` | Future extension E2E fixtures | Override browser for Playwright persistent context |
| `E2E_USER_DATA_DIR` | Future extension E2E fixtures | Reuse a dedicated Playwright profile directory |

## CI vs local `pnpm check`

GitHub Actions (`.github/workflows/ci.yml`) currently runs on Ubuntu:

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

It does **not** run `pnpm e2e` yet. Locally, `pnpm check` is stricter because it includes Playwright. Contributors should still run `pnpm check` before opening a PR.

## Private local state (do not commit)

These paths are gitignored and stay on your machine only:

| Path | Purpose |
| --- | --- |
| `.profiles/` | Isolated Chrome profiles for manual / logged-in QA |
| `.env.local` | Local secrets or overrides |
| `.output/` | WXT build output |
| `node_modules/` | Dependencies |
| `test-results/`, `playwright-report/` | Playwright artifacts |

Never commit cookies, tokens, passwords, or raw logged-in page captures. See [Contributing](../CONTRIBUTING.md#security).

## AI-assisted development

- [AGENTS.md](../AGENTS.md) — instructions for coding agents working in this repo.
- `.trellis/spec/extension/` — canonical engineering contracts (layering, QA, site adapters).
- `.agents/skills/chrome-extension-workspace/` — Chrome MV3 workflow skill (tests, permissions, live QA).

Initialize Trellis developer identity (optional):

```powershell
python ./.trellis/scripts/init_developer.py <your-name>
```

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Executable doesn't exist` during `pnpm e2e` | Playwright browsers not installed, or sandbox cache empty | `pnpm exec playwright install chromium`, or set `PLAYWRIGHT_BROWSERS_PATH` |
| Extension not loaded in manual QA Chrome | Using Chrome Stable without Playwright Chromium | Let `start-agent-chrome.ps1` pick Playwright Chromium, or set `CHROME_EXTENSION_DEV_BROWSER` |
| `wxt prepare` / type errors after pull | Dependency or generated types drift | `pnpm install`, then `pnpm typecheck` |
| Icons missing in build | PNGs not generated | `pnpm icons` or `pnpm build` (build runs icons first) |

## Related docs

- [Contributing](../CONTRIBUTING.md)
- [Engineering boundaries](./ENGINEERING.md)
- [Architecture](./ARCHITECTURE.md)
- [QA checklist](./QA_CHECKLIST.md)
