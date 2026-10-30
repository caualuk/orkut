import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { Tone } from '../../../core/social/social.models';

/** Gradientes (luz superior esquerda) dos avatares e tiles 3D do design. */
export const TONE_GRADIENTS: Record<Tone, string> = {
  teal: 'linear-gradient(160deg, #8fd9cf 0%, #26a69a 100%)',
  purple: 'linear-gradient(160deg, #e1a6ee 0%, #ab47bc 100%)',
  coral: 'linear-gradient(160deg, #ffb4b4 0%, #e57373 100%)',
  blue: 'linear-gradient(160deg, #a7dcff 0%, #42a5f5 100%)',
  orange: 'linear-gradient(160deg, #ffc58f 0%, #f4511e 100%)',
  slate: 'linear-gradient(160deg, #b8c4cb 0%, #607d8b 100%)',
  lavender: 'linear-gradient(160deg, #d6c6f2 0%, #9575cd 100%)',
  green: 'linear-gradient(160deg, #b5e3b6 0%, #43a047 100%)',
  peach: 'linear-gradient(160deg, #ffd3a6 0%, #ff8a65 100%)',
  yellow: 'linear-gradient(160deg, #fff3b0 0%, #f9a825 100%)',
  pink: 'linear-gradient(160deg, #f8bbd0 0%, #e91e63 100%)',
  gray: 'linear-gradient(160deg, #d7d4dc 0%, #8e8a96 100%)',
};

/**
 * Avatar "tile 3D" (Padrões & 3D): gradiente com highlight superior e sombra
 * projetada. Sem `initials` vira uma esfera lisa (avatares pequenos do design).
 */
@Component({
  selector: 'ok-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'avatar',
    '[class.avatar--round]': 'shape() === "round"',
    '[style.width]': 'fluid() ? "100%" : size() + "px"',
    '[style.height]': 'fluid() ? "auto" : size() + "px"',
    '[style.background]': 'background()',
    '[style.font-size.px]': 'size() * 0.36',
    '[attr.role]': 'label() ? "img" : null',
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
  },
  template: `
    @if (imageUrl(); as url) {
      <img [src]="url" alt="" class="photo" loading="lazy" (error)="broken.set(true)" />
    } @else {
      {{ initials() }}
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      aspect-ratio: 1;
      align-items: center;
      justify-content: center;
      border-radius: 28%;
      color: #fff;
      font-weight: 700;
      line-height: 1;
      text-shadow: 0 1px 2px rgb(0 0 0 / 15%);
      box-shadow:
        inset 0 2px 0 rgb(255 255 255 / 45%),
        inset 0 -6px 12px rgb(0 0 0 / 10%),
        0 6px 14px rgb(28 27 31 / 14%);
      user-select: none;
    }

    :host(.avatar--round) {
      border-radius: 9999px;
    }

    :host {
      overflow: hidden;
    }

    .photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,
})
export class Avatar {
  readonly tone = input<Tone>('gray');
  readonly initials = input('');
  readonly size = input(44);
  /** Ocupa a largura do contêiner (grades); `size` segue definindo o texto. */
  readonly fluid = input(false);
  readonly shape = input<'round' | 'tile'>('round');
  /** Nome para leitores de tela; vazio = decorativo. */
  readonly label = input('');
  /** Foto real da pessoa; sem ela (ou se falhar ao carregar), o gradiente com iniciais. */
  readonly src = input<string | null | undefined>(null);

  protected readonly broken = signal(false);
  protected readonly imageUrl = computed(() => (this.broken() ? null : (this.src() ?? null)));
  protected readonly background = computed(() => TONE_GRADIENTS[this.tone()]);
}
