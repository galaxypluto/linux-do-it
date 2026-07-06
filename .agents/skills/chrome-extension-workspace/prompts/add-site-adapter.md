请按照 `.agents/skills/chrome-extension-workspace/SKILL.md` 为下面目标网站新增站点适配器：

- Site name: <填入>
- Origin: <填入>
- 是否需要登录: yes/no
- 页面类型: <login/dashboard/detail/editor/...>
- 功能目标: <填入>

要求：

1. 创建 `src/sites/<site>/manifest.ts`、`selectors.ts`、`detect.ts`、`extract.ts`、`actions.ts`、`README.md`。
2. 所有 selector 只能写在 `selectors.ts`。
3. detect 必须返回 supported、loggedIn、pageType、confidence。
4. content script 必须暴露 debug DOM attributes。
5. 创建脱敏 fixture 说明和 fixture test。
6. 如果需要登录，创建 logged-in smoke test，但不要使用真实账号。
7. 更新权限说明。
