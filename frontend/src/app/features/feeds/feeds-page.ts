import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import type { FeedKind } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import { Avatar, TONE_GRADIENTS } from '../../shared/ui/avatar/avatar';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { FortuneCard } from '../home/fortune-card';

type FeedFilter = 'tudo' | FeedKind;

/** Feeds ("Feeds · Desktop 1440", "M · Feeds"): atualizações dos amigos. */
@Component({
  selector: 'ok-feeds-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, FortuneCard, MatIconModule, PageHeader, RouterLink],
  templateUrl: './feeds-page.html',
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

  protected readonly items = computed(() => {
    const filter = this.filter();
    return this.store.feed().filter((item) => filter === 'tudo' || item.kind === filter);
  });

  protected readonly birthdays = computed(() =>
    this.store
      .friends()
      .filter((f) => f.bestFriend)
      .slice(0, 2)
      .map((f) => f.shortName)
      .join(' e do '),
  );

  protected toggleSuggestion(id: string, name: string, requested: boolean): void {
    this.store.toggleSuggestionRequest(id);
    if (!requested) {
      this.snackBar.open(`Pedido de amizade enviado para ${name}.`, 'OK', { duration: 3000 });
    }
  }
}
