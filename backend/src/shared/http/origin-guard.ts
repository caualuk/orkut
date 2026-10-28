import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defesa contra CSRF em camadas (além do cookie SameSite=Strict):
 * requisições que alteram estado precisam de um cabeçalho Origin (ou Referer)
 * pertencente à lista de origens autorizadas.
 */
export function originGuard(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);

  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.get('origin') ?? originFromReferer(req.get('referer'));
    if (!origin || !allowed.has(origin)) {
      return next(AppError.forbidden('Origem da requisição não autorizada.'));
    }
    next();
  };
}

function originFromReferer(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}
