# Target Site Adapter

## Site

- Origin: `https://target-site.example.com`
- Requires login: yes/no
- Supported page types:
  - login
  - dashboard
  - detail

## Permissions

说明本适配器需要哪些 host permissions，以及为什么需要。

## Detection Rules

说明 `detect.ts` 使用哪些 DOM 信号判断登录态和页面类型。

## Known Fragility

记录容易变化的 selector、A/B 测试、懒加载、iframe、shadow DOM 等。

## Test Account

不要在这里写账号密码。只说明凭据来源：`.env.local`、CI secret 或人工 bootstrap profile。
