import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { parseYouTubeId, youTubeLink } from '../../core/social/profile-music';
import { SocialStore } from '../../core/social/social.store';
import { MusicPlayerState } from './music-player';

/** Modal do botão ♪: escolhe, toca, para ou remove a música do perfil. */
@Component({
  selector: 'ok-music-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule],
  template: `
    <h2 mat-dialog-title>Música do perfil</h2>
    <form (submit)="$event.preventDefault(); save()" novalidate>
      <mat-dialog-content class="!flex flex-col gap-4 !pt-2">
        <div>
          <label class="ok-label" for="music-url">Link do YouTube</label>
          <input
            id="music-url"
            class="ok-input"
            type="url"
            inputmode="url"
            placeholder="https://www.youtube.com/watch?v=..."
            [value]="link()"
            [attr.aria-invalid]="invalid()"
            (input)="link.set($any($event.target).value)"
            data-testid="music-url"
          />
          @if (invalid()) {
            <p class="mt-1 text-xs text-danger" role="alert">Cole o link de um vídeo do YouTube.</p>
          }
        </div>
        <div>
          <label class="ok-label" for="music-title">Nome da música (opcional)</label>
          <input
            id="music-title"
            class="ok-input"
            maxlength="80"
            placeholder="Ex.: Anna Júlia"
            [value]="title()"
            (input)="title.set($any($event.target).value)"
            data-testid="music-title"
          />
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end" class="gap-2 !px-6 !pb-5">
        @if (current) {
          <button
            type="button"
            class="mr-auto cursor-pointer text-[13px] font-bold text-danger"
            (click)="remove()"
            data-testid="music-remove"
          >
            Remover
          </button>
        }
        @if (player.playing()) {
          <button type="button" class="ok-btn-tonal" (click)="stop()" data-testid="music-stop">
            Parar
          </button>
        } @else {
          <button type="button" class="ok-btn-tonal" mat-dialog-close>Cancelar</button>
        }
        <button
          type="submit"
          class="ok-btn-primary"
          [disabled]="!videoId()"
          data-testid="music-save"
        >
          Salvar e tocar
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class MusicDialog {
  private readonly store = inject(SocialStore);
  private readonly ref = inject<MatDialogRef<MusicDialog>>(MatDialogRef);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly player = inject(MusicPlayerState);

  protected readonly current = this.store.profile().music;
  protected readonly link = signal(this.current ? youTubeLink(this.current.videoId) : '');
  protected readonly title = signal(this.current?.title ?? '');

  protected readonly videoId = computed(() => parseYouTubeId(this.link()));
  protected readonly invalid = computed(() => Boolean(this.link().trim()) && !this.videoId());

  protected save(): void {
    const videoId = this.videoId();
    if (!videoId) return;
    const title = this.title().trim() || 'Música do perfil';
    this.store.updateProfile({ music: { videoId, title } });
    this.player.play({ videoId, title });
    this.ref.close();
  }

  protected stop(): void {
    this.player.stop();
    this.ref.close();
  }

  protected remove(): void {
    this.player.stop();
    this.store.updateProfile({ music: null });
    this.ref.close();
    this.snackBar.open('Música removida do perfil.', 'OK', { duration: 3000 });
  }
}
