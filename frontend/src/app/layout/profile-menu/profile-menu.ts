import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { NavCounterPipe } from '../nav-counter';
import { PROFILE_MENU } from '../navigation';
import { injectCurrentUrl, isNavItemActive } from '../route-state';

/**
 * Menu do perfil (Perfil, Recados, Álbum | Feeds, Mensagens, Depoimentos,
 * Configurações). Usado na coluna lateral do desktop e no Navigation Drawer.
 */
@Component({
  selector: 'ok-profile-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, NavCounterPipe, RouterLink],
  template: `
    <nav [attr.aria-label]="ariaLabel()">
      @for (group of groups; track $index; let last = $last) {
        <ul class="flex flex-col gap-1">
          @for (item of group; track item.label) {
            @let active = isActive(item);
            @let count = item | navCounter;
            <li>
              <a
                [routerLink]="item.link"
                (click)="navigated.emit()"
                class="item"
                [class.item--active]="active"
                [attr.aria-current]="active ? 'page' : null"
                [attr.data-testid]="'menu-' + item.link.slice(1)"
              >
                <mat-icon aria-hidden="true" [fontIcon]="item.icon" class="icon" />
                <span class="flex-1">{{ item.label }}</span>
                @if (count) {
                  @if (item.counter === 'photos') {
                    <span class="text-xs text-ink-muted">{{ count }}</span>
                  } @else {
                    <span class="ok-badge"
                      ><span class="sr-only">não lidos: </span>{{ count }}</span
                    >
                  }
                }
              </a>
            </li>
          }
        </ul>
        @if (!last) {
          <hr class="my-1 border-divider" />
        }
      }
    </nav>
  `,
  styles: `
    .item {
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 44px;
      padding: 0 16px 0 18px;
      border-radius: 14px;
      font-size: 14px;
      color: var(--color-ink);
      transition: background-color 150ms var(--ease-emphasized);
    }

    .item:hover {
      background: var(--color-surface-variant);
    }

    .item--active,
    .item--active:hover {
      background: var(--color-primary-container);
      color: var(--color-primary-strong);
      font-weight: 700;
    }

    .icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
      color: var(--color-ink-muted);
    }

    .item--active .icon {
      color: var(--color-primary);
    }
  `,
})
export class ProfileMenu {
  readonly ariaLabel = input('Menu do perfil');
  readonly navigated = output();

  protected readonly groups = PROFILE_MENU;
  private readonly url = injectCurrentUrl();

  protected isActive(item: (typeof PROFILE_MENU)[number][number]): boolean {
    return isNavItemActive(item, this.url());
  }
}
