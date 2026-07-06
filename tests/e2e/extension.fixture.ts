import { test as base, chromium, type BrowserContext, type Page, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const extensionPath = path.resolve(process.env.EXTENSION_PATH ?? '.output/chrome-mv3');
const configuredUserDataDir = process.env.E2E_USER_DATA_DIR
  ? path.resolve(process.env.E2E_USER_DATA_DIR)
  : null;
const chromeExecutablePath = resolveChromeExecutablePath();

function resolveChromeExecutablePath() {
  const candidates = [
    process.env.E2E_CHROME_PATH,
    process.env.CHROME_PATH,
    ...findInstalledPlaywrightChromium(),
    path.join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function findInstalledPlaywrightChromium() {
  const browserRoot = path.join(process.env.LOCALAPPDATA ?? '', 'ms-playwright');
  if (!fs.existsSync(browserRoot)) return [];

  return fs
    .readdirSync(browserRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }))
    .flatMap((entry) => [
      path.join(browserRoot, entry.name, 'chrome-win64/chrome.exe'),
      path.join(browserRoot, entry.name, 'chrome-win/chrome.exe'),
    ]);
}

type Fixtures = {
  context: BrowserContext;
  extensionId: string;
  openExtensionPage: (pathInExtension: string) => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  context: async ({}, use, testInfo) => {
    if (!fs.existsSync(extensionPath)) {
      throw new Error(
        `Extension build not found at ${extensionPath}. Run pnpm build before extension E2E.`,
      );
    }

    const userDataDir = configuredUserDataDir ?? testInfo.outputPath('profile');
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      executablePath: chromeExecutablePath,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }

    const extensionId = serviceWorker.url().split('/')[2];
    await use(extensionId);
  },

  openExtensionPage: async ({ context, extensionId }, use) => {
    await use(async (pathInExtension: string) => {
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/${pathInExtension.replace(/^\//, '')}`);
      await expect(page.locator('body')).toBeVisible();
      return page;
    });
  },
});

export { expect } from '@playwright/test';
