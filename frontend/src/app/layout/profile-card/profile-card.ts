import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { GENDER_LABELS, RELATIONSHIP_LABELS } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import { ProfilePhoto } from '../../shared/ui/profile-photo/profile-photo';

/** Card de perfil da coluna lateral (foto, status online, nome e "Editar perfil"). */
@Component({
  selector: 'ok-profile-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, ProfilePhoto, RouterLink, RouterLinkActive],
  template: `
    <section class="ok-card p-4" aria-label="Seu perfil">
      <div class="relative">
        <ok-profile-photo
          [src]="store.profile().photoUrl"
          [alt]="'Foto de ' + store.displayName()"
        />
        <!-- Seu próprio status; "Aparecer como online" controla o que os amigos veem. -->
        <span
          class="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1c1b1f] shadow-sm"
        >
          <span class="size-2 rounded-full bg-success" aria-hidden="true"></span>
          online
        </span>
      </div>
      <h2 class="mt-4 px-1 text-xl font-bold text-ink" data-testid="profile-name">
        {{ store.displayName() }}
      </h2>
      <p class="mt-0.5 px-1 text-xs text-ink-muted">{{ summary() }}</p>
      <a
        routerLink="/perfil/editar"
        routerLinkActive="edit--active"
        #rla="routerLinkActive"
        class="edit mt-4"
        [attr.aria-current]="rla.isActive ? 'page' : null"
      >
        <mat-icon aria-hidden="true" fontIcon="edit" class="!size-4 !text-base" />
        Editar perfil
      </a>
    </section>
  `,
  styles: `
    .edit {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 40px;
      border-radius: 12px;
      border: 1.5px solid var(--color-outline);
      color: var(--color-primary-strong);
      font-size: 13px;
      font-weight: 700;
      transition: background-color 150ms var(--ease-emphasized);
    }

    .edit:hover {
      background: var(--color-primary-container);
    }

    .edit--active,
    .edit--active:hover {
      border-color: var(--color-primary-bold);
      background: var(--color-primary-bold);
      color: #fff;
    }
  `,
})
export class ProfileCard {
  protected readonly store = inject(SocialStore);

  protected readonly summary = computed(() => {
    const profile = this.store.profile();
    return [
      GENDER_LABELS[profile.gender].toLowerCase(),
      RELATIONSHIP_LABELS[profile.relationship].toLowerCase(),
    ]
      .filter((part) => !part.startsWith('prefiro'))
      .join(', ')
      .concat(` · ${profile.country}`);
  });
}
