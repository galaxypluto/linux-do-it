# Relationship with linuxdo-reader and Chrome-EXE

## Canonical home

**Linux Do It** is developed and released from this repository (`galaxypluto/linux-do-it`).

Version **1.0.0** is the first public release under the Linux Do It brand.

## linuxdo-reader (sibling baseline)

`linuxdo-reader` lives in the [Chrome-EXE](https://github.com/galaxypluto/Chrome-EXE) monorepo under `plugins/linuxdo-reader/`. It was the original Linux.do Card View extension and the fork base for early Reader experiments.

| | linux-do-it | linuxdo-reader |
| --- | --- | --- |
| **Status** | Primary, actively maintained | Baseline / reference in monorepo |
| **Repo** | This standalone repo | Chrome-EXE monorepo |
| **Features** | Reader React islands, side panel search, credit-view sync, topic enhancer | Core card view and Reader MVP |

There is **no npm dependency** between the two. They share historical code lineage but diverged; do not assume patches apply cleanly across both.

## Why standalone?

The Chrome-EXE workspace hosts multiple Chrome extensions and shared tooling. Keeping Linux Do It in its own repository:

- Avoids unrelated plugin commits in extension release history.
- Simplifies issues, releases, and stars for end users.
- Keeps CI and permissions review scoped to one product.

## Monorepo mirror (removed)

Before v1.0.0, the extension was vendored as `plugins/LD-reader-study` then `plugins/linux-do-it` inside Chrome-EXE. After extraction, the monorepo keeps only a pointer in `docs/WORKSPACE.md` — not a second copy of the source tree.
