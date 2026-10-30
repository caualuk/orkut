export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember: boolean;
}

export interface UserResponse {
  user: User;
}

export type Gender = 'feminino' | 'masculino' | 'outro' | 'nao-informar';

export type Relationship =
  'solteiro' | 'namorando' | 'casado' | 'relacionamento-aberto' | 'nao-informar';

/** Corpo de `POST /api/auth/signup` (etapas 1 e 2 do cadastro, sem a foto). */
export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  birthDate: string;
  gender: Gender;
  relationship: Relationship;
  city: string;
  about: string;
  acceptTerms: true;
}
