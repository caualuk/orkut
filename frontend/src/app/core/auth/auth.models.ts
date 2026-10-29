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

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  birthDate: string | null;
  gender: Gender | null;
  acceptTerms: true;
}
