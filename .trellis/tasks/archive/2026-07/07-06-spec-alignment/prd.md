# Spec alignment: docs, dead code, extension E2E

## Goal

Bring `.trellis/spec/extension/` and contributor docs in line with the standalone repo's actual architecture, remove dead legacy code, and add automated extension-page E2E smoke.

## Requirements

### Step 1 — Documentation alignment

- `package-boundaries.md`: document shadow DOM host, `src/layout`, `src/preview`, `src/shared`, `src/storage`, `sites/_registry`
- `docs/ARCHITECTURE.md`: full layer list; clarify `ldcv-*` as active Reader/card UI vs legacy identifiers
- `index.md`: link `docs/DEVELOPMENT.md` in pre-dev checklist
- `quality-live-qa.md`: note CI runs typecheck/test/build only (not e2e); tier live topic-route checks under manual QA

### Step 2 — Code hygiene

- Remove unused `src/content/cardViewApp.ts` (no imports; superseded by `mount.ts` + `render.ts`)

### Step 3 — Tests and spec consistency

- Add `tests/e2e/extension.fixture.ts` and `extension-smoke.spec.ts` (debug + sidepanel load)
- Update `package-boundaries.md` E2E section: automated extension smoke vs manual `/t`/`/n` live QA
- `playwright.config.ts`: separate extension project (headed) from basic smoke

## Acceptance Criteria

- [x] Spec and ARCHITECTURE reflect shadow DOM and missing layers
- [x] `cardViewApp.ts` removed; `pnpm test` passes
- [x] Extension E2E smoke passes after `pnpm build`
- [x] `pnpm check` passes
- [x] No new Chrome-EXE / linuxdo-reader pollution in docs

## Notes

- Live `/t` vs `/n` topic-route E2E remains manual QA (`docs/QA_CHECKLIST.md`); unit tests cover enhancer contracts.
