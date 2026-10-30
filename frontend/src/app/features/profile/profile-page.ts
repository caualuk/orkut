import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import type { PublicProfile } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import { MusicDialog } from '../../layout/music-toggle/music-dialog';
import { MusicPlayerState } from '../../layout/music-toggle/music-player';
import { Avatar } from '../../shared/ui/avatar/avatar';

/**
 * Perfil de um membro (`/perfil/:userId`) ou o próprio (`/perfil`). Não há tela
 * no design: segue a capa e os cartões da página de comunidade. Ao entrar em
 * outro perfil, a música do dono começa a tocar; ao sair, ela para.
 */
@Component({
  selector: 'ok-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, MatIconModule, RouterLink],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePage {
  readonly userId = input<string>();

  protected readonly store = inject(SocialStore);
  private readonly player = inject(MusicPlayerState);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  private readonly targetId = computed(() => this.userId() ?? this.store.profile().id);

  protected readonly profile = signal<PublicProfile | null>(null);
  protected readonly loading = signal(true);

  /** A música deste perfil é a que está tocando agora. */
  protected readonly playingHere = computed(() => {
    const music = this.profile()?.music;
    return Boolean(music) && this.player.track()?.videoId === music?.videoId;
  });

  constructor() {
    effect(() => {
      const id = this.targetId();
      if (!id) return;
      untracked(() => {
        this.player.stopVisited();
        this.loading.set(true);
        void this.load(id, true);
      });
    });
    inject(DestroyRef).onDestroy(() => this.player.stopVisited());
  }

  private async load(id: string, entering: boolean): Promise<void> {
    const profile = await this.store.loadPublicProfile(id);
    // Trocou de perfil enquanto este carregava: a resposta já não interessa.
    if (id !== this.targetId()) return;
    this.profile.set(profile);
    this.loading.set(false);
    if (entering && profile?.music && profile.relation !== 'me') this.play(profile);
  }

  private play(profile: PublicProfile): void {
    if (!profile.music) return;
    this.player.play({
      ...profile.music,
      owner: profile.relation === 'me' ? undefined : profile.name,
    });
  }

  protected toggleMusic(profile: PublicProfile): void {
    if (this.playingHere()) this.player.stop();
    else this.play(profile);
  }

  protected chooseMusic(): void {
    this.dialog
      .open(MusicDialog, { width: '480px', maxWidth: 'calc(100vw - 32px)' })
      .afterClosed()
      .subscribe(() => void this.load(this.targetId(), false));
  }

  protected addFriend(profile: PublicProfile): void {
    this.store.requestFriend(profile.id);
    this.profile.set({ ...profile, relation: 'sent' });
    this.snackBar.open(`Pedido enviado para ${profile.shortName}!`, 'OK', { duration: 3000 });
  }

  protected cancelRequest(profile: PublicProfile): void {
    this.store.cancelFriendRequest(profile.id);
    this.profile.set({ ...profile, relation: 'none' });
  }

  protected accept(profile: PublicProfile): void {
    this.store.acceptFriendRequest(profile.id);
    this.profile.set({
      ...profile,
      relation: 'friend',
      friendCount: profile.friendCount + 1,
    });
    this.snackBar.open(`Agora você e ${profile.name} são amigos!`, 'OK', { duration: 3000 });
  }
}
