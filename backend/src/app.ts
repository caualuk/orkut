import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from './config/env.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import type { AuthService } from './modules/auth/auth.service.js';
import { SessionCookie } from './modules/auth/session-cookie.js';
import { AppError } from './shared/errors/app-error.js';
import { createErrorHandler, notFoundHandler } from './shared/http/error-handler.js';
import { originGuard } from './shared/http/origin-guard.js';
import type { Logger } from './shared/logger.js';

export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  authService: AuthService;
  /** Verificação de prontidão (ex.: `select 1` no banco). */
  healthCheck: () => Promise<void>;
  rateLimits?: {
    windowMs: number;
    globalMax: number;
    loginMax: number;
  };
}

const DEFAULT_RATE_LIMITS = {
  windowMs: 15 * 60 * 1000,
  globalMax: 300,
  loginMax: 10,
};

/**
 * Monta a aplicação Express a partir das dependências (composition root em
 * `server.ts`). Recebê-las por parâmetro mantém a app testável sem banco real.
 */
export function createApp(deps: AppDependencies): Express {
  const { config, logger, authService } = deps;
  const limits = deps.rateLimits ?? DEFAULT_RATE_LIMITS;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(pinoHttp({ logger, autoLogging: config.env !== 'test' }));
  app.use(
    helmet({
      // API pura: nenhum recurso deve ser carregado a partir das respostas.
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      strictTransportSecurity: config.isProduction,
    }),
  );
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    // Respostas da API contêm dados do usuário: nunca devem ir para cache.
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  const tooManyRequests = () => AppError.tooManyRequests();
  const globalLimiter = rateLimit({
    windowMs: limits.windowMs,
    limit: limits.globalMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => next(tooManyRequests()),
  });
  const loginRateLimiter = rateLimit({
    windowMs: limits.windowMs,
    limit: limits.loginMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Logins bem-sucedidos não consomem a cota: o foco é força bruta.
    skipSuccessfulRequests: true,
    handler: (_req, _res, next) => next(tooManyRequests()),
  });

  const api = express.Router();
  api.use(globalLimiter);
  api.use(originGuard(config.corsOrigins));

  api.get('/health', async (_req, res) => {
    try {
      await deps.healthCheck();
      res.json({ status: 'ok' });
    } catch (error) {
      logger.warn({ err: error }, 'Health check falhou');
      res.status(503).json({ status: 'unavailable' });
    }
  });

  api.use(
    '/auth',
    createAuthRouter({
      service: authService,
      cookie: new SessionCookie(config),
      loginRateLimiter,
    }),
  );

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
