import { expect, test } from '@playwright/test';

/**
 * M5 is about a plan filling. The parts a browser can check without a session
 * are the share link — the only page in Dorsal that renders for someone who
 * has not signed up — and the host controls that make next week's plan cheap.
 */
test.describe('el enlace para compartir', () => {
  test('se abre sin sesión, sin mandarte a la puerta', async ({ page }) => {
    // A plan id that does not exist still has to render the public page rather
    // than redirect: the gate is what would turn a shared plan into a wall.
    const response = await page.goto('/p/00000000-0000-0000-0000-000000000000');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/p\//);
  });

  test('un plan que ya no está lo dice, y ofrece la salida', async ({ page }) => {
    await page.goto('/p/00000000-0000-0000-0000-000000000000');
    await expect(page.getByRole('heading', { name: 'Este plan ya no está.' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Ver los planes de esta semana' }),
    ).toBeVisible();
  });

  test('no se indexa: es un enlace que te han pasado, no un listado', async ({ page }) => {
    await page.goto('/p/00000000-0000-0000-0000-000000000000');
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveAttribute('content', /noindex/);
  });

  test('un id que no es un uuid no rompe la página', async ({ page }) => {
    const response = await page.goto('/p/no-soy-un-uuid');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Este plan ya no está.' })).toBeVisible();
  });
});

test.describe('crear el plan de la semana que viene', () => {
  test('el formulario pregunta si se repite, y por defecto no', async ({ page }) => {
    await page.goto('/kit');
    const repeat = page.getByLabel('¿Se repite?');
    await expect(repeat).toBeVisible();
    await expect(repeat).toHaveValue('once');
    await expect(page.getByText(/Creamos el siguiente cuando empiece este/)).toBeVisible();
  });

  test('semanal es una opción, y la única además de suelto', async ({ page }) => {
    await page.goto('/kit');
    const options = page.getByLabel('¿Se repite?').locator('option');
    await expect(options).toHaveCount(2);
    await expect(options.nth(0)).toHaveText('Es un plan suelto');
    await expect(options.nth(1)).toHaveText('Todas las semanas');
  });
});
