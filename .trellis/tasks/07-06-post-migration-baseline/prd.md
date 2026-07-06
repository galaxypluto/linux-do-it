# Post-migration baseline: Trellis, agent dev env, and naming cleanup

## Goal

Land the post–standalone-migration development baseline in three reviewable commits: Trellis specs/workflow, multi-platform agent bindings, and standalone naming alignment.

## Requirements

- Commit 1: `.trellis/` (workflow, extension specs, scripts, archived bootstrap task, workspace skeleton)
- Commit 2: `AGENTS.md`, `.agents/`, `.claude/`, `.cursor/`, `.codex/`
- Commit 3: `docs/ENGINEERING.md`, `qa.cjs`, `docs/notes/README.md`; align chrome-extension-workspace README to standalone repo wording
- Do not commit `.profiles/`, `.env.local`, runtime Trellis state (`.developer`, `.current-task`, `__pycache__`)

## Acceptance Criteria

- [ ] Three commits on `main` with conventional messages as planned
- [ ] `git status` clean after commits (no stray untracked agent/trellis files)
- [ ] `qa.cjs` profile path matches `scripts/start-agent-chrome.ps1` (`manual-linux-do-it-qa`)
- [ ] `pnpm check` passes

## Notes

- Existing `v1.0.0` tag unchanged; no new release tag required for infra-only baseline.
