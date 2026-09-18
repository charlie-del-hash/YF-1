import { expect, test } from '@playwright/test';

/**
 * Palabra's design rule is a single sentence in 01-PRD — reliability is a gate,
 * not a scoreboard, and nobody should feel ranked — which makes it exactly the
 * kind of rule that erodes one screen at a time. These assertions are the
 * erosion alarm.
 */
test.describe('la palabra', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kit');
  });

  test('pregunta al participante y da las dos respuestas', async ({ page }) => {
    await expect(page.getByText(/¿Fuiste al plan del sábado\?/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sí, fui' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Al final no pude' })).toBeVisible();
  });

  test('dice que la ventana son 72 h, que es lo que no se adivina', async ({ page }) => {
    await expect(page.getByText(/72 h para decirlo/)).toBeVisible();
  });

  test('la lista del anfitrión es un toque por persona', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '¿Quién vino?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Vino', exact: true })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'No vino', exact: true })).toHaveCount(2);
  });

  test('lo ya marcado se ve marcado', async ({ page }) => {
    const marked = page.getByRole('button', { name: 'Vino', exact: true }).nth(1);
    await expect(marked).toHaveAttribute('aria-pressed', 'true');
  });

  test('en ninguna parte se rankea a nadie', async ({ page }) => {
    const body = (await page.textContent('body')) ?? '';
    for (const word of ['ranking', 'puntos', 'nivel de confianza', 'oro', 'plata', 'bronce', 'top ']) {
      expect(body.toLowerCase()).not.toContain(word);
    }
    // No score iconography either: the accent colour is for the dorsal number.
    expect(body).not.toMatch(/[⭐🏆🥇✅❌]/u);
  });
});
