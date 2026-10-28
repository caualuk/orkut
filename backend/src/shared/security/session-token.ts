import { createHash, randomBytes } from 'node:crypto';

/**
 * Tokens de sessão opacos: 256 bits aleatórios entregues ao cliente via cookie.
 * No banco é armazenado apenas o SHA-256, de modo que um vazamento da tabela
 * não permite sequestrar sessões.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}
