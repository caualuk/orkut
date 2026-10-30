import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { isYouTubeId, youTubeEmbedUrl } from '../../core/social/profile-music';
import { SocialStore } from '../../core/social/social.store';

/** Se a música do perfil está tocando (compartilhado entre o botão ♪ e o player). */
@Injectable({ providedIn: 'root' })
export class MusicPlayerState {
  readonly playing = signal(false);
}

/**
 * Mini player da música do perfil. Só existe enquanto toca: o vídeo nunca
 * carrega sem o clique em "Salvar e tocar", e fica visível como o YouTube exige.
 */
@Component({
  selector: 'ok-music-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (state.playing() && embedUrl(); as url) {
      <aside class="player" aria-label="Música do perfil" data-testid="music-player">
        <div class="flex items-center gap-2 px-3 py-2">
          <mat-icon aria-hidden="true" fontIcon="music_note" class="!size-4 !text-base text-primary" />
          <p class="min-w-0 flex-1 truncate text-xs font-bold text-ink">
            {{ store.profile().music?.title }}
          </p>
          <button
            type="button"
            class="close"
            aria-label="Fechar música do perfil"
            (click)="state.playing.set(false)"
            data-testid="music-close"
          >
            <mat-icon aria-hidden="true" fontIcon="close" class="!size-4 !text-base" />
          </button>
        </div>
        <iframe
          class="video"
          [src]="url"
          [title]="store.profile().music?.title ?? 'Música do perfil'"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      </aside>
    }
  `,
  styles: `
    .player {
      position: fixed;
      z-index: 45;
      right: 16px;
      bottom: 96px;
      width: min(280px, calc(100vw - 32px));
      overflow: hidden;
      border-radius: 18px;
      background: var(--color-surface);
      box-shadow: 0 14px 34px rgb(28 27 31 / 24%);
      animation: player-in 300ms var(--ease-emphasized);
    }

    @media (min-width: 600px) {
      .player {
        right: 24px;
        bottom: 24px;
      }
    }

    .video {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      border: 0;
    }

    .close {
      display: grid;
      width: 28px;
      height: 28px;
      place-items: center;
      border-radius: 999px;
      color: var(--color-ink-secondary);
      cursor: pointer;
    }

    .close:hover {
      background: var(--color-surface-variant);
    }

    @keyframes player-in {
      from {
        opacity: 0;
        transform: translateY(16px) scale(0.96);
      }
    }
  `,
})
export class MusicPlayer {
  protected readonly state = inject(MusicPlayerState);
  protected readonly store = inject(SocialStore);
  private readonly sanitizer = inject(DomSanitizer);

  /** Só o id validado entra na URL, então a confiança no recurso é segura. */
  protected readonly embedUrl = computed(() => {
    const videoId = this.store.profile().music?.videoId;
    if (!videoId || !isYouTubeId(videoId)) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(youTubeEmbedUrl(videoId));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.state.playing.set(false));
  }
}
