import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import type { FeedKind } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import { Avatar, TONE_GRADIENTS } from '../../shared/ui/avatar/avatar';
import { CommentThread } from '../../shared/ui/comment-thread/comment-thread';
import { LikeButton } from '../../shared/ui/like-button/like-button';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { FortuneCard } from '../home/fortune-card';

type FeedFilter = 'tudo' | FeedKind;

/** Feeds ("Feeds · Desktop 1440", "M · Feeds"): atualizações reais dos amigos. */
@Component({
  selector: 'ok-feeds-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, CommentThread, FortuneCard, LikeButton, MatIconModule, PageHeader, RouterLink],
  templateUrl: './feeds-page.html',
  styleUrl: './feeds-page.css',
})
export class FeedsPage {
  protected readonly store = inject(SocialStore);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly gradients = TONE_GRADIENTS;
  protected readonly filters: { id: FeedFilter; label: string }[] = [
    { id: 'tudo', label: 'Tudo' },
    { id: 'fotos', label: 'Fotos' },
    { id: 'comunidades', label: 'Comunidades' },
    { id: 'amigos', label: 'Amigos' },
    { id: 'status', label: 'Status' },
  ];
  protected readonly filter = signal<FeedFilter>('tudo');
  protected readonly statusDraft = signal('');
  /** Itens com a área de comentários aberta (os que já têm comentários abrem sozinhos). */
  protected readonly openComments = signal<ReadonlySet<string>>(new Set());

  protected readonly items = computed(() => {
    const filter = this.filter();
    return this.store.feed().filter((item) => filter === 'tudo' || item.kind === filter);
  });

  /** Amigos que fazem aniversário hoje (pela data de nascimento real). */
  protected readonly birthdays = computed(() => {
    const names = this.store
      .friends()
      .filter((f) => f.birthdayToday)
      .map((f) => f.shortName);
    if (names.length <= 1) return names[0] ?? '';
    return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
  });

  protected postStatus(): void {
    const text = this.statusDraft().trim();
    if (!text) return;
    this.store.postStatus(text);
    this.statusDraft.set('');
    this.snackBar.open('Status publicado!', 'OK', { duration: 3000 });
  }

  protected toggleComments(id: string, thread: CommentThread): void {
    const open = new Set(this.openComments());
    if (open.has(id)) {
      open.delete(id);
    } else {
      open.add(id);
      // Espera a área abrir para focar o campo.
      setTimeout(() => thread.focus(), 50);
    }
    this.openComments.set(open);
  }

  protected toggleSuggestion(id: string, name: string, requested: boolean): void {
    this.store.toggleSuggestionRequest(id);
    if (!requested) {
      this.snackBar.open(`Pedido de amizade enviado para ${name}.`, 'OK', { duration: 3000 });
    }
  }
}
