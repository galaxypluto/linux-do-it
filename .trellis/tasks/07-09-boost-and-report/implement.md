# Implement: Boost + Post Flag

## Done
- [x] `createBoost` / `deleteBoost` / `fetchBoost` + `normalizeBoosts`（cache v16）
- [x] Boost UI：`BoostList` / `BoostBubble` / `BoostInputPopover` / `BoostToolbarAction`
- [x] 主贴 / 评论工具栏布局与 Boost 空状态入口
- [x] 帖子原生 Flag：`pageBridge.runNativeFlag` + z-index elevate
- [x] 举报文案「举报窗口处理中」+ 成功条「打开原生视图」样式
- [x] 明确不做：阅读器内 Boost 举报、自研 ReportModal

## Validation
- [x] `pnpm typecheck` / `pnpm test`
- [x] 手动 QA：Boost 增删、帖子举报弹窗
