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
pnpm build
```

Load unpacked extension: `chrome://extensions` → Developer mode → **Load unpacked** → `.output/chrome-mv3`

### From release

Download `linux-do-it-v1.0.0.zip` from [GitHub Releases](https://github.com/galaxypluto/linux-do-it/releases), unzip, and load the folder in Chrome.

## Development

```powershell
pnpm install
pnpm dev
```

Quality gate:

```powershell
pnpm check
```

Logged-in Linux.do QA: use an isolated Chrome profile (see `scripts/start-agent-chrome.ps1`). Never use your daily browser profile.

## Relationship to other projects

| Project | Role |
| --- | --- |
| **linux-do-it** (this repo) | Primary maintained extension — card view, Reader, side panel search |
| [linuxdo-reader](https://github.com/galaxypluto/Chrome-EXE/tree/master/plugins/linuxdo-reader) | Earlier baseline in the [Chrome-EXE](https://github.com/galaxypluto/Chrome-EXE) monorepo; not a runtime dependency |

This repository is **canonical**. The Chrome-EXE monorepo no longer vendors the extension source to keep plugin histories separate.

## Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [Engineering boundaries](./docs/ENGINEERING.md)
- [Permissions](./docs/PERMISSIONS.md)
- [Release](./docs/RELEASE.md)
- [QA checklist](./docs/QA_CHECKLIST.md)
- [Contributing](./CONTRIBUTING.md)

## License

[MIT](./LICENSE)
