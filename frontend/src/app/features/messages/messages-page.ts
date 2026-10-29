import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink } from '@angular/router';
import type { Friend } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import { normalize } from '../../layout/global-search/global-search';
import { Avatar } from '../../shared/ui/avatar/avatar';

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Mensagens ("Mensagens · Desktop 1440", "T · Mensagens", "M · Mensagens",
 * "M · Conversa"): dois painéis no desktop/tablet (list-detail); no mobile a
 * lista e a conversa são telas separadas (`/mensagens` e `/mensagens/:id`).
 */
@Component({
  selector: 'ok-messages-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, MatIconModule, MatMenuModule, RouterLink],
  templateUrl: './messages-page.html',
  styleUrl: './messages-page.css',
})
export class MessagesPage {
  /** Conversa aberta (parâmetro de rota). */
  readonly conversationId = input<string>();

  protected readonly store = inject(SocialStore);
  private readonly router = inject(Router);
  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  protected readonly maxLength = MAX_MESSAGE_LENGTH;
  protected readonly search = signal('');
  protected readonly draft = signal('');

  protected readonly conversations = computed(() => {
    const term = normalize(this.search());
    return this.store.conversations().filter((c) => !term || normalize(c.name).includes(term));
  });

  /** No desktop/tablet, sem id na rota, a primeira conversa já aparece aberta. */
  protected readonly selectedId = computed(
    () => this.conversationId() ?? this.store.conversations()[0]?.id,
  );
  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? this.store.conversationById(id) : undefined;
  });
  protected readonly hasRouteConversation = computed(() => Boolean(this.conversationId()));

  constructor() {
    // Abrir a conversa zera os não lidos.
    effect(() => {
      const id = this.selectedId();
      if (id) untracked(() => this.store.openConversation(id));
    });

    // Mantém a conversa rolada até a última mensagem.
    afterRenderEffect(() => {
      const el = this.thread()?.nativeElement;
      // Ler `messages.length` também registra a dependência: nova mensagem → rola de novo.
      if (el && this.selected()?.messages.length) el.scrollTop = el.scrollHeight;
    });
  }

  protected preview(id: string): string {
    const conversation = this.store.conversationById(id);
    const last = conversation?.messages.at(-1);
    if (!last) return 'Comece a conversa';
    return last.fromMe ? `Você: ${last.text}` : last.text;
  }

  protected send(): void {
    const id = this.selectedId();
    const text = this.draft().trim();
    if (!id || !text) return;
    this.store.sendMessage(id, text);
    this.draft.set('');
  }

  protected insert(text: string): void {
    const next = `${this.draft()}${text}`;
    if (next.length <= MAX_MESSAGE_LENGTH) this.draft.set(next);
  }

  protected startWith(friend: Friend): void {
    const id = this.store.startConversation(friend);
    void this.router.navigate(['/mensagens', id]);
  }
}
