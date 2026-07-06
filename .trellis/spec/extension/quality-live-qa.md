# Quality And Live QA

This guide owns Linux Do It verification and regression-recording rules.

Reference files:

- `AGENTS.md`
- `package.json`
- `playwright.config.ts`
- `docs/DEVELOPMENT.md`
- `docs/QA_CHECKLIST.md`
- `docs/notes/`
- `tests/content/privateMessageBridge.test.ts`
- `tests/e2e/basic.spec.ts`

## Check Order

- Start with the smallest targeted test that covers the changed contract.
- Broaden to package-level checks when the change touches shared content runtime, page bridge, storage, or side panel behavior.
- From the repository root:

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
pnpm check
```

## Logged-In QA Profile

Use the repository-local Chrome development profile for authenticated Linux.do checks:

- Profile: `.profiles/manual-linux-do-it-qa`
- Extension output: `.output/chrome-mv3`
- CDP port: `9222`
- Start URL: `https://linux.do/posted`

Start Chrome:

```powershell
pnpm build
pwsh -File scripts/start-agent-chrome.ps1
```

If that Chrome is already running, attach through CDP instead of launching a new profile.

Do not inspect, copy, print, or commit cookies, tokens, passwords, account secrets, `.profiles/`, or raw private page captures.

## Live QA Scope

Use logged-in live QA when:

- The change touches native composer, reply, private message, like, bookmark, read timing, or poll vote.
- The bug only reproduces in the live Discourse runtime.
- The task explicitly asks for profile-backed validation.

Do not use live QA to replace unit tests for deterministic contracts. Live QA proves target-site behavior; unit tests lock the plugin contract.

## Regression Notes

Capture subtle Linux.do bugs under `docs/notes/` when the root cause or prevention rule is useful for future work.

Good notes include:

- Absolute time and test context.
- What was observed.
- Fields sampled or tools used.
- Sensitive data deliberately omitted.
- Root cause and prevention rule.
- Source files/tests that now anchor the fix.

Do not put temporary debugging logs, cookie values, reply body content, or raw logged-in DOM dumps in notes.

## Review Checklist

Before closing a Linux Do It task:

- `code_review.md` checked if present.
- No debug logging remains.
- Permission changes, if any, are reflected in `docs/PERMISSIONS.md`.
- New or changed Discourse write-like behavior has unit tests around success and failure.
- Reader DOM/animation fixes verify element preservation where relevant, not just final text.
- Live QA findings are summarized without secrets.
- Any durable lesson is reflected in `.trellis/spec/extension/` or `docs/notes/`.
