import { expect, test } from '@playwright/test';

/**
 * Configured, but the project cannot be reached — a phone on the metro, a
 * deploy mid-flight, a paused project.
 *
 * This is a regression test with a real story behind it. `signInWithOtp`
 * *rejects* rather than returning an error when the request never completes,
 * and every client call site here sets a pending flag before the call and
 * cleared it after, so the button sat on "Mandando…" for ever with nothing to
 * act on. The fix is lib/actions.ts `attempt()` plus a try/catch here.
 */
test.describe('sin conexión con el proyecto', () => {
  test('el acceso dice qué ha pasado en vez de quedarse pensando', async ({ page }) => {
    await page.goto('/entrar');
    await page.getByLabel('Tu correo').fill('charlie@example.com');
    await page.getByRole('button', { name: 'Mandarme el enlace' }).click();

    // Next's route announcer is also role=alert, so target the form's own.
    await expect(page.getByRole('alert').filter({ hasText: /no hemos podido/i })).toContainText(
      /no hemos podido conectar/i,
      { timeout: 20_000 },
    );

    // Back to a usable form, not stuck mid-send, and never claiming a link was
    // sent when none was.
    await expect(page.getByRole('button', { name: 'Mandarme el enlace' })).toBeEnabled();
    await expect(page.getByText(/mírate el correo/i)).toHaveCount(0);
  });

  test('el enlace vuelve al sitio donde estás, no a uno de configuración', async ({ page }) => {
    // The redirect used to be assembled from an environment variable, which is
    // the one thing that can be wrong on a fresh deploy without anything
    // saying so: the mail arrives and the link goes somewhere else, and it
    // reads as "expired". Now it comes from the browser's own origin, so this
    // asserts what actually leaves the page.
    let redirect: string | null = null;
    await page.route('**/auth/v1/otp**', async (route) => {
      const url = new URL(route.request().url());
      const body = route.request().postDataJSON?.() ?? {};
      redirect =
        url.searchParams.get('redirect_to') ??
        (body as { options?: { emailRedirectTo?: string } }).options?.emailRedirectTo ??
        null;
      await route.abort();
    });

    await page.goto('/entrar');
    await page.getByLabel('Tu correo').fill('charlie@example.com');
    await page.getByRole('button', { name: 'Mandarme el enlace' }).click();
    await expect.poll(() => redirect, { timeout: 15_000 }).toContain('/auth/callback');
    expect(redirect).toContain(new URL(page.url()).origin);
  });

  test('la app sigue cerrada, no medio abierta', async ({ page }) => {
    await page.goto('/planes');
    await expect(page).toHaveURL(/\/entrar/);
  });

  test('una ruta desconocida no confirma ni desmiente nada', async ({ page }) => {
    // Signed out, an unknown plan id and an unknown route are indistinguishable:
    // both go to the door. Telling a stranger "this plan does not exist" would
    // also tell them, by elimination, which ones do — which is the whole point
    // of hiding solo mujeres plans behind the same 404 as a bad link.
    await page.goto('/planes/no-existe-esta-ruta-larga');
    await expect(page).toHaveURL(/\/entrar/);
    await page.goto('/ruta-inventada');
    await expect(page).toHaveURL(/\/entrar/);
  });
});
