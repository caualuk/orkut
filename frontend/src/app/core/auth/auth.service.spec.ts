import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import type { User } from './auth.models';
import { AuthService } from './auth.service';

const USER: User = { id: 'u1', email: 'paulo@orkut.com', displayName: 'Paulo' };

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('começa sem usuário autenticado', () => {
    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('faz login com credenciais e cookies e atualiza o estado', async () => {
    const credentials = { email: USER.email, password: 'segredo', remember: true };
    const result = firstValueFrom(service.login(credentials));

    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(credentials);
    expect(req.request.withCredentials).toBe(true);
    req.flush({ user: USER });

    await expect(result).resolves.toEqual(USER);
    expect(service.user()).toEqual(USER);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('não persiste nenhum dado de sessão no storage do navegador', async () => {
    const result = firstValueFrom(
      service.login({ email: USER.email, password: 'x', remember: true }),
    );
    http.expectOne('/api/auth/login').flush({ user: USER });
    await result;

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('mantém o estado deslogado quando o login falha', async () => {
    const result = firstValueFrom(
      service.login({ email: USER.email, password: 'x', remember: false }),
    );
    http
      .expectOne('/api/auth/login')
      .flush(
        { error: { code: 'INVALID_CREDENTIALS' } },
        { status: 401, statusText: 'Unauthorized' },
      );

    await expect(result).rejects.toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('ensureSession carrega o usuário via /me', async () => {
    const result = firstValueFrom(service.ensureSession());
    http.expectOne('/api/auth/me').flush({ user: USER });

    await expect(result).resolves.toEqual(USER);
    expect(service.user()).toEqual(USER);
  });

  it('ensureSession trata 401 como "sem sessão"', async () => {
    const result = firstValueFrom(service.ensureSession());
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    await expect(result).resolves.toBeNull();
  });

  it('ensureSession propaga erros que não são 401', async () => {
    const result = firstValueFrom(service.ensureSession());
    http.expectOne('/api/auth/me').flush(null, { status: 503, statusText: 'Unavailable' });
    await expect(result).rejects.toBeTruthy();
  });

  it('ensureSession compartilha uma única requisição entre chamadas simultâneas', async () => {
    const a = firstValueFrom(service.ensureSession());
    const b = firstValueFrom(service.ensureSession());
    http.expectOne('/api/auth/me').flush({ user: USER });
    await expect(Promise.all([a, b])).resolves.toEqual([USER, USER]);
  });

  it('ensureSession não chama a API quando já há usuário', async () => {
    const login = firstValueFrom(
      service.login({ email: USER.email, password: 'x', remember: false }),
    );
    http.expectOne('/api/auth/login').flush({ user: USER });
    await login;

    await expect(firstValueFrom(service.ensureSession())).resolves.toEqual(USER);
    http.expectNone('/api/auth/me');
  });

  it('logout limpa o estado mesmo se a API falhar', async () => {
    const login = firstValueFrom(
      service.login({ email: USER.email, password: 'x', remember: false }),
    );
    http.expectOne('/api/auth/login').flush({ user: USER });
    await login;

    const logout = firstValueFrom(service.logout(), { defaultValue: undefined });
    http.expectOne('/api/auth/logout').flush(null, { status: 500, statusText: 'Error' });

    await expect(logout).rejects.toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
  });
});
