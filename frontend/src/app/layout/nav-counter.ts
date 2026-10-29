import { inject, Pipe, type PipeTransform } from '@angular/core';
import { SocialStore } from '../core/social/social.store';
import type { NavItem } from './navigation';

/** Valor do contador de um item de navegação (0 = sem contador). */
@Pipe({ name: 'navCounter', pure: false })
export class NavCounterPipe implements PipeTransform {
  private readonly store = inject(SocialStore);

  transform(item: NavItem): number {
    switch (item.counter) {
      case 'scraps':
        return this.store.unreadScraps();
      case 'messages':
        return this.store.unreadMessages();
      case 'photos':
        return this.store.totalPhotos();
      default:
        return 0;
    }
  }
}
