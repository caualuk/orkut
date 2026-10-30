import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/**
 * Esquema das variáveis de ambiente. A aplicação falha na inicialização
 * (fail-fast) se alguma variável obrigatória estiver ausente ou inválida.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:4200')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'Deve ser uma URL postgres://'),
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  DATABASE_SSL_CA_PATH: z.string().optional(),
  // Conteúdo PEM da CA (aceita `\n` literal): alternativa ao _PATH em ambientes sem
  // acesso ao arquivo. Tem precedência sobre ele.
  DATABASE_SSL_CA: z
    .string()
    .optional()
    .transform((value) => value?.replace(/\\n/g, '\n').trim() || undefined),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(12),
  SESSION_REMEMBER_DAYS: z.coerce.number().int().positive().default(30),
});

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  corsOrigins: string[];
  trustProxy: number;
  database: {
    url: string;
    ssl: false | { rejectUnauthorized: true; ca?: string };
  };
  session: {
    cookieName: string;
    ttlMs: number;
    rememberMs: number;
  };
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    // Nunca exibe os valores, apenas os nomes das variáveis inválidas.
    throw new Error(`Variáveis de ambiente inválidas: ${fields}`);
  }

  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';

  return {
    env: env.NODE_ENV,
    isProduction,
    port: env.PORT,
    corsOrigins: env.CORS_ORIGINS,
    trustProxy: env.TRUST_PROXY,
    database: {
      url: env.DATABASE_URL,
      ssl: env.DATABASE_SSL
        ? {
            rejectUnauthorized: true,
            ...(env.DATABASE_SSL_CA
              ? { ca: env.DATABASE_SSL_CA }
              : env.DATABASE_SSL_CA_PATH && {
                  ca: readFileSync(resolve(env.DATABASE_SSL_CA_PATH), 'utf8'),
                }),
          }
        : false,
    },
    session: {
      // O prefixo __Host- exige Secure + Path=/ e impede sobrescrita por subdomínios.
      cookieName: isProduction ? '__Host-orkut_sid' : 'orkut_sid',
      ttlMs: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
      rememberMs: env.SESSION_REMEMBER_DAYS * 24 * 60 * 60 * 1000,
    },
  };
}
