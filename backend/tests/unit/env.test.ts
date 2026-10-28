import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env.js';

const base = {
  DATABASE_URL: 'postgresql://user:s3cr3t@localhost:5432/db',
  DATABASE_SSL: 'false',
};

describe('loadConfig', () => {
  it('aplica valores padrão seguros', () => {
    const config = loadConfig(base);

    expect(config.env).toBe('development');
    expect(config.port).toBe(3000);
    expect(config.corsOrigins).toEqual(['http://localhost:4200']);
    expect(config.session.cookieName).toBe('orkut_sid');
    expect(config.session.ttlMs).toBe(12 * 60 * 60 * 1000);
  });

  it('usa cookie com prefixo __Host- em produção', () => {
    const config = loadConfig({ ...base, NODE_ENV: 'production' });
    expect(config.isProduction).toBe(true);
    expect(config.session.cookieName).toBe('__Host-orkut_sid');
  });

  it('exige validação TLS do certificado quando SSL está ativo', () => {
    const config = loadConfig({ ...base, DATABASE_SSL: 'true' });
    expect(config.database.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('separa múltiplas origens de CORS', () => {
    const config = loadConfig({ ...base, CORS_ORIGINS: 'https://a.com, https://b.com' });
    expect(config.corsOrigins).toEqual(['https://a.com', 'https://b.com']);
  });

  it('falha sem DATABASE_URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('não expõe valores de variáveis na mensagem de erro', () => {
    try {
      loadConfig({ ...base, PORT: 'porta-invalida-s3cr3t' });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain('PORT');
      expect(String(error)).not.toContain('s3cr3t');
    }
  });
});
