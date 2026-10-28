import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';
import { DEFAULT_AUTHENTICATED_ROUTE } from './safe-redirect';

/** Protege rotas autenticadas; sem sessão, redireciona para o login preservando o destino. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureSession().pipe(
    map((user) =>
      user ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }),
    ),
    catchError(() => of(router.createUrlTree(['/login']))),
  );
};

/** Impede que usuários já autenticados vejam telas de visitante (login, cadastro). */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.ensureSession().pipe(
    map((user) => (user ? router.parseUrl(DEFAULT_AUTHENTICATED_ROUTE) : true)),
    // Se a API estiver indisponível, a tela de login continua acessível.
    catchError(() => of(true)),
  );
};
