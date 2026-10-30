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

export interface MusicTrack {
  videoId: string;
  title: string;
  /** Dono do perfil visitado; sem ele, é a música do próprio usuário. */
  owner?: string;
}

/** O que está tocando (compartilhado entre o botão ♪, os perfis e o player). */
@Injectable({ providedIn: 'root' })
export class MusicPlayerState {
  readonly track = signal<MusicTrack | null>(null);
  readonly playing = computed(() => this.track() !== null);

  play(track: MusicTrack): void {
    this.track.set(track);
  }

  stop(): void {
    this.track.set(null);
  }

  /** Ao sair de um perfil, a música dele para; a do próprio usuário continua. */
  stopVisited(): void {
    if (this.track()?.owner) this.track.set(null);
  }
}

/**
 * Mini player da música do perfil. Só existe enquanto toca: o vídeo nunca
 * carrega sem o clique em "Salvar e tocar" ou a visita a um perfil com música, e
 * fica visível como o YouTube exige.
 */
@Component({
  selector: 'ok-music-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (embedUrl(); as url) {
      <aside class="player" aria-label="Música do perfil" data-testid="music-player">
        <div class="flex items-center gap-2 px-3 py-2">
          <mat-icon aria-hidden="true" fontIcon="music_note" class="!size-4 !text-base text-primary" />
          <p class="min-w-0 flex-1 truncate text-xs font-bold text-ink">
            {{ state.track()?.title }}
            @if (state.track()?.owner; as owner) {
              <span class="font-normal text-ink-muted">· perfil de {{ owner }}</span>
            }
          </p>
          <button
            type="button"
            class="close"
            aria-label="Fechar música do perfil"
            (click)="state.stop()"
            data-testid="music-close"
          >
            <mat-icon aria-hidden="true" fontIcon="close" class="!size-4 !text-base" />
          </button>
        </div>
        <iframe
          class="video"
          [src]="url"
          [title]="state.track()?.title ?? 'Música do perfil'"
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
  private readonly sanitizer = inject(DomSanitizer);

  private readonly videoId = computed(() => {
    const videoId = this.state.track()?.videoId;
    return videoId && isYouTubeId(videoId) ? videoId : null;
  });

  /**
   * Depende só do id: uma URL nova recarrega o iframe e volta o vídeo ao início,
   * então trocar o título ou o dono da faixa não pode gerar outra. Só o id
   * validado entra na URL, então a confiança no recurso é segura.
   */
  protected readonly embedUrl = computed(() => {
    const videoId = this.videoId();
    return videoId
      ? this.sanitizer.bypassSecurityTrustResourceUrl(youTubeEmbedUrl(videoId))
      : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.state.stop());
  }
}
