请按照 `.agents/skills/chrome-extension-workspace/SKILL.md` 为当前插件增加登录态 E2E 测试。

要求：

1. 使用专用测试账号或人工 bootstrap 的隔离 profile。
2. 不要在源码、日志或 prompt 中暴露真实密码、cookie、token。
3. 使用 Playwright persistent context 加载 `.output/chrome-mv3`。
4. 使用 `.profiles/playwright-site-e2e` 或环境变量指定 profile。
5. 测试断言：
   - 网站已登录。
   - content script 已注入。
   - `html[data-my-extension-ready="true"]` 存在。
   - `data-my-extension-site`、`data-my-extension-page-type`、`data-my-extension-logged-in` 正确。
   - popup/side panel/debug page 可打开。
   - console 无未捕获错误。
6. 如果遇到验证码/MFA，不要绕过；改为人工 bootstrap profile 流程。
