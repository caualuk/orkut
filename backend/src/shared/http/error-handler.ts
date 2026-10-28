import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import type { Logger } from '../logger.js';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(AppError.notFound('Rota não encontrada.'));
};

/**
 * Tratamento central de erros. Erros inesperados nunca expõem stack trace,
 * mensagem interna ou detalhes do banco ao cliente.
 */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (err instanceof AppError) {
      res.status(err.status).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }

    // Erros do body-parser (JSON malformado, payload grande demais).
    const status = typeof err?.status === 'number' ? err.status : undefined;
    if (status === 400 || status === 413 || status === 415) {
      res.status(status).json({
        error: {
          code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
          message: status === 413 ? 'Requisição muito grande.' : 'Requisição inválida.',
        },
      });
      return;
    }

    logger.error({ err, path: req.path }, 'Erro não tratado');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente mais tarde.' },
    });
  };
}
