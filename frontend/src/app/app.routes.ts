import type { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';

/**
 * Rotas da aplicação. Todas as páginas são carregadas sob demanda (lazy loading).
 * - Visitantes: /login, /cadastro, /recuperar-senha (guestGuard)
 * - Autenticadas: /home (authGuard)
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'login',
    title: 'Entrar · orkut',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'cadastro',
    title: 'Criar conta · orkut',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./shared/ui/coming-soon/coming-soon-page').then((m) => m.ComingSoonPage),
    data: {
      heading: 'Criar conta',
      description: 'O cadastro de novos membros chega na próxima etapa da plataforma.',
    },
  },
  {
    path: 'recuperar-senha',
    title: 'Recuperar senha · orkut',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./shared/ui/coming-soon/coming-soon-page').then((m) => m.ComingSoonPage),
    data: {
      heading: 'Recuperar senha',
      description: 'Em breve você poderá redefinir sua senha por e-mail.',
    },
  },
  {
    path: 'home',
    title: 'Início · orkut',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
  },
  {
    path: '**',
    title: 'Página não encontrada · orkut',
    loadComponent: () =>
      import('./shared/ui/coming-soon/coming-soon-page').then((m) => m.ComingSoonPage),
    data: {
      heading: 'Página não encontrada',
      description: 'O endereço acessado não existe ou foi removido.',
    },
  },
];
