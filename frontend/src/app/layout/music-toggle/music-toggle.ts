import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SocialStore } from '../../core/social/social.store';
import { MusicDialog } from './music-dialog';
import { MusicPlayerState } from './music-player';

/**
 * Botão "♪" da Top App Bar: abre o modal da música do perfil. Enquanto toca,
 * o ícone vira um equalizador animado.
 */
@Component({
  selector: 'ok-music-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule],
  template: `
    <button
      type="button"
      class="music"
      [class.music--on]="playing()"
      aria-haspopup="dialog"
      aria-label="Música do perfil"
      [matTooltip]="tooltip()"
      (click)="open()"
      data-testid="music-toggle"
    >
      @if (playing()) {
        <span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>
      } @else {
        <mat-icon aria-hidden="true" fontIcon="music_note" class="!size-5 !text-xl" />
      }
    </button>
  `,
  styles: `
    .music {
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      border: 1px solid var(--color-divider);
      background: var(--color-surface);
      color: var(--color-ink);
      cursor: pointer;
      transition: background-color 150ms var(--ease-emphasized);
    }

    .music:hover {
      background: var(--color-surface-variant);
    }

    .music--on {
      border-color: var(--color-primary-container);
      background: var(--color-primary-container);
      color: var(--color-primary);
    }

    .eq {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      height: 14px;
    }

    .eq i {
      width: 3px;
      height: 100%;
      border-radius: 2px;
      background: currentColor;
      animation: eq 900ms ease-in-out infinite alternate;
    }

    .eq i:nth-child(2) {
      animation-delay: -300ms;
    }

    .eq i:nth-child(3) {
      animation-delay: -600ms;
    }

    @keyframes eq {
      from {
        transform: scaleY(0.3);
      }
    }
  `,
})
export class MusicToggle {
  private readonly store = inject(SocialStore);
  private readonly dialog = inject(MatDialog);

  private readonly player = inject(MusicPlayerState);
  protected readonly playing = this.player.playing;
  protected readonly tooltip = computed(() => {
    const track = this.player.track();
    if (track) return `Tocando: ${track.title}`;
    return this.store.profile().music?.title ?? 'Escolher a música do perfil';
  });

  protected open(): void {
    this.dialog.open(MusicDialog, { width: '480px', maxWidth: 'calc(100vw - 32px)' });
  }
}
