import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { MOCK_USER, mockAuthApi } from './support/mock-api';

async function fillValidForm(page: Page, email = 'nina@orkut.com') {
  await page.getByTestId('first-name').fill('Nina');
  await page.getByTestId('last-name').fill('Costa');
  await page.getByTestId('signup-email').fill(email);
  await page.getByTestId('signup-password').fill('saudade2004');
  await page.getByTestId('accept-terms').locator('input').check();
}

test.describe('Tela de cadastro', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/cadastro');
  });

  test('exibe os elementos do design', async ({ page }) => {
    await expect(page).toHaveTitle('Criar conta · orkut');
    await expect(page.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeVisible();
    await expect(page.getByText('Leva menos de 1 minuto. É grátis!')).toBeVisible();
    await expect(page.getByTestId('signup-submit')).toHaveText(/Criar minha conta/);
    await expect(page.getByRole('link', { name: 'Já tem conta? Entrar' })).toBeVisible();
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

  test('valida campos obrigatórios, regra de senha e termos', async ({ page }) => {
    await page.getByTestId('signup-submit').click();
    await expect(page.getByText('Informe seu nome.')).toBeVisible();
    await expect(page.getByText('Informe seu e-mail.')).toBeVisible();
    await expect(page.getByText('Crie uma senha.')).toBeVisible();
    await expect(page.getByText('É preciso aceitar os termos para continuar.')).toBeVisible();

    await page.getByTestId('signup-password').fill('somenteletras');
    await page.getByTestId('signup-password').blur();
    await expect(page.getByText('Use ao menos 8 caracteres, com letras e números.')).toBeVisible();
  });

  test('medidor mostra a força da senha', async ({ page }) => {
    await page.getByTestId('signup-password').fill('abc');
    await expect(page.locator('#password-strength')).toContainText('Senha fraca');
    await page.getByTestId('signup-password').fill('Saudade#2004!');
    await expect(page.locator('#password-strength')).toContainText('Senha forte');
  });

  test('cria a conta e entra direto na Home', async ({ page }) => {
    await fillValidForm(page);
    await page.getByTestId('signup-submit').click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId('home-greeting')).toContainText('Nina');
  });

  test('e-mail já cadastrado mostra o erro da API', async ({ page }) => {
    await fillValidForm(page, MOCK_USER.email);
    await page.getByTestId('signup-submit').click();

    await expect(page.getByTestId('signup-error')).toHaveText(/já está em uso/);
    await expect(page).toHaveURL(/\/cadastro$/);
  });
});
