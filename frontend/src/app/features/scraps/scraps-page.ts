import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { VISIBILITY_LABELS, type Scrap } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import { Avatar, TONE_GRADIENTS } from '../../shared/ui/avatar/avatar';
import { LikeButton } from '../../shared/ui/like-button/like-button';
import { PageHeader } from '../../shared/ui/page-header/page-header';

type ScrapFilter = 'todos' | 'nao-lidos' | 'enviados';

const PAGE_SIZE = 5;
const MAX_LENGTH = 1000;

/** Recados ("Recados · Desktop 1440", "M · Recados"). */
@Component({
  selector: 'ok-scraps-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, LikeButton, MatIconModule, MatTooltipModule, PageHeader],
  templateUrl: './scraps-page.html',
  styleUrl: './scraps-page.css',
})
export class ScrapsPage {
  /** `?para=<id do amigo>` abre o composer endereçado a ele (botão "Deixar scrap"). */
  readonly para = input<string>();

  protected readonly store = inject(SocialStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly injector = inject(Injector);
  private readonly composer = viewChild<ElementRef<HTMLTextAreaElement>>('composer');

  protected readonly maxLength = MAX_LENGTH;
  protected readonly gradients = TONE_GRADIENTS;
  protected readonly visibilityLabel = computed(
    () => VISIBILITY_LABELS[this.store.settings().scrapVisibility],
  );
  protected readonly filters: { id: ScrapFilter; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'nao-lidos', label: 'Não lidos' },
    { id: 'enviados', label: 'Enviados' },
  ];

  protected readonly filter = signal<ScrapFilter>('todos');
  protected readonly draft = signal('');
  protected readonly composeOpen = signal(false);
  protected readonly replyingTo = signal<string | null>(null);
  protected readonly replyDraft = signal('');
  protected readonly recipient = computed(() => {
    const id = this.para();
    return id ? this.store.friendById(id) : undefined;
  });

  protected readonly filtered = computed(() => {
    const scraps = this.store.scraps();
    switch (this.filter()) {
      case 'nao-lidos':
        return scraps.filter((s) => s.direction === 'recebido' && !s.read);
      case 'enviados':
        return scraps.filter((s) => s.direction === 'enviado');
      default:
        return scraps.filter((s) => s.direction === 'recebido');
    }
  });

  /** Volta à página 1 sempre que o filtro muda. */
  protected readonly page = linkedSignal({ source: this.filter, computation: () => 1 });
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)),
  );
  protected readonly pages = computed(() =>
    Array.from({ length: this.pageCount() }, (_, i) => i + 1),
  );
  protected readonly visible = computed(() => {
    const start = (Math.min(this.page(), this.pageCount()) - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });
  protected readonly range = computed(() => {
    const total = this.filtered().length;
    if (!total) return 'Nenhum recado';
    const start = (Math.min(this.page(), this.pageCount()) - 1) * PAGE_SIZE + 1;
    return `Mostrando ${start}–${start + this.visible().length - 1} de ${total}`;
  });

  protected send(): void {
    const text = this.draft().trim();
    if (!text) return;
    this.store.sendScrap(text, this.recipient());
    this.draft.set('');
    this.filter.set('enviados');
    this.snackBar.open('Scrap enviado!', 'OK', { duration: 3000 });
  }

  /** Barra de formatação: envolve a seleção com marcadores simples (B, I, U). */
  protected format(marker: string): void {
    const el = this.composer()?.nativeElement;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const next = `${value.slice(0, start)}${marker}${value.slice(start, end)}${marker}${value.slice(end)}`;
    if (next.length > MAX_LENGTH) return;
    this.draft.set(next);
    el.value = next;
    el.focus();
    el.setSelectionRange(start + marker.length, end + marker.length);
  }

  protected insert(text: string): void {
    const next = `${this.draft()}${text}`;
    if (next.length <= MAX_LENGTH) this.draft.set(next);
    this.composer()?.nativeElement.focus();
  }

  /** FAB do mobile: revela o composer (oculto no compact) e leva o foco até ele. */
  protected openComposer(): void {
    this.composeOpen.set(true);
    afterNextRender(() => this.composer()?.nativeElement.focus(), { injector: this.injector });
  }

  protected toggleReply(scrap: Scrap): void {
    this.store.markScrapRead(scrap.id);
    this.replyDraft.set('');
    this.replyingTo.update((current) => (current === scrap.id ? null : scrap.id));
  }

  protected sendReply(scrap: Scrap): void {
    this.store.replyToScrap(scrap.id, this.replyDraft());
    this.replyingTo.set(null);
    this.snackBar.open(`Resposta enviada para ${scrap.authorName}.`, 'OK', { duration: 3000 });
  }

  protected remove(scrap: Scrap): void {
    this.store.deleteScrap(scrap.id);
    this.snackBar.open('Recado excluído.', 'OK', { duration: 3000 });
  }
}
