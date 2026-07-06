---
name: chrome-extension-workspace
description: 在 Linux Do It 独立仓库中用 AI coding agent 开发、组织和实测 Chrome MV3 插件，重点覆盖 WXT、TypeScript、分层架构、站点适配器、登录态 E2E、Chrome DevTools MCP、权限审查和发布工作流。
---

# Chrome 插件 Workspace Skill

## 0. 使用边界

当用户要在 **Linux Do It** 本仓库（仓库根目录的 WXT 扩展）中开发、重构、测试、适配或发布时，使用本 skill。尤其适用于：

- Windows 本地开发 Chrome 插件。
- Manifest V3 插件。
- 插件需要在目标网站登录后才生效。
- 插件包含 content script、background service worker、popup、side panel、options page。
- 用户希望 AI agent 能自己运行浏览器、观察结果、修复失败。
- 用户希望引入分层架构、模块化开发、站点适配器和测试闭环。

不要把本 skill 用成“纯代码生成器”。本 skill 的核心是：**让 agent 按可测试、可观测、可发布的工程流程开发插件。**

本 skill 是扩展开发协议，放在 `.agents/skills/chrome-extension-workspace/`。在本仓库中，插件源码在仓库根目录（`src/`、`entrypoints/`）；工程契约见 `.trellis/spec/extension/`。不要把插件源码放进本 skill 目录。

---

## 1. 默认技术栈

除非用户明确指定，否则默认使用：

```txt
Windows 11
PowerShell 7
VS Code / Cursor / Claude Code / Codex / Gemini CLI
Node.js LTS
pnpm
WXT
TypeScript
React
Tailwind CSS（可选；新 UI 密集插件可用，已有手写 CSS 的插件不要为了一致性强行引入）
Zod
Vitest
Playwright
Chrome DevTools MCP
Chrome for Testing / Playwright Chromium
```

默认项目类型：

```txt
Chrome Manifest V3 extension
WXT + TypeScript + React
side panel 优先承载复杂 AI/长流程 UI
popup 只做短动作入口
content script 做页面注入、DOM 采集、UI 挂载
background service worker 做事件、权限、消息路由
```

---

## 2. 最高优先级原则

### 2.1 MV3 优先

- background 必须按 extension service worker 设计。
- 不要假设 background 常驻。
- 不要把长期状态放在 service worker 全局变量里。
- 状态使用 `chrome.storage`、IndexedDB、后端或显式缓存策略。
- 需要 DOM 的隐藏后台任务，优先考虑 offscreen document，不要硬塞进 service worker。
- 不允许远程托管可执行代码。不要从 CDN、API、LLM 响应中加载 JS 并执行。

### 2.2 分层优先

核心业务逻辑不得依赖：

```txt
chrome.*
document
window
localStorage
fetch 直接调用
目标网站 DOM selector
```

凡是依赖外部世界的代码，必须放在 adapters、entrypoints 或 sites 层。

### 2.3 测试和可观测性优先

任何登录态功能都必须至少有：

```txt
1. unit test：纯逻辑
2. fixture test：脱敏 DOM/HTML fixture
3. logged-in smoke test：真实或隔离登录态浏览器
4. debug surface：debug page / DOM attribute / structured logs
```

### 2.4 安全优先

- 不要向 agent 暴露真实账号、真实 cookie、真实用户数据。
- 登录态实测只能使用专用测试账号、低权限账号或隔离测试环境。
- 凭据只能来自 `.env.local`、CI secret、系统 secret manager 或人工一次性 bootstrap。
- 不要把 API key 写进扩展包；LLM key、计费、限流、审计必须在后端。
- agent 连接真实浏览器时必须使用隔离 Chrome profile。

---

## 3. 推荐目录结构

本仓库是**单包** WXT 扩展，源码在仓库根目录：

```txt
linux-do-it/
  AGENTS.md
  package.json
  wxt.config.ts
  playwright.config.ts
  .trellis/
  .agents/skills/chrome-extension-workspace/
  entrypoints/
  src/
    domain/
    application/
    ports/
    adapters/
    content/
    ui/
    discourse/
    sites/
      linuxdo/
        selectors.ts
        fixtures/
  tests/
    unit/
    e2e/
  scripts/
  docs/
  .profiles/              # gitignored — 登录态 QA
  .output/chrome-mv3/     # gitignored — 构建输出
```

新增站点适配或重构时，优先保持上述分层。`templates/` 目录保留通用 WXT 脚手架示例（路径中 `plugins/<extension-slug>/` 表示**其他多插件 workspace** 的占位符，本仓库请映射到根目录）。

通用插件包分层参考（路径前缀按上表替换为仓库根目录）：

```txt
<repo-root>/
  package.json
  wxt.config.ts
  tsconfig.json
  playwright.config.ts

  entrypoints/
    background.ts
    content.ts
    popup/
      App.tsx
    sidepanel/
      App.tsx
    options/
      App.tsx
    debug/
      App.tsx

  src/
    domain/
      entities/
      rules/
      valueObjects/

    application/
      useCases/
      services/

    ports/
      BrowserPort.ts
      StoragePort.ts
      SitePort.ts
      AiPort.ts
      TelemetryPort.ts

    adapters/
      chrome/
        ChromeTabsAdapter.ts
        ChromeRuntimeAdapter.ts
        ChromeStorageAdapter.ts
      ai/
        BackendAiAdapter.ts
      telemetry/
        ConsoleTelemetryAdapter.ts

    sites/
      _registry.ts
      _types.ts
      <site>/
        manifest.ts
        selectors.ts
        detect.ts
        extract.ts
        actions.ts
        fixtures/
        README.md

    shared/
      messaging/
        messages.ts
        schemas.ts
        sendMessage.ts
      logger/
      errors/
      config/

  tests/
    unit/
    fixtures/
    e2e/
      extension.fixture.ts
      extension-smoke.spec.ts
      logged-in-site.spec.ts

  scripts/
    start-agent-chrome.ps1
    refresh-test-profile.ps1

  docs/
    ARCHITECTURE.md
    PERMISSIONS.md
    TESTING.md
    RELEASE.md
```

边界规则：

- 根 workspace 负责共享 Trellis、Codex、pnpm、skill、模板和统一命令。
- 插件包负责自己的 WXT 配置、manifest、权限说明、源码、测试、构建输出和发布文档。
- 不要把 `.trellis/`、`.agents/`、`.codex/` 或本 skill 复制进插件包。
- 不要把插件特有权限、selector、fixture、发布说明上移到根目录。
- 原始站点抓取包放在被忽略的 `site-captures/<site>/<date-scenario>/raw/`；插件源码和测试只能使用经过审查、脱敏、裁剪后的 fixture。
- 可用根命令 `pnpm fixture:capture` 从本地 raw HTML 或 live URL 生成候选 fixture。该工具先用 DOMPurify 做通用 HTML 清洗，再执行 workspace 脱敏和稳定化规则；会检测 Cloudflare/Turnstile 中间页并对过大的候选 fixture 给出提醒；输出仍必须人工/agent 复核、脱敏并由测试消费后才可提交。
- Linux.do live capture 默认使用 `pnpm fixture:capture:linuxdo -- --url <url> --out <file>` 或 `pnpm fixture:capture -- --preset linuxdo ...`。该 preset 使用 headed Chrome、`#main-outlet`、隔离 profile、60 秒 timeout 和短等待。
- 重复出现的站点页面状态应写成 `tools/site-fixture/sites/<site>.config.mjs` 场景，再用 `pnpm fixture:capture:site -- --site <site> --scenario <name>` 运行。场景是 allowlist，不是 crawler；不要让它自动遍历站内链接。
- selector 失效时可用 `pnpm fixture:probe -- --input <html> --selector <css>` 或 capture 失败报告查看候选元素。诊断只用于人工/agent review，不允许用 fuzzy matching 让测试自动通过。
- 场景化 capture 默认写 `<fixture>.manifest.json` 作为候选 fixture 的来源、selector、viewport、登录态预期、warning 和 scan 命令记录；manifest 是 review 元数据，不是安全证明。
- 开发后期需要验证真实站点可达性时，用 `pnpm fixture:smoke:site -- --site <site> --scenario <name>`。该命令只做 challenge-aware live smoke：识别目标 selector 是否到达、是否遇到 Cloudflare/Turnstile-style challenge，并给出人工 bootstrap 隔离 profile 的建议；不要把它扩展成绕过 challenge 的工具。
- 提交 promoted fixture 前运行 `pnpm fixture:scan -- <fixture-path>`。该命令组合 Gitleaks secret/token 扫描和 Microsoft Presidio 本地 PII 扫描。

---

## 4. 架构职责

### 4.1 domain 层

只放纯规则、实体、值对象、分类器、转换函数。

允许：

```ts
class PageSnapshot {}
function classifyPage(snapshot: PageSnapshot): PageType {}
function shouldShowActionButton(state: UserState, page: PageType): boolean {}
```

禁止：

```ts
chrome.tabs.query(...)
document.querySelector(...)
window.location.href
fetch(...)
```

### 4.2 application 层

负责编排用例，不关心 Chrome API 和具体网站 DOM。

典型用例：

```txt
AnalyzeCurrentPageUseCase
OpenSidePanelForSupportedSiteUseCase
ExtractPageContextUseCase
RequestOptionalHostPermissionUseCase
```

用例只依赖 ports：

```ts
new AnalyzeCurrentPageUseCase(sitePort, aiPort, storagePort, telemetryPort)
```

### 4.3 ports 层

定义核心代码需要的能力接口：

```ts
export interface SitePort {
  detect(): Promise<SiteDetectionResult>;
  getPageSnapshot(tabId: string): Promise<PageSnapshot>;
  performAction(action: SiteAction): Promise<void>;
}

export interface StoragePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}
```

核心代码只依赖接口，不依赖实现。

### 4.4 adapters 层

封装外部系统：

```txt
adapters/chrome       chrome.* API
adapters/ai           后端 AI API
adapters/telemetry    日志、错误上报、debug channel
adapters/storage      chrome.storage / IndexedDB
```

这里可以出现 `chrome.*`、`fetch`、storage 实现。

### 4.5 sites 层

每个网站一个适配器目录。网站 DOM selector、页面类型识别、登录态识别、数据抽取、页面操作都必须集中在这里。

每个网站模块必须包含：

```txt
manifest.ts     站点 id、match patterns、权限说明、功能说明
detect.ts       是否支持、是否登录、页面类型
selectors.ts    所有 DOM selector 集中管理
extract.ts      从页面抽取 PageSnapshot
actions.ts      对页面执行动作
fixtures/       脱敏 HTML/DOM fixture
README.md       适配说明、已知限制、测试账号说明
```

### 4.6 entrypoints 层

WXT 入口文件。只做接线，不写业务核心逻辑。

```txt
background.ts   事件、权限、消息路由、side panel 开关
content.ts      注入、页面观察、站点适配器调用、DOM 测试标记
popup           短入口	sidepanel       复杂 UI、AI 助手、长流程
options         设置
debug           开发态诊断页面
```

---

## 5. 登录态实测标准流程

当目标网站登录后才显示插件功能时，必须按下面流程设计。

### 5.1 首选策略

```txt
专用测试账号
+ 隔离 Chrome profile
+ Playwright persistent context
+ 本地加载 unpacked extension
+ Chrome DevTools MCP 观察 console/network/service worker/extension pages
+ 自动化断言
```

### 5.2 禁止策略

不要做：

```txt
把真实账号密码粘给 agent
让 agent 使用用户日常 Chrome profile
让 agent 读取真实邮箱、支付、客户数据
把登录 cookie 提交到仓库
在测试日志里打印密码、token、cookie
绕过验证码或风控
```

### 5.3 登录方式决策

```txt
你控制目标网站：
  使用 staging/test auth endpoint，或关闭测试环境验证码。

第三方网站但支持普通登录：
  使用专用低权限测试账号，凭据来自 .env.local / CI secret。

第三方网站有 MFA：
  使用测试 TOTP secret、测试 IdP，或人工 bootstrap 一次隔离 profile。

第三方网站有强风控/短信验证码：
  不做全自动登录；人工登录隔离 profile 后，agent 只测试登录后的功能。
```

### 5.4 登录态 profile 目录约定

```txt
.profiles/
  agent-chrome/          # Chrome DevTools MCP 调试用
  playwright-site-e2e/   # Playwright 登录态 E2E 用
  manual-bootstrap/      # 人工登录引导用
```

这些目录不要提交到 Git。

### 5.5 登录态测试验收点

每个登录态 E2E 至少断言：

```txt
1. 当前网站处于已登录状态
2. content script 已注入
3. 站点适配器识别到正确 site id
4. 站点适配器识别到正确 page type
5. popup 或 side panel 显示正确状态
6. 点击插件功能后产生预期 DOM / storage / network / UI 结果
7. background service worker 无未捕获错误
8. page console 无未捕获错误
9. 关键 API 没有 401/403/500
```

---

## 6. 可观测性规范

插件必须为 agent 和 E2E 暴露可观测状态。

### 6.1 DOM 测试标记

content script 注入成功后，在开发/测试模式设置：

```ts
document.documentElement.dataset.myExtensionReady = 'true';
document.documentElement.dataset.myExtensionSite = siteId;
document.documentElement.dataset.myExtensionPageType = pageType;
document.documentElement.dataset.myExtensionLoggedIn = String(loggedIn);
```

测试可以断言：

```ts
await expect(page.locator('html[data-my-extension-ready="true"]')).toBeVisible();
```

### 6.2 Debug page

开发模式应提供：

```txt
chrome-extension://<id>/debug.html
```

至少显示：

```txt
extension version
build mode
current tab URL origin
active site adapter
page type
logged-in detection result
last content script injection time
last runtime message
last storage write
last AI/backend request status
last error
permission status
service worker wake event count
```

### 6.3 Structured logs

日志格式建议：

```ts
logger.info('site.detected', {
  siteId,
  pageType,
  loggedIn,
  urlOrigin,
  timestamp: Date.now(),
});
```

不要打印：

```txt
password
cookie
authorization header
refresh token
完整 HTML 中的个人数据
```

---

## 7. Agent 开发流程

每次 agent 接到功能任务时，按此顺序执行。

### 7.1 任务拆解

先输出或更新一段 feature spec：

```txt
目标用户：
目标网站：
登录态要求：
目标页面类型：
用户动作：
插件响应：
权限变化：
数据流：
失败状态：
测试计划：
```

### 7.2 编码顺序

```txt
1. 更新或新增 domain model
2. 定义 ports
3. 写 unit test
4. 写 application use case
5. 写 site adapter / selector / extractor
6. 写 DOM fixture test
7. 接 entrypoints/content/background
8. 接 sidepanel/popup UI
9. 增加 debug page 字段
10. 写 Playwright E2E
11. 跑 build/test/e2e
12. 做权限和安全审查
```

### 7.3 每次修改的硬约束

- 不要在 UI 里直接操作 Chrome API，走 application/ports。
- 不要在 content script 里写复杂业务逻辑，走 site adapter + use case。
- 不要让站点 selector 散落在多个目录。
- 不要新增宽泛 host permissions，除非 feature spec 明确说明。
- 新增权限必须同步更新 `docs/PERMISSIONS.md`。
- 新增站点必须同步添加 fixture test 和 live smoke test。

---

## 8. 初始化命令模板

> **Linux Do It 本仓库**已在根目录完成 WXT 初始化。日常只需 `pnpm install`、`pnpm exec playwright install chromium`（首次）、`pnpm check`。本节与 `plugins/<extension-slug>/` 相关命令面向**从零创建新扩展**或多插件 workspace，不要在本仓库下再建 `plugins/` 目录。

如果是在多插件 workspace 中新增插件，从 workspace 根目录创建包：

```powershell
pnpm dlx wxt@latest init plugins/<extension-slug>
pnpm install
pnpm --filter <package-name> add @wxt-dev/module-react react react-dom zod
pnpm --filter <package-name> add -D @playwright/test @types/chrome @types/node @types/react @types/react-dom jsdom typescript vitest wxt
pnpm --filter <package-name> exec playwright install chromium
```

如果已经进入插件目录，也可以运行包内命令；但依赖安装和版本锁定仍以 workspace 根目录的 `pnpm-lock.yaml` 为准。

```powershell
cd plugins/<extension-slug>
pnpm add zod
pnpm add -D @playwright/test @types/chrome @types/node @types/react @types/react-dom jsdom typescript vitest wxt
pnpm exec playwright install chromium
```

建议补充 scripts：

```json
{
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "zip": "wxt zip",
    "prepare:wxt": "wxt prepare",
    "typecheck": "wxt prepare && tsc --noEmit",
    "test": "wxt prepare && vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "e2e:headed": "playwright test --headed",
    "check": "pnpm typecheck && pnpm test && pnpm build && pnpm e2e"
  }
}
```

根目录 `package.json` 应提供 workspace 命令，例如：

```json
{
  "scripts": {
    "build": "pnpm -r --filter \"./plugins/*\" build",
    "test": "pnpm -r --filter \"./plugins/*\" test",
    "typecheck": "pnpm -r --filter \"./plugins/*\" typecheck",
    "e2e": "pnpm -r --filter \"./plugins/*\" e2e",
    "check": "pnpm -r --filter \"./plugins/*\" check"
  }
}
```

---

## 9. Chrome DevTools MCP 使用规范

### 9.1 MCP 配置

通用 MCP JSON：

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

### 9.2 隔离浏览器启动

Windows 调试用：

```powershell
$EXT = Resolve-Path ".output\chrome-mv3"
$PROFILE = Resolve-Path ".profiles\agent-chrome"

$ChromeCandidates = @(
  $env:CHROME_PATH,
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and (Test-Path $_) }

$ChromePath = $ChromeCandidates | Select-Object -First 1
if (!(Test-Path $ChromePath)) {
  throw "Chrome not found. Set CHROME_PATH or install Chrome stable."
}

& $ChromePath `
  --remote-debugging-port=9222 `
  --user-data-dir="$PROFILE" `
  --disable-extensions-except="$EXT" `
  --load-extension="$EXT"
```

### 9.3 Agent 调试任务

让 agent 做真实调试时，提示它：

```txt
使用 Chrome DevTools MCP 连接隔离 profile，不要连接我的日常浏览器。
请验证：
1. 插件已加载。
2. content script 已注入。
3. side panel/popup/debug page 可打开。
4. console 没有未捕获错误。
5. network 没有关键 4xx/5xx。
6. background service worker 可以被唤醒并处理消息。
7. Playwright E2E 断言通过。
```

---

## 10. Playwright E2E 规范

### 10.1 Extension fixture

测试扩展时使用 persistent context，加载 `.output/chrome-mv3`。

测试至少提供：

```txt
context
extensionId
openExtensionPage(path)
openTargetSite(path)
collectConsoleErrors()
```

### 10.2 登录态 E2E

登录态测试分两类：

```txt
auth bootstrap:
  创建或刷新隔离 profile 登录态。

feature smoke:
  使用已有隔离 profile 加载插件，验证登录后功能。
```

不要每个测试都重新完整登录，除非目标网站稳定且不触发风控。

### 10.3 CI 策略

```txt
PR 必跑：
  unit tests
  fixture tests
  extension smoke E2E
  build

每日定时：
  logged-in smoke test
  Stable/Beta/Canary 或 Chrome for Testing 矩阵

发布前：
  headed E2E
  权限 diff
  隐私和数据流审查
  Chrome Web Store zip 检查
```

---

## 11. 权限设计规范

每个权限都要回答：

```txt
为什么需要？
用于哪个功能？
是否可以 optional？
是否可以降低 scope？
是否会增加用户权限警告？
是否涉及用户数据？
是否需要隐私政策披露？
```

优先使用：

```txt
optional_permissions
optional_host_permissions
activeTab
declarativeNetRequest
sidePanel only when needed
scripting only when needed
storage with minimal data
```

避免默认使用：

```txt
<all_urls>
tabs
webRequest
debugger
cookies
history
bookmarks
```

不是绝对不能用，而是必须有明确业务理由、权限说明和用户授权路径。

---

## 12. 站点适配器开发协议

### 12.1 新增站点时创建

```txt
src/sites/<site>/manifest.ts
src/sites/<site>/selectors.ts
src/sites/<site>/detect.ts
src/sites/<site>/extract.ts
src/sites/<site>/actions.ts
src/sites/<site>/fixtures/README.md
src/sites/<site>/README.md
```

### 12.2 selector 管理

所有 selector 必须集中在 `selectors.ts`：

```ts
export const selectors = {
  loginButton: '[data-testid="login"]',
  dashboardRoot: '[data-testid="dashboard"]',
  editorRoot: '[contenteditable="true"]',
} as const;
```

禁止在 `extract.ts`、`actions.ts`、UI 或 use case 里散写 selector 字符串。

### 12.3 detect 返回结构

```ts
export type SiteDetectionResult = {
  supported: boolean;
  siteId: string;
  loggedIn: boolean;
  pageType: string;
  confidence: number;
  reason?: string;
};
```

### 12.4 fixture 要求

原始抓取包和 fixture 不是同一种资产：

```txt
site-captures/<site>/<date-scenario>/raw/     本地原始抓取包，默认忽略，不进 Git
src/sites/<site>/fixtures/                    脱敏、裁剪、稳定化后的测试 fixture，可以进 Git
```

fixture 必须脱敏：

```txt
移除姓名、邮箱、电话、地址、订单号、token、cookie、私密内容
保留 DOM 结构、关键 data-testid、关键 aria label、关键 class
```

不要让代码、测试、文档示例直接依赖 `site-captures/`。如果 raw capture 证明了某个 selector 或页面状态规则，把结论写到站点 README / 架构文档，并把最小可复现样本提升为 sanitized fixture。

当手工裁剪容易重复出错时，使用 workspace 工具生成候选 fixture：

```powershell
pnpm fixture:capture -- --input <raw-html> --base-url https://example.com/page --selector "main" --out src/sites/<site>/fixtures/<case>.html
pnpm fixture:capture -- --url https://example.com/page --selector "main" --out src/sites/<site>/fixtures/<case>.html
pnpm fixture:capture -- --preset linuxdo --url https://linux.do/latest --out src/sites/linuxdo/fixtures/<case>.html
pnpm fixture:capture:site -- --site linuxdo --scenario latest
pnpm fixture:probe -- --input <raw-html> --selector "main"
pnpm fixture:smoke:site -- --site linuxdo --scenario latest --headed --user-data-dir .profiles/fixture-capture
```

登录态页面只能配合隔离 profile 使用 `--user-data-dir .profiles/<name>`，不要让工具读取日常 Chrome profile。工具输出是 review candidate，不是自动安全结果；DOMPurify 负责 XSS/危险 HTML 清洗，不负责识别真实用户名、私信、账号状态或业务敏感 ID，必要时用 `--replace real=fake` 做显式脱敏。

如果工具提示捕获到 Cloudflare/Turnstile challenge page，不要提交该输出；改用 headed + isolated profile，或对 Linux.do 使用 `--preset linuxdo`。如果工具提示候选 fixture 超过 20 KB，先最小化 DOM，再进入 review 和 `fixture:scan`。

如果工具提示 selector not found，先看候选元素和原因，再更新 `src/sites/<site>/selectors.ts` 与 fixture test。不要把 selector 诊断变成运行时 fallback。

如果 live smoke 报告 `blocked-by-challenge`，不要提交 challenge DOM，也不要加入 stealth/proxy/captcha solving。对第三方站点，使用 headed + isolated profile 人工通过一次 challenge，再复用该 profile 做 smoke；对自有站点，优先在 staging/test 环境提供稳定测试规则。

fixture 进入 Git 前必须至少执行：

```powershell
pnpm fixture:scan -- src/sites/<site>/fixtures
```

首次使用扫描器时运行：

```powershell
.\tools\site-fixture\setup-scanners.ps1
```

`fixture:scan` 默认用 Gitleaks 查 secret/token，用 Presidio 查 PII。Presidio 默认排除 `URL` 和 `DATE_TIME` 实体以减少普通站点链接和 capture manifest 时间戳噪声；这不是隐私豁免，含 token、session 或个人标识的 URL 仍必须通过 Gitleaks、显式规则和 review 处理。

---

## 13. Debug-first 开发任务模板

当用户说“帮我实现某网站某功能”，agent 应先问或推断以下信息，不要直接写散乱代码：

```txt
目标网站 URL / origin
功能是否需要登录
用户触发入口：popup / side panel / page overlay / context menu
目标页面类型
要读取哪些页面数据
要写回哪些页面数据
是否需要后端/AI
需要哪些 Chrome 权限
成功可观测信号
失败可观测信号
```

如果信息不完整但可以合理推进，先搭架构、mock/fixture 和测试夹具，再留 TODO。

---

## 14. 发布前检查

在插件目录发布前必须完成：

```txt
pnpm test
pnpm build
pnpm e2e
pnpm zip
```

从 workspace 根目录执行时，用 filter 定位插件：

```powershell
pnpm --filter <package-name> check
pnpm --filter <package-name> zip
```

并检查：

```txt
manifest permissions
host permissions
minimum_chrome_version
remote code
CSP
API key leakage
source map leakage
privacy policy
data collection disclosure
Chrome Web Store 单一目的说明
截图和文案
```

---

## 15. 推荐 agent 提示词

### 15.1 Bootstrap

```txt
请读取本 skill。若目标仓库尚未有 WXT 扩展，在约定目录（多插件 workspace 为 plugins/<extension-slug>/；单仓库则为根目录）初始化 Chrome MV3 项目。要求：
1. 不复制宿主仓库已有的 .trellis/.agents/.codex（若已存在）。
2. 使用分层架构：domain/application/ports/adapters/sites/entrypoints。
3. 加入 Playwright 扩展测试 fixture。
4. 加入 debug page。
5. 加入站点适配器模板。
6. 加入权限说明文档。
7. 不实现具体业务功能，先搭好工程和测试闭环。
```

**Linux Do It** 已完成上述脚手架；新功能请直接改根目录 `src/` / `entrypoints/` / `tests/`。

### 15.2 新增登录态网站适配

```txt
请按本 skill 给 <site> 增加站点适配器。功能需要登录后生效。要求：
1. 不使用真实账号。
2. 凭据从 .env.local 或 CI secret 读取。
3. 创建 selectors/detect/extract/actions/fixtures/README。
4. 新增 fixture test 和 logged-in smoke test。
5. content script 注入 DOM debug attributes。
6. debug page 显示 site/pageType/loggedIn/lastError。
```

### 15.3 修复真实浏览器失败

```txt
请使用 Chrome DevTools MCP 在隔离 Chrome profile 中验证当前插件。不要连接我的日常浏览器。请检查：
1. 插件是否加载。
2. service worker 是否有错误。
3. content script 是否注入。
4. popup/side panel/debug page 是否正常。
5. 目标网站登录态功能是否按 E2E 验收点通过。
修复代码后运行 pnpm test、pnpm build、pnpm e2e。
```

---

## 16. 官方参考

- Chrome Extensions docs: https://developer.chrome.com/docs/extensions
- Manifest V3 migration: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
- Extension service workers: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- Side Panel API: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- Chrome DevTools for agents: https://developer.chrome.com/docs/devtools/agents/get-started
- Playwright Chrome extensions: https://playwright.dev/docs/chrome-extensions
- Playwright authentication: https://playwright.dev/docs/auth
- Chrome for Testing availability: https://googlechromelabs.github.io/chrome-for-testing/
- WXT: https://wxt.dev/
