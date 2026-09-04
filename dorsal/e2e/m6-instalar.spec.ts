import { expect, test } from '@playwright/test';

/**
 * M6 is the app becoming an app: installable, openable in a tunnel, and able
 * to reach a phone that is not looking at it.
 *
 * What a browser can check here is the shell. Push itself needs a real device
 * with a real subscription and a real push service, so it is verified by hand
 * against the deploy — the crypto underneath is pinned by the RFC 8291 vector
 * in lib/push/encrypt.test.ts, which is the part that cannot be eyeballed.
 */
test.describe('el manifiesto', () => {
  test('existe, sin sesión, y describe una app instalable', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.short_name).toBe('Dorsal');
    expect(manifest.display).toBe('standalone');
    expect(manifest.lang).toBe('es-ES');
    // Chrome wants both sizes before it will offer to install.
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    // And a maskable one, or Android crops the bib into a circle.
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  });

  test('arranca en los planes, no en la portada', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    // Someone who installed this has already signed in. Landing them on a
    // front page every time is a tax on the people who liked it most.
    expect(manifest.start_url).toBe('/planes');
  });
});

test.describe('los iconos', () => {
  for (const icon of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) {
    test(`${icon} se sirve de verdad`, async ({ request }) => {
      const response = await request.get(`/icons/${icon}`);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    });
  }
});

test.describe('el service worker', () => {
  test('se sirve desde la raíz, que es su alcance', async ({ request }) => {
    const response = await request.get('/sw.js');
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("addEventListener('push'");
    expect(body).toContain("addEventListener('notificationclick'");
  });

  test('no guarda en caché ninguna página con datos de nadie', async ({ request }) => {
    const body = await (await request.get('/sw.js')).text();
    // Only two things may be written to the cache: the offline page, at
    // install, and content-hashed build output. A cached roster served to the
    // next person on the device would be worse than any amount of offline
    // breakage, so the list of what gets cached is asserted rather than
    // described.
    expect(body).toContain('/_next/static/');
    expect(body).toContain('/icons/');
    const cachedPaths = [...body.matchAll(/url\.pathname\.startsWith\('([^']+)'\)/g)].map(
      (m) => m[1],
    );
    expect(cachedPaths.sort()).toEqual(['/_next/static/', '/icons/']);
    // And nothing is ever served from the cache for a navigation except the
    // offline page.
    expect(body).not.toMatch(/caches\.match\(request\)[\s\S]{0,40}navigate/);
  });

  test('se registra al cargar la app', async ({ page }) => {
    await page.goto('/entrar');
    const registered = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration('/');
      return Boolean(registration);
    });
    expect(registered).toBe(true);
  });
});

test.describe('sin conexión', () => {
  test('la página existe y se abre sin sesión', async ({ page }) => {
    const response = await page.goto('/sin-conexion');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reintentar' })).toBeVisible();
  });

  test('es lo que sirve el worker cuando falla una navegación', async ({ page, context }) => {
    await page.goto('/entrar');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.goto('/planes').catch(() => {});
    await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible();
    await context.setOffline(false);
  });
});
