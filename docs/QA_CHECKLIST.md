# Linux Do It QA Checklist

Use this checklist before release candidates, after native bridge changes, and after Reader, side panel, or permission changes.

## Safety Rules

- Use an isolated Chrome profile for logged-in validation.
- Do not use your daily browser profile.
- Do not expose or commit cookies, tokens, credentials, `.env.local`, or `.profiles/`.
- Public write tests must only use approved public topics.
- Do not bypass Cloudflare, Turnstile, captcha, or site rate limits.

## Local Commands

From the repository root. First-time setup: install Playwright Chromium (`pnpm exec playwright install chromium`) — see [DEVELOPMENT.md](./DEVELOPMENT.md).

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
pnpm check
git diff --check
```

## Smoke matrix

- Topic list routes: `/latest`, `/new`, `/posted`, `/unseen`, category and tag lists.
- Card view toggle, layout modes (grid / masonry / reader list).
- Open Reader from a card; scroll, filter, sort comments; close Reader.
- Side panel search: query, open in Reader, open native topic fallback.
- Settings panel: persist across reload.
- Topic-page enhancer controls on a live topic page.

## Logged-in flows (isolated profile only)

- Native reply bridge opens composer without console errors.
- Read-state / viewed badges update and sync across tabs.
- Image viewer opens from Reader content.

## Build artifacts

- Manifest `name` is **Linux Do It**.
- Manifest includes `icons` for 16, 32, 48, 128.
- `pageBridge.js` present and web-accessible on `https://linux.do/*`.
