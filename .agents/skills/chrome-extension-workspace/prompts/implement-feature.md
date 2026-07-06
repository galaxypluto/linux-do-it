请按照 `.agents/skills/chrome-extension-workspace/SKILL.md` 实现这个插件功能：

功能描述：
<填入>

目标网站：
<填入>

登录态要求：
<填入>

要求：

1. 先写 feature spec。
2. 先改 domain/application/ports，再接 adapters/entrypoints/UI。
3. 新增或更新 unit test。
4. 新增或更新 fixture test。
5. 如果涉及真实网站登录态，新增或更新 logged-in smoke test。
6. 更新 debug page 显示相关状态。
7. 新增权限时更新 `docs/PERMISSIONS.md`。
8. 完成后运行 `pnpm test`、`pnpm build`，能跑 E2E 时运行 `pnpm e2e`。
