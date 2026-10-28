import { InjectionToken } from '@angular/core';

/**
 * URL base da API. Em desenvolvimento o `ng serve` faz proxy de `/api` para o
 * backend (proxy.conf.json), mantendo o cookie de sessão first-party.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
});
