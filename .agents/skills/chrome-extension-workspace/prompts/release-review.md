请按照 `.agents/skills/chrome-extension-workspace/SKILL.md` 对当前 Chrome 插件做发布前审查。

检查：

1. Manifest V3 配置。
2. permissions / host_permissions / optional_permissions。
3. 远程代码风险。
4. API key、cookie、token 泄漏风险。
5. content script 数据采集边界。
6. side panel / popup / options / debug page 是否符合发布策略。
7. 测试结果：unit、fixture、E2E、build、zip。
8. Chrome Web Store 单一目的、权限解释、隐私政策材料。

请输出问题列表、风险等级和具体修复建议。
