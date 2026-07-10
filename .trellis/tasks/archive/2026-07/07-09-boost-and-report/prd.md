# Add Boost and Report features

## Goal
在独立阅读器中支持 Discourse `discourse-boosts` 短回复，以及帖子原生 Flag 举报，保持沉浸式阅读体验。

## Background Facts
- Linux.do 使用 `discourse-boosts` 插件，短回复以胶囊（头像 + 文本）展示在帖子下方。
- Topic JSON 的 `post_stream` 中每条 post 可带 `boosts` / `can_boost`。
- 帖子举报复用 Discourse 原生 `FlagModal` + `PostFlag`（经 pageBridge 打开，并抬高 z-index 盖过 Reader）。
- Boost 举报不在阅读器内实现；需要时可在原贴原生 UI 操作。

## Requirements
- **Boost 展示**：在主贴 / 评论正文下渲染 `BoostList`（头像 + 单行截断文本）。
- **Boost 添加**：`can_boost` 为真时显示火箭入口；内联输入；乐观更新。
- **Boost 删除**：`can_delete` 为真时可删除（权限未知时按需 `GET /discourse-boosts/boosts/:id`）。
- **帖子举报**：操作栏 Flag 图标 → 打开原生举报窗口；成功反馈含「打开原生视图」链接。

## Acceptance Criteria
- [x] API 返回的 boosts 正确渲染。
- [x] 长文本 CSS 截断。
- [x] 可添加 boost（含乐观更新）。
- [x] 可删除自己的 boost。
- [x] 帖子可打开原生 Flag 弹窗。
- [x] Boost 阅读器内无举报入口（刻意不做）。

## Out of Scope
- 用户主页 boost 动态流。
- 阅读器内 Boost 举报 / 自研 ReportModal。
