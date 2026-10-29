import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { SocialStore } from '../../core/social/social.store';
import { normalize } from '../../layout/global-search/global-search';
import { Avatar } from '../../shared/ui/avatar/avatar';
import { ProfilePhoto } from '../../shared/ui/profile-photo/profile-photo';
import { FortuneCard } from './fortune-card';

const MAX_SCRAP_LENGTH = 1000;

/**
 * Home autenticada ("Home · Desktop 1440", "T · Home", "M · Home"): boas-vindas
 * com estatísticas, sorte do dia, pedidos de amizade, recados recentes, amigos
 * e comunidades.
 */
@Component({
  selector: 'ok-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, FortuneCard, MatIconModule, ProfilePhoto, RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage {
  protected readonly store = inject(SocialStore);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly maxScrapLength = MAX_SCRAP_LENGTH;
  protected readonly scrapDraft = signal('');
  protected readonly friendFilter = signal('');
  protected readonly tipDismissed = signal(false);

  protected readonly stats = computed(() => [
    { icon: 'mail', value: this.store.receivedScraps().length, label: 'recados', link: '/recados' },
    { icon: 'photo_library', value: this.store.totalPhotos(), label: 'fotos', link: '/album' },
    { icon: 'star', value: this.store.profile().fans, label: 'fãs', link: '/depoimentos' },
    {
      icon: 'auto_awesome',
      value: this.store.unreadMessages(),
      label: 'mensagens',
      link: '/mensagens',
      highlight: this.store.unreadMessages() > 0,
    },
  ]);

  protected readonly recentScraps = computed(() => this.store.receivedScraps().slice(0, 2));

  protected readonly visibleFriends = computed(() => {
    const term = normalize(this.friendFilter());
    return this.store
      .friends()
      .filter((friend) => !term || normalize(friend.name).includes(term))
      .slice(0, 9);
  });

  protected readonly topCommunities = computed(() => this.store.myCommunities().slice(0, 3));

  protected readonly birthdayNames = computed(() => {
    const [first, second] = this.store.friends().filter((f) => f.bestFriend);
    return [first?.shortName, second?.shortName].filter(Boolean).join(' e ');
  });

  protected sendScrap(): void {
    const text = this.scrapDraft().trim();
    if (!text) return;
    this.store.sendScrap(text);
    this.scrapDraft.set('');
    this.snackBar.open('Scrap publicado no seu mural!', 'OK', { duration: 3000 });
  }

  protected accept(id: string, name: string): void {
    this.store.acceptFriendRequest(id);
    this.snackBar.open(`Agora você e ${name} são amigos!`, 'OK', { duration: 3000 });
  }
}
