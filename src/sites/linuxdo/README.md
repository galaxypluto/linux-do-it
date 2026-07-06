# Linux.do Site Adapter

## Site

- Origin: `https://linux.do`
- Requires login: expected for reader features, but detection works before login.
- Initial supported page types: `topic`, `topic-list`, `login`, `unknown`.

## Permissions

The extension is scoped to `https://linux.do/*`. Do not widen host permissions without updating `docs/PERMISSIONS.md` and reviewing the permissions checklist.

## Detection Rules

Detection uses URL origin plus Discourse DOM signals from `selectors.ts`. Selectors are intentionally centralized so Linux.do markup changes are localized to this adapter.

## Known Fragility

Linux.do is a Discourse site and can change class names, lazy-load topic content, or alter header markup. Prefer fixture-backed updates before changing selectors.

## Test Account

Do not store credentials in this repository. Use `.env.local`, CI secrets, or a manually bootstrapped isolated profile.

