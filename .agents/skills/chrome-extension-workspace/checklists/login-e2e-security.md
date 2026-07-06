# Logged-in E2E Security Checklist

- [ ] 使用专用测试账号，不使用真实个人账号。
- [ ] 使用隔离 Chrome profile，不连接日常浏览器。
- [ ] 凭据来自 `.env.local`、CI secret 或 secret manager。
- [ ] `.profiles/` 已加入 `.gitignore`。
- [ ] `.env.local` 已加入 `.gitignore`。
- [ ] 测试日志不会打印密码、cookie、token、authorization header。
- [ ] fixture 已脱敏。
- [ ] 如果存在 MFA/验证码，没有尝试绕过；使用测试 IdP/TOTP 或人工 bootstrap。
- [ ] DevTools MCP 只连接测试 profile。
- [ ] E2E 验证了 content script、site adapter、popup/side panel、service worker、console/network。
