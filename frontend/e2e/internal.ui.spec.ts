import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockAuthApi } from './support/mock-api';
import { initialSocialState, mockSocialApi, PEOPLE } from './support/mock-social-api';

/** Telas internas com sessão e API social simuladas (estado em memória, pessoas de teste). */
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
  { path: '/comunidades', title: 'Comunidades · orkut' },
];

let social: Awaited<ReturnType<typeof mockSocialApi>>;

test.beforeEach(async ({ page }) => {
  await mockAuthApi(page, { authenticated: true });
  social = await mockSocialApi(page);
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
  // Troca o mock de sessão ativa (beforeEach) por um sem sessão.
  await page.unrouteAll({ behavior: 'wait' });
  await mockAuthApi(page, { authenticated: false });
  await page.goto('/recados');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Frecados$/);
});

test('sem dados fictícios: conta nova vê telas vazias', async ({ page }) => {
  const empty = initialSocialState();
  Object.assign(empty, {
    friends: [],
    friendRequests: [],
    suggestions: [],
    scraps: [],
    conversations: [],
    testimonials: [],
    feed: [],
  });
  await mockSocialApi(page, empty);
  await page.goto('/feeds');
  await expect(page.getByTestId('feed-empty')).toContainText('Nada novo por aqui');
  await page.goto('/comunidades');
  await expect(page.getByTestId('no-communities')).toBeVisible();
});

test('Home: aceitar pedido de amizade remove o card', async ({ page }) => {
  await page.goto('/home');
  await page.getByTestId('accept-request').click();
  await expect(page.getByTestId('accept-request')).toHaveCount(0);
  expect(social.requests).toContainEqual(
    expect.objectContaining({ path: '/friends/accept', body: { userId: PEOPLE.carla.id } }),
  );
});

test('Recados: filtra, envia e curte com animação', async ({ page, isMobile }) => {
  await page.goto('/recados');
  await expect(page.getByTestId('scrap-item')).toHaveCount(2);

  await page.getByTestId('scrap-filter-nao-lidos').click();
  await expect(page.getByTestId('scrap-item')).toHaveCount(1);
  await page.getByTestId('scrap-filter-todos').click();

  const like = page.getByTestId('scrap-item').first().getByTestId('like-button');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  // A animação (salto + partículas) é coberta no teste unitário do LikeButton.
  await expect(like).toContainText('1');

  if (isMobile) await page.getByTestId('scrap-fab').click();
  await page.getByTestId('scrap-composer').fill('Bora marcar o reencontro!');
  await page.getByTestId('send-scrap').click();
  await expect(page.getByTestId('scrap-list')).toContainText('Bora marcar o reencontro!');
});

test('Mensagens: abre a conversa e envia uma mensagem', async ({ page }) => {
  await page.goto('/mensagens');
  await page.getByTestId('conversation-item').filter({ hasText: 'Ana Teste' }).click();
  await expect(page).toHaveURL(new RegExp(`/mensagens/${PEOPLE.ana.id}$`));

  await page.getByTestId('message-input').fill('Valeu!');
  await page.getByTestId('send-message').click();
  await expect(page.getByTestId('chat-thread')).toContainText('Valeu!');
});

test('Depoimentos: aprovar pendente o publica entre os recebidos', async ({ page }) => {
  await page.goto('/depoimentos');
  await expect(page.getByTestId('pending-testimonial')).toHaveCount(1);
  await page.getByTestId('approve-testimonial').click();
  await expect(page.getByTestId('pending-testimonial')).toHaveCount(0);
  await expect(page.getByTestId('testimonial-list')).toContainText('Depoimento de teste');
});

test('Feeds: publica status, curte e comenta com animação', async ({ page }) => {
  await page.goto('/feeds');
  await page.getByTestId('status-input').fill('Testando o feed!');
  await page.getByTestId('status-submit').click();
  await expect(page.getByTestId('feed-item').first()).toContainText('Testando o feed!');

  const item = page.getByTestId('feed-item').filter({ hasText: 'Status de teste' });
  await item.getByTestId('like-button').click();
  await expect(item.getByTestId('like-button')).toHaveAttribute('aria-pressed', 'true');

  await item.getByTestId('comment-toggle').click();
  await item.getByTestId('comment-input').fill('Que legal!');
  await item.getByTestId('comment-send').click();
  const comment = item.getByTestId('comment').last();
  await expect(comment).toContainText('Que legal!');
  await expect(comment).toHaveClass(/is-fresh/);
});

test('Feeds: aniversário vem da data de nascimento dos amigos', async ({ page, isMobile }) => {
  test.skip(isMobile, 'No compact o card aparece entre os itens');
  await page.goto('/feeds');
  await expect(page.getByText('Hoje é aniversário de Ana')).toBeVisible();
});

test('Configurações: tema escuro aplica data-theme e é salvo na API', async ({ page }) => {
  await page.goto('/configuracoes');
  await page.getByTestId('theme-escuro').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(social.requests).toContainEqual(
    expect.objectContaining({ path: '/settings', body: { theme: 'escuro' } }),
  );

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('Amigos: busca amigos e pessoas reais para adicionar', async ({ page }) => {
  await page.goto('/amigos?busca=ana');
  await expect(page.getByTestId('friend-card')).toHaveCount(1);

  await page.getByTestId('friend-search').fill('davi');
  const people = page.getByTestId('people-results');
  await expect(people).toContainText('Davi Teste');
  await people.getByTestId('add-friend').click();
  await expect(people.getByTestId('add-friend')).toHaveText('Pedido enviado');
  expect(social.requests).toContainEqual(
    expect.objectContaining({ path: '/friends/request', body: { userId: PEOPLE.davi.id } }),
  );
});

test('Comunidades: cria a própria comunidade e publica um tópico', async ({ page }) => {
  await page.goto('/comunidades');
  await page.getByTestId('create-community').click();
  await page.getByTestId('form-name').fill('Amantes de café');
  await page.getByTestId('form-category').fill('Gastronomia');
  await page.getByTestId('form-submit').click();

  await expect(page).toHaveURL(/\/comunidades\/amantes-de-cafe$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Amantes de café');
  await expect(page.getByTestId('toggle-membership')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('new-topic').click();
  await page.getByTestId('compose-text').fill('Qual o melhor grão?');
  await page.getByTestId('compose-submit').click();
  await expect(page.getByTestId('topic-list')).toContainText('Qual o melhor grão?');
});

test('Editar perfil: sem a aba Pessoal e salvar atualiza o nome', async ({ page, isMobile }) => {
  await page.goto('/perfil/editar');
  await expect(page.getByRole('tab', { name: 'Pessoal' })).toHaveCount(0);
  await page.getByLabel('Nome', { exact: true }).fill('Paulinho');
  await page.getByTestId(isMobile ? 'save-profile-mobile' : 'save-profile').click();
  await expect(page.getByText('Perfil atualizado!')).toBeVisible();
  expect(social.requests).toContainEqual(
    expect.objectContaining({
      path: '/profile',
      body: expect.objectContaining({ firstName: 'Paulinho' }),
    }),
  );
  if (!isMobile) await expect(page.getByTestId('profile-name')).toContainText('Paulinho');
});

test('texto estático não mostra cursor de digitação', async ({ page }) => {
  await page.goto('/home');
  const caret = await page
    .getByRole('heading', { level: 1 })
    .evaluate((el) => getComputedStyle(el).caretColor);
  expect(caret).toBe('rgba(0, 0, 0, 0)');
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
