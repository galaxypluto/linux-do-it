# Linux.do Fixtures

Store sanitized HTML fixtures here when selector or extraction tests are added.

Current live-derived fixtures:

| Fixture | Source scenario | Notes |
| --- | --- | --- |
| `topic-list.live-latest.html` | Anonymous `https://linux.do/latest` capture | Real Discourse topic-list table, minimized to two rows. |
| `topic-list.live-top.html` | Anonymous `https://linux.do/top` capture | Real top-list route with active top navigation and closed-topic status. |
| `topic-list.live-new-restricted.html` | Anonymous `https://linux.do/new` capture | Real restricted/not-found shell for a list route. |
| `topic.live-public.html` | Anonymous public topic capture | Real topic title/post shell with sanitized author and body. |

Live capture note: current Linux.do anonymous captures should use the workspace preset:

```powershell
pnpm fixture:capture:linuxdo -- `
  --url https://linux.do/latest `
  --out plugins/linuxdo-reader/src/sites/linuxdo/fixtures/topic-list.anonymous.latest.html
```

In this rehearsal, headless capture reached a Cloudflare intermediate page instead of the site DOM. The preset uses headed Chrome, `#main-outlet`, `plugins/linuxdo-reader/.profiles/fixture-capture`, a 60 second timeout, and a short wait.

Repeatable Linux.do scenarios are also available through the workspace site config:

```powershell
pnpm fixture:capture:site -- --site linuxdo --list
pnpm fixture:capture:site -- --site linuxdo --scenario latest
pnpm fixture:capture:site -- --site linuxdo --scenario top
pnpm fixture:capture:site -- --site linuxdo --scenario new-restricted
```

Scenario capture writes a `<fixture>.manifest.json` candidate review manifest next to the output by default. The manifest records source URL/input, selector, viewport, login-state expectation, warnings, and the scan command; it does not replace review or scanning.

If a Linux.do selector fails, diagnose the raw HTML or fixture before changing `src/sites/linuxdo/selectors.ts`:

```powershell
pnpm fixture:probe -- `
  --input plugins/linuxdo-reader/src/sites/linuxdo/fixtures/topic-list.live-latest.html `
  --selector "#main-outlet"
```

After adapter changes, run challenge-aware smoke against the real route without creating a fixture:

```powershell
pnpm fixture:smoke:site -- --site linuxdo --scenario latest
pnpm fixture:smoke:site -- --site linuxdo --scenario latest --headed --user-data-dir plugins/linuxdo-reader/.profiles/fixture-capture
```

If the report says `blocked-by-challenge`, manually complete the challenge in the isolated profile and rerun. Do not use a daily browser profile.

Before committing a fixture:

- Remove usernames, emails, private messages, cookies, tokens, and IDs that identify a person.
- Keep structural DOM, useful aria labels, and stable classes needed for detection.
- Prefer small page fragments over full raw page captures.
- Keep raw captures under ignored `site-captures/`; only commit reviewed and sanitized fixtures here.
- Do not rely on selector diagnostics as runtime fallback; update selectors intentionally and keep fixture tests as the contract.
- Treat challenge-aware smoke as a reachability/debug signal, not a fixture generator or challenge bypass.
- Run `pnpm fixture:scan -- plugins/linuxdo-reader/src/sites/linuxdo/fixtures`.
