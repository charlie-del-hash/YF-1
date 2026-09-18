import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * No page may log an error.
 *
 * Added after a walkthrough of the live deploy reported React #418 — a
 * hydration mismatch — on every load of two screens, and three attempts to
 * reproduce it here came back clean. It could not be reproduced because
 * nothing was watching: the e2e suite asserted what was on the screen and
 * ignored what the console said about it.
 *
 * So this watches. It cannot see the two authenticated screens without a
 * session, which is why /kit now renders the components those screens are made
 * of — every one of them, on a page reachable without signing in.
 */
const IGNORE = [
  // The container running these tests cannot reach Supabase, so the realtime
  // socket fails here and only here. Everything else is a real finding.
  /supabase\.co\/realtime/,
  /WebSocket/,
];

function watch(page: Page): string[] {
  const problems: string[] = [];
  const record = (text: string) => {
    if (!IGNORE.some((pattern) => pattern.test(text))) problems.push(text);
  };
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') record(message.text());
  });
  page.on('pageerror', (error) => record(error.message));
  page.on('requestfailed', (request) => {
    // An aborted request is normal: Next prefetches the routes a page links to
    // and the browser cancels those in flight when the page goes away. Only a
    // request that actually failed is a finding.
    const reason = request.failure()?.errorText ?? '';
    if (reason.includes('ERR_ABORTED')) return;
    record(`request failed (${reason}): ${request.url()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) record(`${response.status()} ${response.url()}`);
  });
  return problems;
}

const PAGES = [
  '/entrar',
  '/kit',
  '/legal',
  '/legal/privacidad',
  '/legal/cookies',
  '/sin-conexion',
  '/p/00000000-0000-0000-0000-000000000000',
];

for (const path of PAGES) {
  test(`${path} no escribe nada en la consola`, async ({ page }) => {
    const problems = watch(page);
    await page.goto(path, { waitUntil: 'networkidle' });
    // Hydration mismatches are reported after hydration, not during load.
    await page.waitForTimeout(600);
    expect(problems, `${path} logged:\n${problems.join('\n')}`).toEqual([]);
  });
}
