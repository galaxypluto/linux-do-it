import { test, expect } from '@playwright/test';

test('basic e2e environment verification', async ({ page }) => {
  // 这是一个占位测试，用来确保 Playwright 环境能正常运行且不会与 Vitest 冲突
  expect(true).toBe(true);
});
