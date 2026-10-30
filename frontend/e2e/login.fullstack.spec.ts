import { expect, test } from '@playwright/test';

/**
 * Fluxo real: Angular → proxy → API Express → PostgreSQL (Supabase).
 * Cria um usuário próprio pelo cadastro, com e-mail único a cada execução.
 */
const email = `e2e-${Date.now()}@orkut.test`;
const password = 'senhaE2E2026';

test.describe('Login full-stack', () => {
  // Um worker por vez: evita consumir o rate limit do login em paralelo.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ playwright, baseURL }) => {
    // Contexto isolado: o cookie do cadastro não vaza para os testes de login.
    const api = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Origin: baseURL! },
    });
    const signup = await api.post('/api/auth/signup', {
      data: { firstName: 'Teste', lastName: 'E2E', email, password, acceptTerms: true },
    });
    expect(signup.ok()).toBe(true);
    await api.dispose();
  });

  test('autentica, protege o cookie e encerra a sessão', async ({ page, context }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(email!);
    await page.getByLabel('Senha', { exact: true }).fill(password!);
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId('home-greeting')).toBeVisible();

    // Cookie de sessão: HttpOnly, SameSite=Strict, inacessível ao JavaScript.
    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === 'orkut_sid');
    expect(session).toBeDefined();
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe('Strict');
    expect(session?.expires).toBe(-1); // sem "Lembrar de mim": cookie de sessão

    const exposed = await page.evaluate(() => ({
      cookie: document.cookie,
      local: Object.keys(localStorage).length,
      session: Object.keys(sessionStorage).length,
    }));
    expect(exposed).toEqual({ cookie: '', local: 0, session: 0 });

    // A sessão sobrevive a um reload.
    await page.reload();
    await expect(page).toHaveURL(/\/home$/);

    // /login com sessão ativa → Home.
    await page.goto('/login');
    await expect(page).toHaveURL(/\/home$/);

    await page.getByTestId('account-menu').click();
    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await context.cookies()).find((c) => c.name === 'orkut_sid')).toBeUndefined();

    await page.goto('/home');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fhome$/);
  });

  test('"Lembrar de mim" gera cookie persistente', async ({ page, context }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(email!);
    await page.getByLabel('Senha', { exact: true }).fill(password!);
    await page.getByRole('checkbox', { name: 'Lembrar de mim' }).check();
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/home$/);

    const session = (await context.cookies()).find((c) => c.name === 'orkut_sid');
    const days = ((session?.expires ?? 0) * 1000 - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);
  });

  test('senha incorreta mostra erro genérico', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(email!);
    await page.getByLabel('Senha', { exact: true }).fill('senha-incorreta');
    await page.getByTestId('login-submit').click();
    await expect(page.getByRole('alert')).toHaveText(/E-mail ou senha inválidos\./);
  });

  test('API aplica cabeçalhos de segurança e bloqueia origem não autorizada', async ({
    request,
  }) => {
    const health = await request.get('/api/health');
    expect(health.ok()).toBe(true);
    expect(health.headers()['x-content-type-options']).toBe('nosniff');
    expect(health.headers()['cache-control']).toBe('no-store');

    const csrf = await request.post('/api/auth/login', {
      headers: { Origin: 'https://evil.example.com' },
      data: { email, password },
    });
    expect(csrf.status()).toBe(403);
  });
});
