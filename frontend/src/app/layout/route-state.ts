import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import type { NavItem } from './navigation';

/** Metadados de rota usados pela casca (título no tablet/mobile, botão voltar). */
export interface ShellRouteData {
  heading?: string;
  back?: boolean;
  /** Esconde a Navigation Bar (ex.: conversa aberta no mobile). */
  hideBottomNav?: boolean;
}

/** URL atual como signal (componentes OnPush/zoneless reagem à navegação). */
export function injectCurrentUrl() {
  const router = inject(Router);
  return toSignal(
    router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => router.url),
    ),
    { initialValue: router.url },
  );
}

/** Dados da rota folha atual. */
export function injectShellRouteData() {
  const router = inject(Router);
  const root = inject(ActivatedRoute);
  const read = (): ShellRouteData => {
    let route = root.snapshot;
    while (route.firstChild) route = route.firstChild;
    return route.data as ShellRouteData;
  };
  return toSignal(
    router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(read),
    ),
    { initialValue: read() },
  );
}

/**
 * "Perfil" fica ativo na Home e nas telas de perfil (como no design); os
 * demais itens ficam ativos na própria rota e nas rotas filhas.
 */
export function isNavItemActive(item: NavItem, url: string): boolean {
  const path = url.split(/[?#]/)[0] ?? '';
  if (item.label === 'Perfil' && item.link === '/home') {
    return path === '/home' || path.startsWith('/perfil');
  }
  if (item.exact) return path === item.link;
  return path === item.link || path.startsWith(`${item.link}/`);
}
