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
