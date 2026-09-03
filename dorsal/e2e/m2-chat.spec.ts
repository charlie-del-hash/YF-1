import { expect, test } from '@playwright/test';

/**
 * The chat surface, via /kit — the thread itself needs a session, but the
 * component's behaviour does not. What is asserted here is what the design
 * brief and the PRD promise about it, not that Realtime delivers (which is
 * covered by the RLS tests and by Supabase itself).
 */
test.describe('el chat del plan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kit');
    await page.getByPlaceholder('Escribe al grupo').scrollIntoViewIfNeeded();
  });

  test('el mensaje fijado va arriba y se puede quitar', async ({ page }) => {
    await expect(page.getByText('Fijado', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quitar el fijado' })).toBeVisible();
  });

  test('los días se separan en español', async ({ page }) => {
    await expect(page.getByText(/viernes, 11 de septiembre/)).toBeVisible();
  });

  test('no se puede enviar un mensaje vacío', async ({ page }) => {
    const send = page.getByRole('button', { name: 'Enviar' });
    await expect(send).toBeDisabled();
    await page.getByPlaceholder('Escribe al grupo').fill('   ');
    await expect(send).toBeDisabled();
    await page.getByPlaceholder('Escribe al grupo').fill('Llego cinco minutos tarde');
    await expect(send).toBeEnabled();
  });

  test('dice cuándo se cierra, que es la parte que sorprende', async ({ page }) => {
    await expect(page.getByText(/se cierra 48 h después del plan/)).toBeVisible();
  });

  test('el compositor tiene una etiqueta, aunque no se vea', async ({ page }) => {
    // A placeholder is not a label; a screen reader needs the real thing.
    await expect(page.getByLabel('Escribe al grupo')).toBeVisible();
  });
});
