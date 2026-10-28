import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

/**
 * Valida e normaliza `req.body` com um schema Zod. Campos desconhecidos são descartados.
 */
export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return next(AppError.badRequest('Dados inválidos.', fields));
    }
    req.body = result.data;
    next();
  };
}
