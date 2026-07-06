# Agent Instructions

Read this file before changing the project.

## Collaboration Rules

- Treat user instructions as hypotheses unless explicitly marked as hard requirements.
- Prefer the smallest correct change that keeps the project evolvable.
- After implementation, review the diff for correctness, regressions, and accidental behavior changes.
- If `./code_review.md` exists, read and follow it before declaring work complete.

## Chrome Extension Development

This repository is the **Linux Do It** WXT Chrome MV3 extension for Linux.do.

Before implementing:

- Read `.trellis/spec/extension/index.md` and the guideline file that owns the behavior you are changing.
- Follow `.agents/skills/chrome-extension-workspace/SKILL.md` for MV3, layering, permissions, tests, and live QA.
- Read `docs/ARCHITECTURE.md` and `docs/PERMISSIONS.md` when touching architecture or permissions.

Domain and application logic must not import `chrome.*`, `window`, `document`, or Linux.do selectors. Chrome APIs belong in `entrypoints/` or `src/adapters/`. Linux.do selectors belong in `src/sites/linuxdo/selectors.ts`.

## Local Extension Dev Profile

For Linux.do logged-in/manual QA, use the repository-local Chrome development profile. Full toolchain and Playwright setup: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

```txt
Profile:   .profiles/manual-linux-do-it-qa
Extension: .output/chrome-mv3
CDP port: 9222
Start URL: https://linux.do/posted
```

```powershell
pnpm build
pwsh -File scripts/start-agent-chrome.ps1
```

Treat `.profiles/` as private local runtime state: do not inspect, copy, commit, or print cookies, tokens, passwords, or account secrets.

## Quality Gate

```powershell
pnpm check
```

Do not commit `.env.local`, `.profiles/`, cookies, tokens, passwords, or raw private page captures.

<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->
