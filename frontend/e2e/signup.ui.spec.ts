import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { MOCK_USER, mockAuthApi } from './support/mock-api';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/** Endpoints sociais usados pelo onboarding (foto e interesses). */
async function mockOnboardingApi(page: Page, options: { photoStatus?: number } = {}) {
  const calls = { photo: [] as string[], profile: [] as unknown[] };
  await page.route('**/api/social/profile/photo', (route) => {
    calls.photo.push(route.request().headers()['content-type'] ?? '');
    return route.fulfill({ status: options.photoStatus ?? 204 });
  });
  await page.route('**/api/social/profile', (route) => {
    calls.profile.push(route.request().postDataJSON());
    return route.fulfill({ status: 204 });
  });
  return calls;
}

async function choose(page: Page, testId: string, option: string) {
  await page.getByTestId(testId).click();
  await page.getByRole('option', { name: option }).click();
}

async function fillStepOne(page: Page, email = 'nina@orkut.com') {
  await page.getByTestId('first-name').fill('Nina');
  await page.getByTestId('last-name').fill('Costa');
  await choose(page, 'gender', 'Feminino');
  await choose(page, 'relationship', 'Namorando');
  await page.getByTestId('birth-date').fill('1995-03-12');
  await page.getByTestId('city').fill('São Paulo, SP');
  await page.getByTestId('signup-email').fill(email);
  await page.getByTestId('signup-password').fill('saudade2004');
}

async function finishStepTwo(page: Page, withPhoto = true) {
  if (withPhoto) {
    await page.getByTestId('signup-photo').setInputFiles({
      name: 'eu.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await expect(page.getByAltText('Prévia da foto de perfil')).toBeVisible();
  }
  await page.getByTestId('signup-about').fill('Fã de café e de scraps.');
  await page.getByTestId('accept-terms').locator('input').check();
  await page.getByTestId('signup-submit').click();
}

const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

test.describe('Cadastro em etapas', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthApi(page);
    await page.goto('/cadastro');
  });

  test('etapa 1 tem as informações gerais, e-mail e senha', async ({ page }) => {
    await expect(page).toHaveTitle('Criar conta · orkut');
    await expect(page.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeVisible();
    await expect(page.getByTestId('signup-progress')).toContainText('Etapa 1 de 2');
    for (const id of ['first-name', 'last-name', 'gender', 'relationship', 'birth-date', 'city']) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    await expect(page.getByTestId('signup-photo')).toHaveCount(0);
  });

  test('as duas etapas não têm violações de acessibilidade nem rolagem horizontal', async ({
    page,
  }) => {
    expect((await axe(page)).violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    await fillStepOne(page);
    await page.getByTestId('signup-next').click();
    await expect(page.getByTestId('signup-step-2')).toBeVisible();
    expect((await axe(page)).violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('não avança com a etapa 1 incompleta', async ({ page }) => {
    await page.getByTestId('signup-next').click();
    await expect(page.getByText('Informe seu nome.')).toBeVisible();
    await expect(page.getByText('Informe sua cidade.')).toBeVisible();
    await expect(page.getByTestId('signup-step-2')).toHaveCount(0);
  });

  test('medidor mostra a força da senha', async ({ page }) => {
    await page.getByTestId('signup-password').fill('abc');
    await expect(page.locator('#password-strength')).toContainText('Senha fraca');
    await page.getByTestId('signup-password').fill('Saudade#2004!');
    await expect(page.locator('#password-strength')).toContainText('Senha forte');
  });

  test('voltar da etapa 2 preserva o que foi preenchido', async ({ page }) => {
    await fillStepOne(page);
    await page.getByTestId('signup-next').click();
    await page.getByTestId('signup-back').click();
    await expect(page.getByTestId('first-name')).toHaveValue('Nina');
    await expect(page.getByTestId('city')).toHaveValue('São Paulo, SP');
  });

  test('fluxo completo: dados → foto e descrição → conta → interesses → Home', async ({ page }) => {
    const api = await mockOnboardingApi(page);
    const signup = page.waitForRequest('**/api/auth/signup');

    await fillStepOne(page);
    await page.getByTestId('signup-next').click();
    await expect(page.getByTestId('signup-progress')).toContainText('Etapa 2 de 2');
    await finishStepTwo(page);

    expect((await signup).postDataJSON()).toMatchObject({
      firstName: 'Nina',
      gender: 'feminino',
      relationship: 'namorando',
      birthDate: '1995-03-12',
      city: 'São Paulo, SP',
      about: 'Fã de café e de scraps.',
      acceptTerms: true,
    });

    await expect(page).toHaveURL(/\/boas-vindas$/);
    expect(api.photo).toEqual(['image/png']);
    await expect(page.getByTestId('interests-title')).toContainText('Nina');

    const save = page.getByTestId('save-interests');
    await expect(save).toBeDisabled();
    for (const name of ['Música', 'Café']) await page.getByRole('button', { name }).click();
    await page.getByTestId('custom-interest').fill('Skate');
    await page.getByTestId('add-interest').click();
    await expect(save).toBeEnabled();
    expect((await axe(page)).violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    await save.click();
    await expect(page).toHaveURL(/\/home$/);
    expect(api.profile).toEqual([{ interests: ['Música', 'Café', 'Skate'] }]);
  });

  test('pular os interesses leva à Home sem gravar nada', async ({ page }) => {
    const api = await mockOnboardingApi(page);
    await fillStepOne(page);
    await page.getByTestId('signup-next').click();
    await finishStepTwo(page, false);

    await expect(page).toHaveURL(/\/boas-vindas$/);
    await page.getByTestId('skip-interests').click();
    await expect(page).toHaveURL(/\/home$/);
    expect(api.photo).toEqual([]);
    expect(api.profile).toEqual([]);
  });

  test('falha só na foto não desfaz o cadastro e avisa na tela seguinte', async ({ page }) => {
    await mockOnboardingApi(page, { photoStatus: 500 });
    await fillStepOne(page);
    await page.getByTestId('signup-next').click();
    await finishStepTwo(page);

    await expect(page).toHaveURL(/\/boas-vindas$/);
    await expect(page.getByTestId('photo-warning')).toBeVisible();
  });

  test('e-mail já cadastrado volta para a etapa 1 com o erro', async ({ page }) => {
    await fillStepOne(page, MOCK_USER.email);
    await page.getByTestId('signup-next').click();
    await finishStepTwo(page, false);

    await expect(page.getByTestId('signup-error')).toHaveText(/já está em uso/);
    await expect(page.getByTestId('signup-step-1')).toBeVisible();
    await expect(page).toHaveURL(/\/cadastro$/);
  });

  test('a tela de interesses exige sessão', async ({ page }) => {
    await page.goto('/boas-vindas');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fboas-vindas$/);
  });
});
