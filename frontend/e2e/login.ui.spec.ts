import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { MOCK_USER, mockAuthApi, VALID_PASSWORD } from './support/mock-api';

const emailField = (page: Page) => page.getByLabel('E-mail');
const passwordField = (page: Page) => page.getByLabel('Senha', { exact: true });
const submitButton = (page: Page) => page.getByTestId('login-submit');

test.describe('Tela de login · renderização', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/login');
  });

  test('exibe os elementos do design', async ({ page, isMobile }) => {
    await expect(page).toHaveTitle('Entrar · orkut');
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Seus amigos, scraps e comunidades. De volta.' }),
    ).toBeVisible();
    await expect(emailField(page)).toBeVisible();
    await expect(passwordField(page)).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Lembrar de mim' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Esqueci a senha' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Criar conta grátis' })).toBeVisible();
    await expect(submitButton(page)).toHaveText(/Entrar no orkut/);

    // Compact (< 600px): eyebrow, subtítulo e cartões flutuantes saem; o card vira bottom sheet.
    const eyebrow = page.getByText('A NOSTALGIA, REIMAGINADA');
    if (isMobile) {
      await expect(eyebrow).toBeHidden();
      await expect(page.getByText('Que bom te ver de novo! Acesse sua conta.')).toBeHidden();
    } else {
      await expect(eyebrow).toBeVisible();
      await expect(page.getByText('Lucas Braga')).toBeVisible();
    }
  });

  test('a cena 3D é decorativa e não aparece na árvore de acessibilidade', async ({ page }) => {
    await expect(page.locator('ok-login-scene')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('heading', { name: 'Lucas Braga' })).toHaveCount(0);
  });

  test('não tem violações de acessibilidade (axe · WCAG 2.1 AA)', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('não gera rolagem horizontal', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('ordem de foco segue o fluxo do formulário', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Navegação por teclado avaliada no desktop');
    await emailField(page).focus();
    await page.keyboard.press('Tab');
    await expect(passwordField(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Mostrar senha' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('checkbox', { name: 'Lembrar de mim' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Esqueci a senha' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(submitButton(page)).toBeFocused();
  });
});

test.describe('Tela de login · validação e feedback', () => {
  test('valida campos obrigatórios sem chamar a API', async ({ page }) => {
    const api = await mockAuthApi(page);
    await page.goto('/login');

    await submitButton(page).click();

    await expect(page.getByText('Informe seu e-mail.')).toBeVisible();
    await expect(page.getByText('Informe sua senha.')).toBeVisible();
    await expect(emailField(page)).toBeFocused();
    expect(api.loginRequests).toHaveLength(0);
  });

  test('valida formato do e-mail', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/login');
    await emailField(page).fill('paulo-sem-arroba');
    await passwordField(page).fill('x');
    await submitButton(page).click();
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
  });

  test('mostra/oculta a senha', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/login');
    await passwordField(page).fill('segredo');

    await page.getByRole('button', { name: 'Mostrar senha' }).click();
    await expect(passwordField(page)).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Ocultar senha' }).click();
    await expect(passwordField(page)).toHaveAttribute('type', 'password');
  });

  test('exibe erro genérico para credenciais inválidas', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/login');
    await emailField(page).fill(MOCK_USER.email);
    await passwordField(page).fill('errada');
    await submitButton(page).click();

    const alert = page.getByRole('alert');
    await expect(alert).toHaveText(/E-mail ou senha inválidos\./);
    await expect(alert).toBeFocused();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('exibe mensagem de limite de tentativas (429)', async ({ page }) => {
    await mockAuthApi(page, { loginStatus: 429 });
    await page.goto('/login');
    await emailField(page).fill(MOCK_USER.email);
    await passwordField(page).fill('x');
    await submitButton(page).click();
    await expect(page.getByRole('alert')).toHaveText(/Muitas tentativas/);
  });

  test('não exibe detalhes internos em erro 500', async ({ page }) => {
    await mockAuthApi(page, { loginStatus: 500 });
    await page.goto('/login');
    await emailField(page).fill(MOCK_USER.email);
    await passwordField(page).fill('x');
    await submitButton(page).click();
    await expect(page.getByRole('alert')).toHaveText(/Algo deu errado/);
    await expect(page.getByText('10.0.0.1')).toHaveCount(0);
  });

  test('bloqueia duplo envio e mostra o spinner', async ({ page }) => {
    const api = await mockAuthApi(page, { loginDelayMs: 800 });
    await page.goto('/login');
    await emailField(page).fill(MOCK_USER.email);
    await passwordField(page).fill(VALID_PASSWORD);
    await submitButton(page).click();

    await expect(submitButton(page)).toBeDisabled();
    await expect(submitButton(page)).toHaveText(/Entrando…/);
    await submitButton(page).click({ force: true });
    await page.waitForURL('**/home');
    expect(api.loginRequests).toHaveLength(1);
  });
});

test.describe('Navegação e redirecionamentos', () => {
  test('login bem-sucedido leva à Home e o logout volta ao login', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/login');
    await emailField(page).fill(MOCK_USER.email);
    await passwordField(page).fill(VALID_PASSWORD);
    await submitButton(page).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page).toHaveTitle('Início · orkut');
    await expect(page.getByTestId('home-greeting')).toContainText('Paulo');

    await page.getByTestId('account-menu').click();
    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('Enter no campo de senha envia o formulário', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/login');
    await emailField(page).fill(MOCK_USER.email);
    await passwordField(page).fill(VALID_PASSWORD);
    await passwordField(page).press('Enter');
    await expect(page).toHaveURL(/\/home$/);
  });

  test('rota raiz sem sessão redireciona para o login com returnUrl', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fhome$/);
  });

  test('rota protegida preserva o destino e retorna a ele após o login', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/home?aba=scraps');
    await expect(page).toHaveURL(/returnUrl=%2Fhome%3Faba%3Dscraps/);

    await emailField(page).fill(MOCK_USER.email);
    await passwordField(page).fill(VALID_PASSWORD);
    await submitButton(page).click();
    await expect(page).toHaveURL(/\/home\?aba=scraps$/);
  });

  test('returnUrl externo é ignorado (Open Redirect)', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/login?returnUrl=//evil.example.com');
    await emailField(page).fill(MOCK_USER.email);
    await passwordField(page).fill(VALID_PASSWORD);
    await submitButton(page).click();
    // Continua na própria origem (qualquer porta local), nunca no domínio externo.
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/home$/);
  });

  test('usuário autenticado que acessa /login vai direto para a Home', async ({ page }) => {
    await mockAuthApi(page, { authenticated: true });
    await page.goto('/login');
    await expect(page).toHaveURL(/\/home$/);
  });

  test('"Criar conta grátis" leva ao cadastro', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/login');
    await page.getByRole('link', { name: 'Criar conta grátis' }).click();
    await expect(page).toHaveURL(/\/cadastro$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeVisible();
    await page.getByTestId('login-link').click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('"Esqueci a senha" leva à recuperação', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/login');
    await page.getByRole('link', { name: 'Esqueci a senha' }).click();
    await expect(page).toHaveURL(/\/recuperar-senha$/);
    await expect(page.getByTestId('page-title')).toHaveText('Recuperar senha');
  });

  test('rota inexistente mostra a página 404', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/rota-que-nao-existe');
    await expect(page.getByTestId('page-title')).toHaveText('Página não encontrada');
    await expect(page).toHaveTitle('Página não encontrada · orkut');
  });

  test('voltar do navegador após o logout não reabre a Home', async ({ page }) => {
    await mockAuthApi(page, { authenticated: true });
    await page.goto('/home');
    await page.getByTestId('account-menu').click();
    await page.getByTestId('logout-button').click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Movimento reduzido', () => {
  test.use({ reducedMotion: 'reduce' });

  test('desliga as animações contínuas da cena 3D', async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/login');
    const animation = await page
      .locator('ok-login-scene .float')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(animation).toBe('none');
  });
});
