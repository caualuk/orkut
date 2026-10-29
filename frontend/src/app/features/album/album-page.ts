import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { VISIBILITY_LABELS, type Visibility } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import { TONE_GRADIENTS } from '../../shared/ui/avatar/avatar';
import { PageHeader } from '../../shared/ui/page-header/page-header';

/** Álbum ("Álbum · Desktop 1440", "M · Álbum"): álbuns, criação e fotos recentes. */
@Component({
  selector: 'ok-album-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, PageHeader],
  templateUrl: './album-page.html',
  styleUrl: './album-page.css',
})
export class AlbumPage {
  protected readonly store = inject(SocialStore);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly gradients = TONE_GRADIENTS;
  protected readonly visibilityLabels = VISIBILITY_LABELS;
  protected readonly visibilityOptions = Object.keys(VISIBILITY_LABELS) as Visibility[];

  protected readonly creating = signal(false);
  protected readonly newTitle = signal('');
  protected readonly newVisibility = signal<Visibility>('somente-eu');
  protected readonly dragging = signal(false);

  protected readonly subtitle = computed(
    () => `${this.store.albums().length} álbuns · ${this.store.totalPhotos()} fotos`,
  );

  protected startCreating(): void {
    this.creating.set(true);
  }

  protected create(): void {
    const title = this.newTitle().trim();
    if (!title) return;
    this.store.createAlbum(title, this.newVisibility());
    this.newTitle.set('');
    this.newVisibility.set('somente-eu');
    this.creating.set(false);
    this.snackBar.open(`Álbum "${title}" criado!`, 'OK', { duration: 3000 });
  }

  protected onFiles(files: FileList | null): void {
    this.dragging.set(false);
    if (!files?.length) return;

    const added = this.store.addPhotos(Array.from(files));
    const rejected = files.length - added;
    const message = added
      ? `${added} foto(s) adicionada(s) às fotos recentes.`
      : 'Nenhuma foto adicionada.';
    this.snackBar.open(rejected ? `${message} Use JPG ou PNG de até 5 MB.` : message, 'OK', {
      duration: 4000,
    });
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.onFiles(event.dataTransfer?.files ?? null);
  }
}
