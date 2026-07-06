# Linux Do It

**Linux Do It** is a Chrome Manifest V3 extension that enhances [Linux.do](https://linux.do) with modern reading workflows: card and masonry topic lists, an in-page Reader, side panel search, read-state sync, and topic-page tools.

> **Disclaimer:** Independent third-party tool — not affiliated with or endorsed by Linux.do.

## Features

- **Card / masonry / Reader views** on topic list routes.
- **Reader modal** with comment filtering, sorting, image viewer, and native reply bridge.
- **Side panel search** through the active Linux.do tab.
- **Read-state and credit-view tracking** with cross-tab sync.
- **Topic-page enhancer** with compact native controls.

## Install

### From source (developer / sideload)

```powershell
git clone https://github.com/galaxypluto/linux-do-it.git
cd linux-do-it
pnpm install
pnpm exec playwright install chromium
pnpm build
```

Load unpacked extension: `chrome://extensions` → Developer mode → **Load unpacked** → `.output/chrome-mv3`

### From release

Download `linux-do-it-v1.0.0.zip` from [GitHub Releases](https://github.com/galaxypluto/linux-do-it/releases), unzip, and load the folder in Chrome.

## Development

```powershell
pnpm install
pnpm exec playwright install chromium   # required for pnpm check / pnpm e2e
pnpm dev
```

See **[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)** for toolchain versions, Playwright browser cache, logged-in QA profile, and troubleshooting.

Quality gate:

```powershell
pnpm check
```

Logged-in Linux.do QA: use an isolated Chrome profile (see `scripts/start-agent-chrome.ps1`). Never use your daily browser profile.

## Docs

- [Development environment](./docs/DEVELOPMENT.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Engineering boundaries](./docs/ENGINEERING.md)
- [Permissions](./docs/PERMISSIONS.md)
- [Release](./docs/RELEASE.md)
- [QA checklist](./docs/QA_CHECKLIST.md)
- [Contributing](./CONTRIBUTING.md)

## License

[MIT](./LICENSE)
