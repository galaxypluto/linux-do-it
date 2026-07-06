# Contributing to Linux Do It

Canonical repository: **https://github.com/galaxypluto/linux-do-it**

## Prerequisites

- Node.js 22 LTS (or current LTS)
- pnpm 9+
- PowerShell 7 on Windows (optional; scripts are `.ps1`)

## Setup

```powershell
pnpm install
pnpm exec playwright install chromium
```

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

Runs typecheck, unit tests, production build (with icon generation), and Playwright E2E.

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
