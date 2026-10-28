import argon2 from 'argon2';

/**
 * Hash de senha com Argon2id (recomendação OWASP).
 * Parâmetros: 19 MiB de memória, 2 iterações, paralelismo 1.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export const argon2Hasher: PasswordHasher = {
  hash: (plain) => argon2.hash(plain, ARGON2_OPTIONS),
  verify: async (hash, plain) => {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  },
};
