# Linux.do Fixtures

Store **sanitized** HTML fixtures here for selector and extraction tests.

## Current fixtures

| Fixture | Source scenario | Notes |
| --- | --- | --- |
| `topic-list.live-latest.html` | Anonymous `https://linux.do/latest` capture | Real Discourse topic-list table, minimized to two rows. |
| `topic-list.live-top.html` | Anonymous `https://linux.do/top` capture | Real top-list route with active top navigation and closed-topic status. |
| `topic-list.live-new-restricted.html` | Anonymous `https://linux.do/new` capture | Real restricted/not-found shell for a list route. |
| `topic.live-public.html` | Anonymous public topic capture | Real topic title/post shell with sanitized author and body. |

## Adding or refreshing fixtures

1. Capture HTML from Linux.do in an **isolated** browser profile (never your daily profile).
2. Strip usernames, emails, private messages, cookies, tokens, and other identifying data.
3. Keep structural DOM, useful aria labels, and stable classes needed for detection.
4. Prefer small fragments over full page dumps.
5. Save reviewed output under this directory: `src/sites/linuxdo/fixtures/<name>.html`.
6. Add or update Vitest tests that load the fixture and assert selectors/extractors.

If headless capture hits a Cloudflare challenge page, use headed Chrome with a dedicated profile under `.profiles/` (gitignored), complete the challenge once, then capture again.

## Before committing

- Do not commit raw logged-in page captures.
- Do not commit cookies, tokens, or account secrets.
- Update `src/sites/linuxdo/selectors.ts` intentionally when the site DOM changes; fixtures are the contract, not a runtime fallback.

See also `.trellis/spec/extension/quality-live-qa.md` and `docs/notes/README.md`.
