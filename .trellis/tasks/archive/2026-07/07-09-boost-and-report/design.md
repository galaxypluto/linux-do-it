# Design: Boost + Post Flag

## API (`src/discourse/api.ts`)
- `createBoost(postId, raw)` → POST `/discourse-boosts/posts/{postId}/boosts` body `{ raw }`
- `deleteBoost(boostId)` → DELETE `/discourse-boosts/boosts/{boostId}`
- `fetchBoost(boostId)` → GET `/discourse-boosts/boosts/{boostId}`（补全 `can_delete`）
- `normalizeBoosts` + `READER_CACHE_VERSION` bump when post shape gains `boosts` / `can_boost`

## Native post flag
- UI: `PostAction` `action="flag"`
- Content: `handleNativePostAction("flag", …)` → `requestNativePostAction`
- Page: `pageBridge.js` `runNativeFlag` opens Discourse `FlagModal` + `PostFlag`
- `pageStyle.ts` `ldcv-elevate-native-modal` raises native modal above Reader

## Boost UI
- `BoostList` / `BoostBubble` / `BoostInputPopover` / `BoostToolbarAction`
- Bubble menu: delete only（无阅读器内 Boost 举报）

## Out of design
- 自研 `ReportModal`
- `flagPost` / Boost flag API 封装
