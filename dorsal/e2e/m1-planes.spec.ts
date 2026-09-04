import { expect, test } from '@playwright/test';

/**
 * M1 surfaces that can be exercised without a Supabase project, via /kit — the
 * component reference, which renders the create form and the filter bar from
 * fixed sample data. Everything that needs a session is in the gated block at
 * the bottom.
 */
test.describe('crear un plan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kit');
  });

  test('el formulario pide lo que hace falta y nada más', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Crear un plan' })).toBeVisible();
    for (const label of ['¿Qué deporte?', 'Día', 'Hora', 'Punto de encuentro', 'Desde', 'Hasta']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    // No bio, no photo, no "sobre ti": a plan is not a profile.
    await expect(page.getByText(/sobre ti/i)).toHaveCount(0);
  });

  test('la fecha elegida se repite en español, porque el selector nativo no lo hace', async ({
    page,
  }) => {
    // The fixture is prefilled with 2026-09-12 at 19:30 Madrid.
    await expect(page.getByText(/sábado, 12 de septiembre · 19:30/)).toBeVisible();
  });

  test('el nivel se muestra tal y como saldrá en la ficha', async ({ page }) => {
    await expect(page.getByText('6:00–7:00 min/km a 5:00–5:30 min/km')).toBeVisible();
  });

  test('cambiar de deporte cambia la escala de nivel', async ({ page }) => {
    await page.getByLabel('¿Qué deporte?', { exact: true }).selectOption('padel');
    await expect(page.getByText(/^Nivel /).first()).toBeVisible();
  });

  test('marcar un sitio en el mapa avisa de que solo valen sitios públicos', async ({ page }) => {
    await page.getByRole('button', { name: 'Marcarlo en el mapa' }).click();
    await expect(page.getByText(/Marca solo sitios públicos/)).toBeVisible();
    await expect(page.getByText(/Nunca un portal ni una casa/)).toBeVisible();
  });

  test('la advertencia de solo mujeres solo aparece si se elige', async ({ page }) => {
    const help = page.getByText(/No aparecerá en los planes de nadie más/);
    await expect(help).toHaveCount(0);
    await page.getByLabel('Quién puede apuntarse', { exact: true }).selectOption('solo_mujeres');
    await expect(help).toBeVisible();
  });
});

test.describe('filtros del deck', () => {
  test('cuentan en singular y en plural', async ({ page }) => {
    await page.goto('/kit');
    // The fixture has one filter on.
    await expect(page.getByRole('button', { name: '1 filtro' })).toBeVisible();
    await expect(page.getByRole('button', { name: '1 filtros' })).toHaveCount(0);
  });

  test('se abren y se cierran', async ({ page }) => {
    await page.goto('/kit');
    const toggle = page.getByRole('button', { name: '1 filtro' });
    await expect(page.getByLabel('Deporte', { exact: true })).toBeVisible();
    await toggle.click();
    await expect(page.getByLabel('Deporte', { exact: true })).toHaveCount(0);
  });
});

test.describe('rutas cerradas sin sesión', () => {
  for (const path of ['/mis-planes', '/planes/nuevo']) {
    test(`${path} lleva a la entrada`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/entrar/);
    });
  }
});
