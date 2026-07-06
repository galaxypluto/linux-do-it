# Release

## Pre-release checklist

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
pnpm zip
```

## Review before tagging

- [ ] Manifest permissions and host scope (`docs/PERMISSIONS.md`).
- [ ] No remote executable code or API key leakage.
- [ ] `.env.local` and `.profiles/` excluded from artifacts.
- [ ] Source map policy (strip or publish intentionally).
- [ ] `CHANGELOG.md` updated.
- [ ] `package.json` and `wxt.config.ts` versions aligned.
- [ ] Icons regenerated from `assets/icon.svg` (`pnpm icons`).
- [ ] Privacy disclosure if targeting Chrome Web Store.

## Versioning

Use [Semantic Versioning](https://semver.org/):

- **MAJOR**: breaking settings/storage contracts or permission scope expansion.
- **MINOR**: new user-visible features.
- **PATCH**: bug fixes and safe refactors.

## Git tag and GitHub Release

```powershell
git tag v1.0.0
git push origin v1.0.0
```

Attach the ZIP from `plugins/linux-do-it/.output/*.zip` to the GitHub Release with release notes from `CHANGELOG.md`.

## Chrome Web Store (optional)

- Prepare 128×128 store icon (from generated PNG).
- Single-purpose description aligned with manifest.
- Screenshots of card view, Reader, and side panel search.
- Privacy policy URL if required.

## Extension ID stability

Assigning a fixed `key` in `wxt.config.ts` locks the extension ID for updates. Changing the key creates a new extension; users must reinstall and local data will not migrate automatically.
