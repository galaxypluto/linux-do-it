请读取 `.agents/skills/chrome-extension-workspace/SKILL.md`，在 `plugins/<extension-slug>/` 下为我初始化一个 Chrome MV3 插件包。

要求：

1. 使用 WXT + TypeScript + React。
2. 建立分层架构：domain/application/ports/adapters/sites/entrypoints。
3. 建立 Playwright extension fixture。
4. 建立 debug page。
5. 建立站点适配器模板。
6. 建立 docs/PERMISSIONS.md、docs/ARCHITECTURE.md、docs/TESTING.md。
7. 不要实现具体业务功能，先搭工程、测试、可观测性闭环。
8. 完成后运行或说明如何运行：`pnpm test`、`pnpm build`、`pnpm e2e`。
