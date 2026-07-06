请读取 `.agents/skills/chrome-extension-workspace/SKILL.md`。

**Linux Do It 仓库已在根目录完成 WXT 初始化**，不要创建 `plugins/` 子目录。若需扩展工程能力（新测试夹具、debug 面、站点适配层文件），在现有 `src/`、`entrypoints/`、`tests/`、`docs/` 下增量添加。

要求：

1. 遵循现有分层：domain/application/ports/adapters/sites/entrypoints。
2. 权限变更同步 `docs/PERMISSIONS.md`。
3. 行为变更补充 Vitest；需要浏览器时补充 Playwright。
4. 完成后说明如何运行：`pnpm test`、`pnpm build`、`pnpm check`。

若要从零创建**另一个**独立扩展仓库，参考 `templates/` 与 SKILL.md 第 8 节，在**新 git 仓库**根目录初始化，而非在本仓库内嵌套插件包。
