# Release Checklist

## Build

- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm e2e`
- [ ] `pnpm zip`

## Manifest

- [ ] manifest_version = 3
- [ ] permissions 最小化
- [ ] host permissions 最小化
- [ ] optional permissions 合理
- [ ] minimum_chrome_version 合理
- [ ] action、side_panel、options 配置正确

## Security

- [ ] 没有远程托管可执行代码。
- [ ] 没有硬编码 API key。
- [ ] 没有提交 `.env.local`。
- [ ] 没有提交 `.profiles/`。
- [ ] source map 策略符合发布要求。
- [ ] CSP 合理。

## Store

- [ ] 单一目的说明清晰。
- [ ] 权限解释清晰。
- [ ] 隐私政策覆盖数据流。
- [ ] 截图、描述、支持邮箱准备好。
- [ ] 版本号已更新。
