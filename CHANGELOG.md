# Changelog

All notable changes to **Linux Do It** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `docs/DEVELOPMENT.md` — fresh-clone setup, Playwright browser cache, CI vs local `pnpm check`, troubleshooting.

### Changed

- Contributor docs no longer reference Chrome-EXE / linuxdo-reader migration; removed `docs/RELATIONSHIP.md`.
- `chrome-extension-workspace` skill aligned to single-repo layout at repository root.
- Console warn prefix `[linux-do-it]`; spec and release doc paths corrected.

### Removed

- `scripts/publish-standalone-repo.ps1` (one-time monorepo extraction script).

## [1.0.0] - 2026-07-06

First public release as an independent open-source Chrome extension.

### Added

- Linux.do card, masonry, and Reader views on topic lists.
- Reader modal with comment filter, sort, image viewer, and native reply bridge.
- Side panel search enhancer with normalized topic cards.
- Topic-page native controls, read-state sync, and credit-view tracking.
- SVG source icon (`assets/icon.svg`) with PNG export for Chrome manifest.
- WXT MV3 extension shell with Vitest and Playwright coverage.

### Changed

- Public brand **Linux Do It**.
- Canonical repository: [galaxypluto/linux-do-it](https://github.com/galaxypluto/linux-do-it).

[Unreleased]: https://github.com/galaxypluto/linux-do-it/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/galaxypluto/linux-do-it/releases/tag/v1.0.0
