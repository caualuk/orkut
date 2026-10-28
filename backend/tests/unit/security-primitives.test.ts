import { describe, expect, it } from 'vitest';
import { argon2Hasher } from '../../src/shared/security/password.js';
import { generateSessionToken, hashSessionToken } from '../../src/shared/security/session-token.js';

describe('argon2Hasher', () => {
  it('gera hash Argon2id com salt aleatório', async () => {
    const a = await argon2Hasher.hash('minha-senha');
    const b = await argon2Hasher.hash('minha-senha');

    expect(a).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain('minha-senha');
  });

  it('verifica a senha correta e rejeita a incorreta', async () => {
    const hash = await argon2Hasher.hash('minha-senha');
    await expect(argon2Hasher.verify(hash, 'minha-senha')).resolves.toBe(true);
    await expect(argon2Hasher.verify(hash, 'outra-senha')).resolves.toBe(false);
  });

  it('retorna false (sem lançar) para hash malformado', async () => {
    await expect(argon2Hasher.verify('nao-e-um-hash', 'x')).resolves.toBe(false);
  });
});

describe('session token', () => {
  it('gera tokens de 256 bits únicos em base64url', () => {
    const tokens = new Set(Array.from({ length: 100 }, generateSessionToken));
    expect(tokens.size).toBe(100);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it('armazena apenas o SHA-256 (32 bytes) do token', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toHaveLength(32);
    expect(hash.equals(hashSessionToken(token))).toBe(true);
    expect(hash.toString('base64url')).not.toBe(token);
  });
});
