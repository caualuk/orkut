import type { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';
import type { ShellRouteData } from './layout/route-state';

/**
 * Rotas da aplicação. Todas as páginas são carregadas sob demanda (lazy loading).
 * - Visitantes: /login, /cadastro, /recuperar-senha (guestGuard)
 * - Autenticadas (dentro da casca `AppShell`, authGuard): Home, perfil, recados,
 *   álbum, feeds, mensagens, depoimentos, configurações, amigos e comunidades.
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
    loadComponent: () => import('./features/auth/signup/signup-page').then((m) => m.SignupPage),
  },
  {
    // Onboarding pós-cadastro: escolha de interesses (já com sessão).
    path: 'boas-vindas',
    title: 'Seus interesses · orkut',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/onboarding/interests-page').then((m) => m.InterestsPage),
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
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () => import('./layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: 'home',
        title: 'Início · orkut',
        loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
      },
      {
        path: 'perfil',
        pathMatch: 'full',
        title: 'Perfil · orkut',
        data: { heading: 'Perfil' } satisfies ShellRouteData,
        loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
      },
      {
        path: 'perfil/editar',
        title: 'Editar perfil · orkut',
        data: { heading: 'Editar perfil', back: true } satisfies ShellRouteData,
        loadComponent: () =>
          import('./features/profile/edit-profile-page').then((m) => m.EditProfilePage),
      },
      {
        path: 'perfil/:userId',
        title: 'Perfil · orkut',
        data: { heading: 'Perfil', back: true } satisfies ShellRouteData,
        loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
      },
      {
        path: 'recados',
        title: 'Recados · orkut',
        data: { heading: 'Recados' } satisfies ShellRouteData,
        loadComponent: () => import('./features/scraps/scraps-page').then((m) => m.ScrapsPage),
      },
      {
        path: 'album',
        title: 'Álbum · orkut',
        data: { heading: 'Álbum', back: true } satisfies ShellRouteData,
        loadComponent: () => import('./features/album/album-page').then((m) => m.AlbumPage),
      },
      {
        path: 'feeds',
        title: 'Feeds · orkut',
        data: { heading: 'Feeds', back: true } satisfies ShellRouteData,
        loadComponent: () => import('./features/feeds/feeds-page').then((m) => m.FeedsPage),
      },
      {
        path: 'mensagens',
        title: 'Mensagens · orkut',
        data: { heading: 'Mensagens', back: true } satisfies ShellRouteData,
        loadComponent: () =>
          import('./features/messages/messages-page').then((m) => m.MessagesPage),
      },
      {
        path: 'mensagens/:conversationId',
        title: 'Conversa · orkut',
        data: { heading: 'Mensagens', back: true, hideBottomNav: true } satisfies ShellRouteData,
        loadComponent: () =>
          import('./features/messages/messages-page').then((m) => m.MessagesPage),
      },
      {
        path: 'depoimentos',
        title: 'Depoimentos · orkut',
        data: { heading: 'Depoimentos', back: true } satisfies ShellRouteData,
        loadComponent: () =>
          import('./features/testimonials/testimonials-page').then((m) => m.TestimonialsPage),
      },
      {
        path: 'configuracoes',
        title: 'Configurações · orkut',
        data: { heading: 'Configurações', back: true } satisfies ShellRouteData,
        loadComponent: () =>
          import('./features/settings/settings-page').then((m) => m.SettingsPage),
      },
      {
        path: 'amigos',
        title: 'Amigos · orkut',
        data: { heading: 'Amigos' } satisfies ShellRouteData,
        loadComponent: () => import('./features/friends/friends-page').then((m) => m.FriendsPage),
      },
      {
        path: 'comunidades',
        pathMatch: 'full',
        title: 'Comunidades · orkut',
        data: { heading: 'Comunidades' } satisfies ShellRouteData,
        loadComponent: () =>
          import('./features/community/communities-page').then((m) => m.CommunitiesPage),
      },
      {
        path: 'comunidades/:communityId',
        title: 'Comunidade · orkut',
        data: { heading: 'Comunidades' } satisfies ShellRouteData,
        loadComponent: () =>
          import('./features/community/community-page').then((m) => m.CommunityPage),
      },
    ],
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
