# Chrome Extension Workspace Skill

这是 **Linux Do It** 独立仓库的项目级 Chrome 插件开发 skill。它把 WXT MV3 扩展的开发流程组织成可执行规范：工程初始化、分层架构、站点适配、登录态实测、Playwright E2E、Chrome DevTools MCP 调试、权限审查和发布检查。

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

## Workspace 使用方式

本 skill 是共享开发协议，不属于任何单个插件。不要复制到 `plugins/<extension-slug>/`。

新增插件时：

1. 在 `plugins/<extension-slug>/` 下创建独立 WXT 插件包。
2. 插件包保留自己的 `package.json`、`wxt.config.ts`、`entrypoints/`、`src/`、`tests/` 和 `docs/`。
3. 从 workspace 根目录运行 `pnpm install`。
4. 用根目录命令定位插件，例如 `pnpm --filter <package-name> check`。
5. 如需保存目标站点抓取包，放到忽略的 `site-captures/<site>/<date-scenario>/raw/`，再把最小脱敏样本提升为插件 fixture。
6. 需要重复裁剪 DOM 时，从根目录使用 `pnpm fixture:capture` 生成候选 fixture，并在提交前 review、脱敏、补测试。Linux.do 使用 `pnpm fixture:capture:linuxdo -- --url <url> --out <file>`。
7. 同一站点有多个稳定页面状态时，把它们写入 `tools/site-fixture/sites/<site>.config.mjs`，再用 `pnpm fixture:capture:site -- --site <site> --scenario <name>` 运行；selector 失效时用 `pnpm fixture:probe` 做诊断。
8. 开发后期用 `pnpm fixture:smoke:site -- --site <site> --scenario <name>` 验证真实站点是否到达目标 DOM 或被 challenge 阻断；该命令不绕过 challenge。
9. 提交 fixture 前运行 `pnpm fixture:scan -- <fixture-path>`，用 Gitleaks 和 Presidio 做 secret/PII 扫描。
10. 开发时读取本目录的 `SKILL.md`，并结合插件自己的 `docs/ARCHITECTURE.md`、`docs/PERMISSIONS.md` 和 `docs/TESTING.md`。

示例提示：

```txt
请读取 .agents/skills/chrome-extension-workspace/SKILL.md，按照这个 workspace skill 在 plugins/<extension-slug>/ 下创建一个 WXT + TypeScript + React 的 Chrome MV3 插件包。目标网站是 <site>，需要登录后生效，先做架构、测试夹具和 debug page，再实现第一个功能。
```

## 设计目标

这个 skill 不是让 agent “一次性写完插件”，而是让 agent 按固定工程流程工作：

- 根 workspace 共享 Trellis、Codex、pnpm、skill、模板和开发命令。
- 每个插件保留独立源码、manifest、权限文档、测试、构建输出和发布说明。
- 原始站点抓取包保留在本地 `site-captures/`，只有脱敏 fixture 进入插件包。
- `tools/site-fixture/` 提供共享 fixture 抽取、站点场景 capture、selector 诊断、challenge-aware live smoke 和扫描工具，先用 DOMPurify 做通用 HTML 清洗，再用 Gitleaks/Presidio 扫描 secret 与 PII，减少 agent 重复分析 raw capture 的负担。
- 先分层，再写功能。
- 先定义测试与可观测性，再做真实站点适配。
- 登录态功能用测试账号、隔离 profile、Playwright 和 DevTools MCP 实测。
- 站点变化时优先改 `src/sites/<site>`，不污染核心逻辑。
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
