import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { FeedComment } from '../../../core/social/social.models';
import { Avatar } from '../avatar/avatar';

const COLLAPSED_COUNT = 3;

/**
 * Comentários de um item do feed: lista com entrada animada (o comentário novo
 * desliza, cresce e brilha em rosa por um instante), recolhimento das mais
 * antigas e campo de envio com botão que "decola" ao enviar.
 */
@Component({
  selector: 'ok-comment-thread',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, MatIconModule],
  template: `
    @if (hiddenCount() > 0) {
      <button type="button" class="more" (click)="expanded.set(true)">
        Ver
        {{
          hiddenCount() === 1
            ? 'o comentário anterior'
            : 'os ' + hiddenCount() + ' comentários anteriores'
        }}
      </button>
    }
    <ul
      class="list"
      aria-live="polite"
      [attr.aria-label]="'Comentários (' + comments().length + ')'"
    >
      @for (comment of visible(); track comment.id) {
        <li class="item" [class.is-fresh]="comment.fresh" data-testid="comment">
          <div class="item-inner">
            <ok-avatar [tone]="comment.tone" [src]="comment.photoUrl" [size]="32" />
            <div class="bubble">
              <p class="text-xs font-bold text-ink">
                {{ comment.authorName }}
                <span class="font-normal text-ink-muted">· {{ comment.time }}</span>
              </p>
              <p class="mt-0.5 text-sm break-words whitespace-pre-line text-ink">
                {{ comment.text }}
              </p>
            </div>
          </div>
        </li>
      }
    </ul>
    <form class="composer" (submit)="$event.preventDefault(); submit()">
      <label class="sr-only" [for]="inputId()">Escreva um comentário</label>
      <input
        #field
        [id]="inputId()"
        class="field"
        placeholder="Escreva um comentário…"
        maxlength="300"
        autocomplete="off"
        [value]="draft()"
        (input)="draft.set($any($event.target).value)"
        data-testid="comment-input"
      />
      <button
        type="submit"
        class="send"
        [class.is-sending]="sending()"
        [disabled]="!draft().trim()"
        aria-label="Enviar comentário"
        data-testid="comment-send"
      >
        <mat-icon aria-hidden="true" fontIcon="send" class="!size-[18px] !text-[18px]" />
      </button>
    </form>
  `,
  styleUrl: './comment-thread.css',
})
export class CommentThread {
  readonly comments = input.required<readonly FeedComment[]>();
  /** Prefixo único para o id do campo (vários itens na mesma página). */
  readonly key = input.required<string>();
  readonly send = output<string>();

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly draft = signal('');
  protected readonly sending = signal(false);
  protected readonly expanded = signal(false);

  protected readonly inputId = computed(() => `comment-${this.key().replace(/[^a-z0-9-]/gi, '-')}`);
  protected readonly visible = computed(() => {
    const all = this.comments();
    return this.expanded() ? all : all.slice(-COLLAPSED_COUNT);
  });
  protected readonly hiddenCount = computed(() => this.comments().length - this.visible().length);

  /** Leva o foco ao campo (ex.: ao clicar em "Comentar"). */
  focus(): void {
    this.field()?.nativeElement.focus();
  }

  protected submit(): void {
    const text = this.draft().trim();
    if (!text) return;
    this.send.emit(text);
    this.draft.set('');
    this.sending.set(true);
    setTimeout(() => this.sending.set(false), 450);
  }
}
