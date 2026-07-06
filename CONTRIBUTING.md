# Contributing to Linux Do It

Canonical repository: **https://github.com/galaxypluto/linux-do-it**

## Prerequisites

- Node.js 22 LTS (or current LTS)
- pnpm 9+ (`corepack enable` recommended; version pinned in `package.json`)
- PowerShell 7 on Windows (optional; scripts are `.ps1`)

Full environment details (Playwright browsers, manual QA profiles, CI vs local checks): **[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)**.

## Setup

```powershell
pnpm install
pnpm exec playwright install chromium
```

`pnpm install` alone is not enough for `pnpm check`: Playwright downloads Chromium into a **machine-local cache** (not the repo). Fresh clones must run the install step above unless you already have a matching `ms-playwright/chromium-*` build from another project.

## Development

```powershell
pnpm dev
```

Load `.output/chrome-mv3` in an isolated Chrome profile. For logged-in Linux.do QA:

```powershell
pnpm build
pwsh -File scripts/start-agent-chrome.ps1
```

## Quality gate

```powershell
pnpm check
```

Runs typecheck, unit tests, production build (with icon generation), and Playwright E2E. GitHub Actions CI currently runs typecheck, test, and build only — see [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md#ci-vs-local-pnpm-check).

## Icons

Edit `assets/icon.svg`, then:

```powershell
pnpm icons
```

Chrome manifest requires PNG; SVG is the design source only.

## Code structure

Read [docs/ENGINEERING.md](./docs/ENGINEERING.md) before cross-layer changes.

## Pull requests

- Keep changes focused; match existing layering.
- Update `docs/PERMISSIONS.md` when manifest permissions change.
- Add or update tests when behavior changes.
- Update `CHANGELOG.md` under `[Unreleased]`.

## Security

Never commit `.profiles/`, cookies, tokens, or raw private page captures.
