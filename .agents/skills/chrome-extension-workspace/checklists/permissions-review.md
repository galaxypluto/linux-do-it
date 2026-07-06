# Permissions Review Checklist

每新增一个权限，回答：

- [ ] 为什么需要这个权限？
- [ ] 它服务哪个用户可见功能？
- [ ] 是否能改成 optional permission？
- [ ] 是否能缩小 host scope？
- [ ] 是否可以用 `activeTab` 替代？
- [ ] 是否可以用 `declarativeNetRequest` 替代更高风险 API？
- [ ] 是否会触发强权限警告？
- [ ] 是否涉及用户数据采集或传输？
- [ ] `docs/PERMISSIONS.md` 是否更新？
- [ ] 隐私政策是否需要更新？

高风险权限需要额外审查：

- [ ] `<all_urls>`
- [ ] `tabs`
- [ ] `webRequest`
- [ ] `debugger`
- [ ] `cookies`
- [ ] `history`
- [ ] `bookmarks`
