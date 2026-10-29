import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { SocialStore } from '../../core/social/social.store';
import { normalize } from '../../layout/global-search/global-search';
import { Avatar } from '../../shared/ui/avatar/avatar';
import { PageHeader } from '../../shared/ui/page-header/page-header';

type FriendFilter = 'todos' | 'online' | 'melhores' | 'pedidos';

/** Amigos ("Amigos · Desktop 1440", "M · Amigos"). */
@Component({
  selector: 'ok-friends-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, MatIconModule, PageHeader, RouterLink],
  templateUrl: './friends-page.html',
  styleUrl: './friends-page.css',
})
export class FriendsPage {
  /** `?busca=` preenche a busca (vindo da busca global ou da Home). */
  readonly busca = input<string>();

  protected readonly store = inject(SocialStore);
  private readonly snackBar = inject(MatSnackBar);
  private readonly document = inject(DOCUMENT);

  protected readonly term = linkedSignal(() => this.busca() ?? '');
  protected readonly filter = signal<FriendFilter>('todos');

  protected readonly filters = computed(() => [
    { id: 'todos' as FriendFilter, label: 'Todos', count: this.store.friends().length },
    {
      id: 'online' as FriendFilter,
      label: 'Online',
      count: this.store.onlineFriends().length,
      dot: true,
    },
    {
      id: 'melhores' as FriendFilter,
      label: 'Melhores amigos',
      short: 'Melhores',
      count: this.store.friends().filter((f) => f.bestFriend).length,
      star: true,
    },
    { id: 'pedidos' as FriendFilter, label: 'Pedidos', count: this.store.friendRequests().length },
  ]);

  protected readonly friends = computed(() => {
    const term = normalize(this.term());
    return this.store.friends().filter((friend) => {
      if (term && !normalize(friend.name).includes(term)) return false;
      if (this.filter() === 'online') return friend.online;
      if (this.filter() === 'melhores') return friend.bestFriend;
      return true;
    });
  });

  protected readonly subtitle = computed(
    () =>
      `${this.store.friends().length} amigos · ${this.store.onlineFriends().length} online agora`,
  );

  protected async invite(): Promise<void> {
    const link = `${this.document.location.origin}/cadastro`;
    try {
      await this.document.defaultView?.navigator.clipboard.writeText(link);
      this.snackBar.open('Link de convite copiado! Envie para seus amigos.', 'OK', {
        duration: 3000,
      });
    } catch {
      this.snackBar.open(`Convide pelo link: ${link}`, 'OK', { duration: 6000 });
    }
  }
}
