import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Some CI images ship a Chromium that Playwright did not download itself, at a
 * revision its version manifest does not know. Point at it rather than pulling
 * a second copy: set PLAYWRIGHT_CHROMIUM_PATH, or drop it under
 * PLAYWRIGHT_BROWSERS_PATH and this finds it. Falls back to Playwright's own
 * managed browser, which is what a normal machine uses.
 */
function preinstalledChromium(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium-')) continue;
    const candidate = join(root, entry, 'chrome-linux', 'chrome');
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * One happy path per milestone, on a phone-sized viewport — the product is
 * used one-handed on the metro, so that is what gets tested.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'movil',
      use: {
        ...devices['Pixel 7'],
        launchOptions: { executablePath: preinstalledChromium() },
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm build && pnpm start',
        url: 'http://localhost:3000/entrar',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
