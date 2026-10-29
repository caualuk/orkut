import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Botão "♪" da Top App Bar: liga/desliga a música do perfil. Enquanto toca,
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
      [attr.aria-pressed]="playing()"
      aria-label="Música do perfil"
      [matTooltip]="playing() ? 'Pausar música do perfil' : 'Tocar música do perfil'"
      (click)="playing.set(!playing())"
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
  protected readonly playing = signal(false);
}
