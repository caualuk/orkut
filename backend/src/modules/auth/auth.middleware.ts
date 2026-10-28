import type { RequestHandler } from 'express';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthService } from './auth.service.js';
import type { SessionCookie } from './session-cookie.js';

/** Exige sessão válida e disponibiliza o usuário em `res.locals.user`. */
export function requireAuth(service: AuthService, cookie: SessionCookie): RequestHandler {
  return async (req, res, next) => {
    const user = await service.getUserFromSession(cookie.read(req));
    if (!user) {
      cookie.clear(res);
      return next(AppError.unauthorized());
    }
    res.locals.user = user;
    next();
  };
}
