# Architecture Review Checklist

## Layering

- [ ] `src/domain` 没有 import `chrome.*`、`window`、`document`、DOM selector。
- [ ] `src/application` 只依赖 ports，不依赖具体 adapters。
- [ ] `src/adapters/chrome` 集中封装 Chrome API。
- [ ] `src/sites/<site>` 集中管理目标网站 DOM selector、detect、extract、actions。
- [ ] UI 不直接操作目标网站 DOM。
- [ ] content script 不包含复杂业务规则。

## Modularity

- [ ] 每个新站点都有独立 adapter 目录。
- [ ] 每个 selector 都在 `selectors.ts`。
- [ ] 每个 use case 都可单测。
- [ ] message schema 使用 Zod 或等价运行时校验。

## Observability

- [ ] content script 设置 debug DOM attributes。
- [ ] debug page 能显示 site/pageType/loggedIn/lastError。
- [ ] 关键流程有 structured logs。
- [ ] 日志不会泄露 secret、cookie、token、个人数据。
