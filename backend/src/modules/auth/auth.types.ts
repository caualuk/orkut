import type { RELATIONSHIPS } from '../social/social.types.js';

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

/** Representação do usuário que pode sair da API (sem dados sensíveis). */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
}

export interface NewSession {
  userId: string;
  tokenHash: Buffer;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
  remember: boolean;
}

export type Gender = 'feminino' | 'masculino' | 'outro' | 'nao-informar';

export type Relationship = (typeof RELATIONSHIPS)[number];

/** Usuário + linha inicial de `app.profiles`, gravados juntos no cadastro. */
export interface NewUser {
  email: string;
  displayName: string;
  passwordHash: string;
  birthDate: string | null;
  gender: Gender | null;
  firstName: string;
  lastName: string;
  relationship: Relationship;
  city: string;
  about: string;
}

export interface SignupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  birthDate: string | null;
  gender: Gender | null;
  relationship: Relationship;
  city: string;
  about: string;
}

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export interface LoginResult {
  user: PublicUser;
  token: string;
  expiresAt: Date;
  persistent: boolean;
}

export function toPublicUser(user: Pick<UserRecord, 'id' | 'email' | 'displayName'>): PublicUser {
  return { id: user.id, email: user.email, displayName: user.displayName };
}
