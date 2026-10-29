import { A11yModule } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SocialStore } from '../../core/social/social.store';
import { ThemeService } from '../../core/theme/theme.service';
import { BrandLogo } from '../../shared/ui/brand-logo/brand-logo';
import { ProfilePhoto } from '../../shared/ui/profile-photo/profile-photo';
import { GlobalSearch } from '../global-search/global-search';
import { MusicToggle } from '../music-toggle/music-toggle';
import { NavCounterPipe } from '../nav-counter';
import { BOTTOM_NAV, FOOTER_LINKS, PRIMARY_NAV, RAIL_NAV, type NavItem } from '../navigation';
import { ProfileCard } from '../profile-card/profile-card';
import { ProfileMenu } from '../profile-menu/profile-menu';
import { injectCurrentUrl, injectShellRouteData, isNavItemActive } from '../route-state';

/**
 * Casca das telas autenticadas, nas 3 window size classes do design:
 *  - expanded (≥ 1024): Top App Bar com pílulas + coluna de perfil fixa + rodapé;
 *  - medium (600–1023): Navigation Rail + Top App Bar com título e busca;
 *  - compact (< 600): Top App Bar 56 + Navigation Bar inferior + Drawer modal.
 */
@Component({
  selector: 'ok-app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    A11yModule,
    BrandLogo,
    GlobalSearch,
    MatIconModule,
    MatMenuModule,
    MusicToggle,
    NavCounterPipe,
    ProfileCard,
    ProfileMenu,
    ProfilePhoto,
    RouterLink,
    RouterOutlet,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.css',
  host: { '(document:keydown.escape)': 'closeDrawer()' },
})
export class AppShell {
  protected readonly store = inject(SocialStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly primaryNav = PRIMARY_NAV;
  protected readonly railNav = RAIL_NAV;
  protected readonly bottomNav = BOTTOM_NAV;
  protected readonly footerLinks = FOOTER_LINKS;
  protected readonly year = new Date().getFullYear();

  protected readonly url = injectCurrentUrl();
  protected readonly routeData = injectShellRouteData();
  protected readonly heading = computed(() => this.routeData().heading ?? 'Início');
  protected readonly drawerOpen = signal(false);
  protected readonly mobileSearchOpen = signal(false);
  protected readonly loggingOut = signal(false);

  constructor() {
    // Aplica o tema salvo assim que a área logada abre.
    inject(ThemeService);

    // Fecha drawer e busca mobile a cada navegação.
    effect(() => {
      this.url();
      untracked(() => {
        this.drawerOpen.set(false);
        this.mobileSearchOpen.set(false);
      });
    });
  }

  protected isActive(item: NavItem): boolean {
    return isNavItemActive(item, this.url());
  }

  protected openDrawer(): void {
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  protected logout(): void {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    // Mesmo se a API falhar, o estado local já foi limpo: volta ao login.
    const done = () => void this.router.navigateByUrl('/login');
    this.auth.logout().subscribe({ complete: done, error: done });
  }
}
