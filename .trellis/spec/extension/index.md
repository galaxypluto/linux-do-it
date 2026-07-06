# Linux Do It Extension Specs

This spec layer owns stable engineering contracts for the **Linux Do It** WXT MV3 Chrome extension (repository root).

Use this layer when work touches content-page Reader behavior, Linux.do/Discourse site adaptation, page-context native actions, side panel integration, topic-page enhancement, live QA, or regression prevention.

## Guideline Files

| Guide | Scope |
| --- | --- |
| [Package Boundaries](./package-boundaries.md) | WXT entrypoints, domain boundaries, site selectors, topic page enhancer, page bridge ownership |
| [Styles And UI](./styles-and-ui.md) | TailwindCSS and `base-list.css` conventions, component rendering |
| [Content And Bridge](./content-and-bridge.md) | Content script injection (`mount.ts`), page detectors, sidepanel messages, read timing |
| [Reader State And DOM](./reader-state-dom.md) | Reader modal preservation, masonry/list stability, nested overlays, React islands |
| [Discourse Bridge](./discourse-bridge.md) | Native composer/write actions, reply submit, read timing, poll voting |
| [Quality And Live QA](./quality-live-qa.md) | Targeted checks, logged-in QA profile, notes, secrets discipline |

## Pre-Development Checklist

- Read `AGENTS.md`.
- Read `docs/ARCHITECTURE.md`.
- Read the guideline file in this directory that owns the behavior being changed.
- For site selectors or fixture work, read `.agents/skills/chrome-extension-workspace/SKILL.md`.
- For cross-surface changes, trace: `src/content/mount.ts` → UI → native bridge → storage/settings → side panel.

## Quality Check

From the repository root:

```powershell
pnpm check
```

Start with the smallest targeted test that covers the changed contract. UI changes should respect both the Vanilla CSS system (`ldcv-` variables in `base-list.css`) and the React Tailwind implementation where applicable.

Do not inspect, copy, print, or commit `.profiles/`, cookies, tokens, passwords, or raw private page captures.

## Stable Content Rule

Do not leave hard-won plugin lessons only in chat or commits. Land executable contracts with source/test anchors here or in `docs/notes/`.
