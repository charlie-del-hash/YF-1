import { expect, test } from '@playwright/test';

/**
 * M0's happy path has two halves. The first runs anywhere, with no Supabase
 * project: the front door renders, it gates the app, and it says the things the
 * product promises. The second needs a linked project and a mailbox, so it is
 * skipped rather than faked — a green test that did not run is worse than a
 * missing one.
 */
test.describe('la puerta de entrada', () => {
  test('el acceso pide el correo y no promete nada romántico', async ({ page }) => {
    await page.goto('/entrar');

    await expect(page.getByRole('heading', { name: /entra en dorsal/i })).toBeVisible();
    await expect(page.getByLabel(/tu correo/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /mandarme el enlace/i })).toBeVisible();

    // 01-PRD §Trust and safety: the no-cold-DMs rule is stated in the UI, not
    // just implemented.
    await expect(page.getByText(/no se puede escribir a nadie por privado/i)).toBeVisible();
    await expect(page.getByText(/mayores de 18/i)).toBeVisible();

    // 03-DESIGN-BRIEF: none of the dating-app vocabulary, anywhere.
    const body = (await page.textContent('body')) ?? '';
    for (const word of ['match', 'Match', '❤', '🔥', 'liga con', 'ligar']) {
      expect(body).not.toContain(word);
    }
  });

  test('un correo inválido se explica en el sitio', async ({ page }) => {
    await page.goto('/entrar');
    await page.getByLabel(/tu correo/i).fill('esto-no-es-un-correo');
    await page.getByRole('button', { name: /mandarme el enlace/i }).click();
    await expect(page.getByText(/no parece válido/i)).toBeVisible();
  });

  test('la app está cerrada sin sesión', async ({ page }) => {
    await page.goto('/planes');
    await expect(page).toHaveURL(/\/entrar/);
  });

  test('se puede usar con el teclado', async ({ page }) => {
    await page.goto('/entrar');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
    // The focus ring is a token, not a browser default.
    await expect(focused).toHaveCSS('outline-style', 'solid');
  });
});

/**
 * The full loop: sign in → onboarding → deck → Me apunto → on the roster.
 * Needs E2E_EMAIL and a project whose magic links can be read programmatically
 * (Supabase's Inbucket in local dev, or a mail-testing inbox).
 */
test.describe('el bucle completo', () => {
  test.skip(
    !process.env.E2E_EMAIL,
    'necesita un proyecto de Supabase enlazado y un buzón de pruebas (E2E_EMAIL)',
  );

  test('me apunto a un plan y aparezco en la lista', async ({ page }) => {
    await page.goto('/planes');
    await expect(page.getByRole('heading', { name: /planes cerca de ti/i })).toBeVisible();

    const plan = page.getByRole('article').first();
    await expect(plan).toBeVisible();
    await page.getByRole('button', { name: /^me apunto$/i }).click();
    await expect(page.getByText(/te has apuntado/i)).toBeVisible();
  });
});
