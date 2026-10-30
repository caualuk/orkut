import { Router, type RequestHandler } from 'express';
import { validateBody } from '../../shared/http/validate.js';
import { requireAuth } from './auth.middleware.js';
import {
  deleteAccountSchema,
  loginSchema,
  signupSchema,
  type DeleteAccountBody,
  type LoginBody,
  type SignupBody,
} from './auth.schemas.js';
import type { AuthService } from './auth.service.js';
import type { PublicUser } from './auth.types.js';
import type { SessionCookie } from './session-cookie.js';

export interface AuthRouterDeps {
  service: AuthService;
  cookie: SessionCookie;
  loginRateLimiter: RequestHandler;
  signupRateLimiter: RequestHandler;
}

/**
 * Rotas de autenticação:
 *  POST /signup → cria a conta, inicia sessão e define cookie HttpOnly
 *  POST /login  → cria sessão e define cookie HttpOnly
 *  POST /logout → revoga sessão e remove cookie
 *  GET  /me     → retorna o usuário da sessão atual
 *  DELETE /account → confirma a senha, exclui a conta e todos os dados, remove cookie
 */
export function createAuthRouter({
  service,
  cookie,
  loginRateLimiter,
  signupRateLimiter,
}: AuthRouterDeps): Router {
  const router = Router();

  router.post('/signup', signupRateLimiter, validateBody(signupSchema), async (req, res) => {
    const { firstName, lastName, email, password, birthDate, gender } = req.body as SignupBody;
    const result = await service.signup(
      { firstName, lastName, email, password, birthDate, gender },
      { ipAddress: req.ip ?? null, userAgent: req.get('user-agent') ?? null },
    );

    cookie.write(res, result.token, result.expiresAt, result.persistent);
    res.status(201).json({ user: result.user });
  });

  router.post('/login', loginRateLimiter, validateBody(loginSchema), async (req, res) => {
    const body = req.body as LoginBody;
    const result = await service.login(body, {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });

    cookie.write(res, result.token, result.expiresAt, result.persistent);
    res.status(200).json({ user: result.user });
  });

  router.post('/logout', async (req, res) => {
    await service.logout(cookie.read(req));
    cookie.clear(res);
    res.status(204).end();
  });

  router.get('/me', requireAuth(service, cookie), (_req, res) => {
    res.json({ user: res.locals.user });
  });

  // Mesmo limitador do login: senhas erradas contam contra força bruta com sessão roubada.
  router.delete(
    '/account',
    loginRateLimiter,
    requireAuth(service, cookie),
    validateBody(deleteAccountSchema),
    async (req, res) => {
      const { password } = req.body as DeleteAccountBody;
      await service.deleteAccount(res.locals.user as PublicUser, password);
      cookie.clear(res);
      res.status(204).end();
    },
  );

  return router;
}
