import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { API_BASE_URL } from '../http/api.config';
import type { LoginCredentials, User, UserResponse } from './auth.models';

/**
 * Estado de autenticação da aplicação.
 *
 * A sessão vive em um cookie HttpOnly definido pela API: nenhum token é
 * armazenado em localStorage/sessionStorage nem fica acessível ao JavaScript.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/auth`;

  private readonly currentUser = signal<User | null>(null);
  private sessionCheck$?: Observable<User | null>;

  readonly user = this.currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  login(credentials: LoginCredentials): Observable<User> {
    return this.http
      .post<UserResponse>(`${this.baseUrl}/login`, credentials, { withCredentials: true })
      .pipe(
        map((response) => response.user),
        tap((user) => this.setUser(user)),
      );
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/logout`, null, { withCredentials: true })
      .pipe(finalize(() => this.setUser(null)));
  }

  /**
   * Garante que o estado da sessão foi carregado (uma única chamada a /me,
   * compartilhada entre guards concorrentes). 401 significa "sem sessão".
   */
  ensureSession(): Observable<User | null> {
    if (this.currentUser()) return of(this.currentUser());

    this.sessionCheck$ ??= this.http
      .get<UserResponse>(`${this.baseUrl}/me`, { withCredentials: true })
      .pipe(
        map((response) => response.user),
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && error.status === 401
            ? of(null)
            : throwError(() => error),
        ),
        tap((user) => this.setUser(user)),
        finalize(() => (this.sessionCheck$ = undefined)),
        shareReplay({ bufferSize: 1, refCount: true }),
      );

    return this.sessionCheck$;
  }

  private setUser(user: User | null): void {
    this.currentUser.set(user);
  }
}
