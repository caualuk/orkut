import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  UrlTree,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { firstValueFrom, isObservable, Observable, of, throwError } from 'rxjs';
import { authGuard, guestGuard } from './auth.guards';
import { AuthService } from './auth.service';

const USER = { id: 'u1', email: 'paulo@orkut.com', displayName: 'Paulo' };

function setup(ensureSession: () => Observable<unknown>) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: { ensureSession } }],
  });
  return TestBed.inject(Router);
}

async function run(guard: typeof authGuard, url = '/home') {
  const result = TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
  return isObservable(result) ? firstValueFrom(result) : result;
}

describe('authGuard', () => {
  it('libera a rota com sessão válida', async () => {
    setup(() => of(USER));
    await expect(run(authGuard)).resolves.toBe(true);
  });

  it('redireciona para /login preservando o destino', async () => {
    const router = setup(() => of(null));
    const result = (await run(authGuard, '/home?tab=scraps')) as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result)).toBe('/login?returnUrl=%2Fhome%3Ftab%3Dscraps');
  });

  it('redireciona para /login se a API falhar', async () => {
    const router = setup(() => throwError(() => new Error('offline')));
    const result = (await run(authGuard)) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/login');
  });
});

describe('guestGuard', () => {
  it('libera visitantes', async () => {
    setup(() => of(null));
    await expect(run(guestGuard)).resolves.toBe(true);
  });

  it('envia usuários autenticados para /home', async () => {
    const router = setup(() => of(USER));
    const result = (await run(guestGuard)) as UrlTree;
    expect(router.serializeUrl(result)).toBe('/home');
  });

  it('mantém o login acessível se a API falhar', async () => {
    setup(() => throwError(() => new Error('offline')));
    await expect(run(guestGuard)).resolves.toBe(true);
  });
});
