import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Botão "Curtir" com micro-interações: o coração "salta" (spring), uma explosão
 * de partículas rosa sai dele e o contador rola para o novo número. Com
 * `prefers-reduced-motion`, sobra só a troca de cor.
 */
@Component({
  selector: 'ok-like-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <button
      type="button"
      class="like"
      [class.is-liked]="liked()"
      [class.is-popping]="popping()"
      [attr.aria-pressed]="liked()"
      (click)="toggle()"
      data-testid="like-button"
    >
      <span class="heart" aria-hidden="true">
        <mat-icon fontIcon="favorite" class="icon" [class.icon-filled]="liked()" />
        @if (popping()) {
          <span class="burst">
            @for (particle of particles; track particle) {
              <span class="particle" [style.--angle.deg]="particle"></span>
            }
          </span>
        }
      </span>
      @if (showLabel()) {
        <span class="label">Curtir</span>
      } @else {
        <span class="sr-only">Curtir</span>
      }
      <span class="sr-only">{{ subjectText() }}</span>
      @if (count() > 0) {
        <span class="count" aria-hidden="true">
          @for (value of [count()]; track value) {
            <span
              class="digit"
              [class.up]="direction() === 'up'"
              [class.down]="direction() === 'down'"
            >
              {{ value }}
            </span>
          }
        </span>
      }
      <span class="sr-only">{{ countText() }}</span>
    </button>
  `,
  styleUrl: './like-button.css',
})
export class LikeButton {
  readonly liked = input.required<boolean>();
  readonly count = input(0);
  /** Mostra "Curtir/Curtiu" ao lado do coração. */
  readonly showLabel = input(true);
  /** O que está sendo curtido, para o rótulo acessível (ex.: "recado de Ana"). */
  readonly subject = input('');
  readonly toggled = output<void>();

  protected readonly particles = [0, 45, 90, 135, 180, 225, 270, 315];
  protected readonly popping = signal(false);
  protected readonly direction = signal<'up' | 'down' | null>(null);
  private popTimer: ReturnType<typeof setTimeout> | null = null;

  // Nome acessível = texto visível ("Curtir") + contexto só para leitores de tela.
  // O estado (curtido ou não) vem de aria-pressed.
  protected readonly subjectText = computed(() => (this.subject() ? ` ${this.subject()}` : ''));
  protected readonly countText = computed(() => {
    const total = this.count();
    return total === 1 ? ', 1 curtida' : `, ${total} curtidas`;
  });

  constructor() {
    // Anima o contador na direção da mudança (também quando vem do servidor).
    let previous: number | null = null;
    effect(() => {
      const current = this.count();
      untracked(() => {
        if (previous !== null && current !== previous) {
          this.direction.set(current > previous ? 'up' : 'down');
        }
        previous = current;
      });
    });
  }

  protected toggle(): void {
    if (!this.liked()) {
      // Reinicia a animação mesmo em cliques rápidos seguidos.
      this.popping.set(false);
      queueMicrotask(() => this.popping.set(true));
      if (this.popTimer) clearTimeout(this.popTimer);
      this.popTimer = setTimeout(() => this.popping.set(false), 700);
    }
    this.toggled.emit();
  }
}
