# Agent Instructions for This Chrome Extension Project

请优先读取：

```txt
.agents/skills/chrome-extension-workspace/SKILL.md
```

本项目按 Chrome MV3 插件工程规范开发。执行任何代码修改前，遵守以下规则：

1. 业务逻辑放 `src/domain` 和 `src/application`。
2. Chrome API 只能出现在 `entrypoints` 或 `src/adapters/chrome`。
3. 目标网站 DOM selector 只能出现在 `src/sites/<site>/selectors.ts`。
4. 新功能必须包含 unit test、fixture test 或 E2E 计划。
5. 登录态实测必须使用隔离 profile 和测试账号，不得使用真实账号。
6. 新增权限必须更新 `docs/PERMISSIONS.md`。
7. 不要把 API key、cookie、token、密码写入源码、日志或测试 fixture。
8. 每次完成后尽量运行：

```powershell
pnpm test
pnpm build
pnpm e2e
```

如果需要真实浏览器验证，使用 Chrome DevTools MCP 连接隔离 Chrome profile，不要连接日常浏览器。
