import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Cursor sandbox may point Playwright at an empty cache; prefer the host
// install under %LOCALAPPDATA%\ms-playwright when present.
function resolvePlaywrightBrowsersPath(): void {
  const localBrowsers = path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  const configured = process.env.PLAYWRIGHT_BROWSERS_PATH;

  const hasChromium = (root: string) =>
    fs.existsSync(root) &&
    fs.readdirSync(root).some((name) => name.startsWith('chromium'));

  if (configured && hasChromium(configured)) return;
  if (hasChromium(localBrowsers)) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowsers;
  }
}

resolvePlaywrightBrowsersPath();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
