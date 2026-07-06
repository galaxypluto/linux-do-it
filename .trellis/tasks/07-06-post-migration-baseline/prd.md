# Post-migration baseline: Trellis, agent dev env, and naming cleanup

## Goal

Land the post–standalone-migration development baseline: Trellis specs/workflow, multi-platform agent bindings, standalone naming alignment, contributor-facing dev docs, and removal of Chrome-EXE / linuxdo-reader migration references from the public repo.

## Requirements

### Committed (done)

- Commit 1: `.trellis/` (workflow, extension specs, scripts, archived bootstrap task, workspace skeleton)
- Commit 2: `AGENTS.md`, `.agents/`, `.claude/`, `.cursor/`, `.codex/`
- Commit 3: `docs/ENGINEERING.md`, `qa.cjs`, `docs/notes/README.md`
- Commit 4: Playwright sandbox browser path fallback

### Pending commit (this session)

- `docs/DEVELOPMENT.md` — fresh-clone environment guide
- Decouple docs/skills from Chrome-EXE / linuxdo-reader (`RELATIONSHIP.md` removed, `publish-standalone-repo.ps1` removed)
- `docs/RELEASE.md`, `.trellis/spec/extension/quality-live-qa.md` path fixes
- Console log prefix `[linux-do-it]`

- Do not commit `.profiles/`, `.env.local`, runtime Trellis state (`.developer`, `.current-task`, `__pycache__`)

## Acceptance Criteria

- [x] Trellis + agent baseline commits on `main`
- [x] `qa.cjs` profile path matches `scripts/start-agent-chrome.ps1` (`manual-linux-do-it-qa`)
- [x] `pnpm check` passes
- [x] No Chrome-EXE / linuxdo-reader references in contributor-facing `docs/` (except documented legacy runtime identifiers in `ARCHITECTURE.md`)
- [x] `docs/DEVELOPMENT.md` documents Playwright install and CI vs local `check`
- [x] Remaining session changes committed and `git status` clean

## Notes

- Existing `v1.0.0` tag unchanged; no new release tag required for infra-only baseline.
- Legacy storage keys / DOM ids (`linuxdo-reader:*`) intentionally kept for user data compatibility.
