import type { Page, Route } from '@playwright/test';

export const MOCK_USER = { id: 'u-1', email: 'paulo@orkut.com', displayName: 'Paulo' };
export const VALID_PASSWORD = 'senha-correta-123';

interface MockApiOptions {
  /** Começa com sessão ativa (GET /me → 200). */
  authenticated?: boolean;
  /** Atraso artificial do login, para observar o estado de carregamento. */
  loginDelayMs?: number;
  /** Força uma resposta específica no login. */
  loginStatus?: number;
}

/**
 * Simula a API de autenticação no navegador, mantendo o estado de sessão
 * como o backend real faria (login → /me 200, logout → /me 401).
 */
export async function mockAuthApi(page: Page, options: MockApiOptions = {}) {
  const state = {
    authenticated: options.authenticated ?? false,
    loginRequests: [] as unknown[],
    signupRequests: [] as unknown[],
    accountDeleted: false,
  };

  const json = (route: Route, status: number, body: unknown) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/api/auth/me', (route) =>
    state.authenticated
      ? json(route, 200, { user: MOCK_USER })
      : json(route, 401, { error: { code: 'UNAUTHORIZED', message: 'Não autenticado.' } }),
  );

  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON() as { email: string; password: string };
    state.loginRequests.push(body);
    if (options.loginDelayMs) await new Promise((r) => setTimeout(r, options.loginDelayMs));

    if (options.loginStatus === 429) {
      return json(route, 429, {
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
        },
      });
    }
    if (options.loginStatus === 500) {
      return json(route, 500, {
        error: { code: 'INTERNAL_ERROR', message: 'stack: db at 10.0.0.1' },
      });
    }
    if (body.email === MOCK_USER.email && body.password === VALID_PASSWORD) {
      state.authenticated = true;
      return json(route, 200, { user: MOCK_USER });
    }
    return json(route, 401, {
      error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' },
    });
  });

  await page.route('**/api/auth/signup', (route) => {
    const body = route.request().postDataJSON() as {
      firstName: string;
      lastName: string;
      email: string;
    };
    state.signupRequests.push(body);
    if (body.email === MOCK_USER.email) {
      return json(route, 409, {
        error: { code: 'EMAIL_TAKEN', message: 'Este e-mail já está em uso. Tente entrar.' },
      });
    }
    state.authenticated = true;
    return json(route, 201, {
      user: { id: 'u-2', email: body.email, displayName: `${body.firstName} ${body.lastName}` },
    });
  });

  await page.route('**/api/auth/logout', (route) => {
    state.authenticated = false;
    return route.fulfill({ status: 204 });
  });

  await page.route('**/api/auth/account', (route) => {
    const body = route.request().postDataJSON() as { password: string };
    if (body.password !== VALID_PASSWORD) {
      return json(route, 403, { error: { code: 'INVALID_PASSWORD', message: 'Senha incorreta.' } });
    }
    state.authenticated = false;
    state.accountDeleted = true;
    return route.fulfill({ status: 204 });
  });

  return state;
}
