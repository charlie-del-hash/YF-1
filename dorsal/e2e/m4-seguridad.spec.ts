import { expect, test } from '@playwright/test';

/**
 * M4's "done when" is a sentence about a person: I could hand this to a
 * stranger and honestly tell her it's safe. These assertions are the parts of
 * that sentence a browser can check.
 */
test.describe('reportar y bloquear', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kit');
  });

  // The kit renders the menu twice — standalone and inside a chat message —
  // which is itself the point: it is wherever the person is.
  const menu = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: 'Opciones · Marta' }).first();

  test('están a tres toques desde donde aparece la persona', async ({ page }) => {
    await menu(page).click();
    await expect(page.getByRole('button', { name: 'Reportar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bloquear' })).toBeVisible();

    await page.getByRole('button', { name: 'Reportar' }).click();
    await expect(page.getByRole('heading', { name: '¿Qué ha pasado?' })).toBeVisible();
    // Reason, then send: the third tap.
    await expect(page.getByRole('button', { name: /Me he sentido en peligro/ })).toBeVisible();
    // "Reportar" both opens the flow and completes it: the word survives.
    await expect(page.getByRole('button', { name: 'Reportar' })).toHaveCount(1);
  });

  test('dice que lo lee una persona, no un algoritmo', async ({ page }) => {
    await menu(page).click();
    await page.getByRole('button', { name: 'Reportar' }).click();
    await expect(page.getByText(/Lo lee una persona, no un algoritmo/).first()).toBeVisible();
  });

  test('bloquear avisa de que no se le dice nada a la otra persona', async ({ page }) => {
    await menu(page).click();
    await page.getByRole('button', { name: 'Bloquear' }).click();
    await expect(page.getByText(/No se le avisa de nada/)).toBeVisible();
  });
});

test.describe('el control posterior al plan', () => {
  test('promete que es privado, que es lo que decide si alguien habla', async ({ page }) => {
    await page.goto('/kit');
    await expect(page.getByRole('heading', { name: '¿Todo bien?' })).toBeVisible();
    await expect(page.getByText(/No lo ve quien organiza/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Todo bien' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'No del todo' })).toBeVisible();
  });
});

test.describe('las páginas legales', () => {
  test('son públicas, sin sesión', async ({ page }) => {
    for (const slug of ['aviso', 'privacidad', 'cookies', 'condiciones']) {
      const response = await page.goto(`/legal/${slug}`);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(`/legal/${slug}`));
    }
  });

  test('avisan de que son un borrador', async ({ page }) => {
    await page.goto('/legal/privacidad');
    await expect(page.getByText(/Borrador/)).toBeVisible();
  });

  test('la de cookies explica por qué no hay banner', async ({ page }) => {
    await page.goto('/legal/cookies');
    await expect(page.getByText(/no verás un banner/)).toBeVisible();
    await expect(page.getByText(/rechazar cueste exactamente lo mismo que aceptar/)).toBeVisible();
  });

  test('la de privacidad dice que no hay reconocimiento facial', async ({ page }) => {
    await page.goto('/legal/privacidad');
    await expect(page.getByText(/No usamos reconocimiento facial/)).toBeVisible();
  });

  test('las condiciones dicen que esto no es para ligar', async ({ page }) => {
    await page.goto('/legal/condiciones');
    await expect(page.getByText(/Nadie usa esto para ligar/)).toBeVisible();
  });

  test('no hay banner de cookies en ninguna parte', async ({ page }) => {
    await page.goto('/entrar');
    const body = (await page.textContent('body')) ?? '';
    expect(body.toLowerCase()).not.toContain('aceptar cookies');
    expect(body.toLowerCase()).not.toContain('gestionar preferencias');
  });
});

test.describe('la cola de moderación', () => {
  test('no existe para quien no modera', async ({ page }) => {
    await page.goto('/admin');
    // Signed out, it is the door; signed in without the flag, it is a 404.
    await expect(page).toHaveURL(/\/entrar/);
  });
});
