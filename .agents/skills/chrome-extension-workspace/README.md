# Chrome Extension Workspace Skill

这是 **Linux Do It** 仓库的项目级 Chrome 插件开发 skill。它把 WXT MV3 扩展的开发流程组织成可执行规范：工程初始化、分层架构、站点适配、登录态实测、Playwright E2E、Chrome DevTools MCP 调试、权限审查和发布检查。

## 位置

```txt
.agents/skills/chrome-extension-workspace/
  SKILL.md                         # 核心 skill 指令
  AGENTS.example.md                 # agent 入口说明示例
  mcp/                              # Chrome DevTools MCP 配置示例
  prompts/                          # 常用 agent 任务提示词
  checklists/                       # 架构、登录态、安全、发布检查清单
  scripts/                          # Windows PowerShell 辅助脚本模板
  templates/                        # WXT/TypeScript/Playwright/站点适配模板
```

## 本仓库使用方式

本 skill 是共享开发协议，源码在仓库根目录（`entrypoints/`、`src/`、`tests/`），工程契约在 `.trellis/spec/extension/`。

日常开发：

1. 阅读 `AGENTS.md` 与 `SKILL.md`。
2. 从仓库根目录运行 `pnpm dev` / `pnpm check`。
3. 登录态 Linux.do QA：`pnpm build` 后 `pwsh -File scripts/start-agent-chrome.ps1`。
4. 站点 fixture 放在 `src/sites/linuxdo/fixtures/`（见该目录 `README.md`）。
5. 架构与权限：`docs/ARCHITECTURE.md`、`docs/PERMISSIONS.md`；环境配置：`docs/DEVELOPMENT.md`。

示例提示：

```txt
请读取 .agents/skills/chrome-extension-workspace/SKILL.md，按分层架构修改 Linux.do Reader 行为，并补充对应 Vitest 测试。
```

## 设计目标

- 单仓库、单扩展：构建产物在 `.output/chrome-mv3`。
- 先分层，再写功能；站点选择器集中在 `src/sites/linuxdo/selectors.ts`。
- 登录态功能用隔离 profile、Playwright 和 DevTools MCP 实测。
- 权限、隐私、发布审查进入日常开发流程。

## Chrome DevTools MCP

推荐配置 Chrome DevTools MCP，让 agent 可以观察隔离浏览器状态：

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```
