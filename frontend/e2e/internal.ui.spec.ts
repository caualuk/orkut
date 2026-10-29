import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockAuthApi } from './support/mock-api';

/** Telas internas (dados de demonstração em memória) com sessão simulada. */
const SCREENS = [
  { path: '/home', title: 'Início · orkut' },
  { path: '/perfil/editar', title: 'Editar perfil · orkut' },
  { path: '/recados', title: 'Recados · orkut' },
  { path: '/album', title: 'Álbum · orkut' },
  { path: '/feeds', title: 'Feeds · orkut' },
  { path: '/mensagens', title: 'Mensagens · orkut' },
  { path: '/depoimentos', title: 'Depoimentos · orkut' },
  { path: '/configuracoes', title: 'Configurações · orkut' },
  { path: '/amigos', title: 'Amigos · orkut' },
  { path: '/comunidades/eu-odeio-acordar-cedo', title: 'Comunidade · orkut' },
];

test.beforeEach(async ({ page }) => {
  await mockAuthApi(page, { authenticated: true });
});

for (const screen of SCREENS) {
  test.describe(`Tela ${screen.path}`, () => {
    test('carrega, é acessível e não rola na horizontal', async ({ page }) => {
      await page.goto(screen.path);
      await expect(page).toHaveTitle(screen.title);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

      // Espera a entrada em cascata dos cards (opacidade parcial distorce o contraste no axe).
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getTiming().iterations !== Infinity)
            .map((a) => a.finished),
        ),
      );

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  });
}

test('rotas internas exigem sessão', async ({ page }) => {
  await mockAuthApi(page, { authenticated: false });
  await page.goto('/recados');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Frecados$/);
});

test('/comunidades abre a comunidade principal e /perfil a Home', async ({ page }) => {
  await page.goto('/comunidades');
  await expect(page).toHaveURL(/\/comunidades\/eu-odeio-acordar-cedo$/);
  await page.goto('/perfil');
  await expect(page).toHaveURL(/\/home$/);
});

test('Home: aceitar pedido de amizade remove o card', async ({ page }) => {
  await page.goto('/home');
  await page.getByTestId('accept-request').click();
  await expect(page.getByTestId('accept-request')).toHaveCount(0);
});

test('Recados: filtra, envia e curte', async ({ page, isMobile }) => {
  await page.goto('/recados');
  await expect(page.getByTestId('scrap-item')).toHaveCount(5);

  await page.getByTestId('scrap-filter-nao-lidos').click();
  await expect(page.getByTestId('scrap-item')).toHaveCount(2);

  if (isMobile) await page.getByTestId('scrap-fab').click();
  await page.getByTestId('scrap-composer').fill('Bora marcar o reencontro!');
  await page.getByTestId('send-scrap').click();
  await expect(page.getByTestId('scrap-filter-enviados')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('scrap-list')).toContainText('Bora marcar o reencontro!');
});

test('Recados: "Deixar scrap" em Amigos endereça o composer', async ({ page, isMobile }) => {
  await page.goto('/amigos');
  await page.getByRole('link', { name: 'Deixar scrap para Diego Souza' }).click();
  await expect(page).toHaveURL(/\/recados\?para=diego$/);
  if (isMobile) await page.getByTestId('scrap-fab').click();
  await expect(page.getByTestId('scrap-composer')).toHaveAttribute(
    'placeholder',
    'Escreva um recado para Diego…',
  );
});

test('Mensagens: abre a conversa e envia uma mensagem', async ({ page }) => {
  await page.goto('/mensagens');
  await page.getByTestId('conversation-item').filter({ hasText: 'Jean Lima' }).click();
  await expect(page).toHaveURL(/\/mensagens\/jean$/);

  await page.getByTestId('message-input').fill('Valeu pelo link!');
  await page.getByTestId('send-message').click();
  await expect(page.getByTestId('chat-thread')).toContainText('Valeu pelo link!');
});

test('Depoimentos: aprovar pendente o publica entre os recebidos', async ({ page }) => {
  await page.goto('/depoimentos');
  await expect(page.getByTestId('pending-testimonial')).toHaveCount(1);
  await page.getByTestId('approve-testimonial').click();
  await expect(page.getByTestId('pending-testimonial')).toHaveCount(0);
  await expect(page.getByTestId('testimonial-list')).toContainText('café quando o prazo aperta');
});

test('Configurações: tema escuro aplica data-theme e persiste', async ({ page }) => {
  await page.goto('/configuracoes');
  await page.getByTestId('theme-escuro').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('Amigos: busca e filtros', async ({ page }) => {
  await page.goto('/amigos?busca=nina');
  await expect(page.getByTestId('friend-card')).toHaveCount(1);

  await page.getByTestId('friend-search').fill('');
  await page.getByTestId('friend-filter-melhores').click();
  await expect(page.getByTestId('friend-card')).toHaveCount(2);
});

test('Comunidade: sair/participar e criar tópico', async ({ page }) => {
  await page.goto('/comunidades/eu-odeio-acordar-cedo');
  const membership = page.getByTestId('toggle-membership');
  await expect(membership).toHaveAttribute('aria-pressed', 'true');
  await membership.click();
  await expect(membership).toHaveAttribute('aria-pressed', 'false');

  await page.getByTestId('new-topic').click();
  await page.getByTestId('compose-text').fill('Café antes das 7h conta como madrugada?');
  await page.getByTestId('compose-submit').click();
  await expect(page.getByTestId('topic-list')).toContainText('Café antes das 7h');
});

test('Editar perfil: salvar atualiza o nome no app', async ({ page, isMobile }) => {
  await page.goto('/perfil/editar');
  await page.getByLabel('Nome', { exact: true }).fill('Paulinho');
  await page.getByTestId(isMobile ? 'save-profile-mobile' : 'save-profile').click();
  await expect(page.getByText('Perfil atualizado!')).toBeVisible();

  if (!isMobile) await expect(page.getByTestId('profile-name')).toContainText('Paulinho');
});

test('Navegação mobile: drawer abre, navega e fecha', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Drawer existe só no compact/medium');
  await page.goto('/home');
  await page.getByTestId('open-drawer').click();
  await expect(page.getByTestId('drawer')).toBeVisible();
  await page.getByTestId('drawer').getByTestId('menu-depoimentos').click();
  await expect(page).toHaveURL(/\/depoimentos$/);
  await expect(page.getByTestId('drawer')).toHaveCount(0);
});
