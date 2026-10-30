import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { IMAGE_RULES_MESSAGE, isAcceptedImage } from '../../core/social/image-upload';
import type { Poll } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import { Avatar } from '../../shared/ui/avatar/avatar';
import {
  ComposeDialog,
  type ComposeDialogData,
  type ComposeDialogResult,
} from '../../shared/ui/compose-dialog/compose-dialog';
import {
  ConfirmDialog,
  type ConfirmDialogData,
} from '../../shared/ui/confirm-dialog/confirm-dialog';
import { injectCommunityDialogs } from './community-dialogs';

type Tab = 'forum' | 'enquetes' | 'eventos' | 'membros';

/** Comunidade ("Comunidade · Desktop 1440", "M · Comunidade"). */
@Component({
  selector: 'ok-community-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, MatIconModule, MatTooltipModule, RouterLink],
  templateUrl: './community-page.html',
  styleUrl: './community-page.css',
})
export class CommunityPage {
  readonly communityId = input.required<string>();

  protected readonly store = inject(SocialStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  protected readonly dialogs = injectCommunityDialogs();

  protected readonly community = computed(() => {
    const community = this.store.communityById(this.communityId());
    return community?.loaded ? community : undefined;
  });
  protected readonly loading = signal(true);
  protected readonly uploading = signal(false);
  /** Ao trocar de comunidade, volta para a aba Fórum. */
  protected readonly tab = linkedSignal<string, Tab>({
    source: this.communityId,
    computation: () => 'forum',
  });
  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'forum', label: 'Fórum' },
    { id: 'enquetes', label: 'Enquetes' },
    { id: 'eventos', label: 'Eventos' },
    { id: 'membros', label: 'Membros' },
  ];

  protected readonly related = computed(() =>
    (this.community()?.related ?? [])
      .map((id) => this.store.communityById(id))
      .filter((c) => c !== undefined),
  );

  protected readonly memberFriends = computed(() => {
    const names = this.community()?.friendsInside ?? [];
    return this.store.friends().filter((f) => names.includes(f.shortName));
  });

  constructor() {
    // Tópicos, enquetes e eventos vêm da API ao abrir (ou trocar de) comunidade.
    effect(() => {
      const slug = this.communityId();
      untracked(() => {
        this.loading.set(true);
        void this.store.loadCommunity(slug).finally(() => this.loading.set(false));
      });
    });
  }

  protected totalVotes(poll: Poll): number {
    return poll.options.reduce((total, option) => total + option.votes, 0);
  }

  protected percent(poll: Poll, votes: number): number {
    const total = this.totalVotes(poll);
    return total ? Math.round((votes / total) * 100) : 0;
  }

  protected toggleMembership(): void {
    const community = this.community();
    if (!community) return;
    if (community.isOwner && community.joined) {
      this.snackBar.open('Você é o dono desta comunidade e não pode sair dela.', 'OK', {
        duration: 4000,
      });
      return;
    }
    this.store.toggleMembership(community.id);
    this.snackBar.open(
      community.joined
        ? `Você saiu de "${community.name}".`
        : `Você entrou em "${community.name}"!`,
      'OK',
      { duration: 3000 },
    );
  }

  protected async onPhoto(files: FileList | null): Promise<void> {
    const file = files?.[0];
    const community = this.community();
    if (!file || !community) return;
    if (!isAcceptedImage(file)) {
      this.snackBar.open(IMAGE_RULES_MESSAGE, 'OK', { duration: 4000 });
      return;
    }
    this.uploading.set(true);
    const ok = await this.store.uploadCommunityPhoto(community.id, file);
    this.uploading.set(false);
    this.snackBar.open(
      ok ? 'Foto da comunidade atualizada!' : 'Não foi possível enviar a foto.',
      'OK',
      {
        duration: 3000,
      },
    );
  }

  protected async removePhoto(): Promise<void> {
    const community = this.community();
    if (!community) return;
    this.uploading.set(true);
    await this.store.removeCommunityPhoto(community.id);
    this.uploading.set(false);
  }

  protected async deleteCommunity(): Promise<void> {
    const community = this.community();
    if (!community) return;
    const confirmed = await firstValueFrom(
      this.dialog
        .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
          width: '440px',
          maxWidth: 'calc(100vw - 32px)',
          data: {
            title: 'Excluir comunidade?',
            message: `"${community.name}" será apagada para todos os membros, com tópicos, enquetes e eventos. Essa ação não pode ser desfeita.`,
            confirmLabel: 'Excluir comunidade',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (!confirmed) return;
    // Mantém o carregamento na tela até sair da página da comunidade apagada.
    this.loading.set(true);
    if (await this.store.deleteCommunity(community.id)) {
      this.snackBar.open('Comunidade excluída.', 'OK', { duration: 3000 });
      await this.router.navigateByUrl('/comunidades');
    }
    this.loading.set(false);
  }

  protected async share(): Promise<void> {
    const url = globalThis.location?.href ?? '';
    try {
      await globalThis.navigator.clipboard.writeText(url);
      this.snackBar.open('Link da comunidade copiado!', 'OK', { duration: 3000 });
    } catch {
      this.snackBar.open(url, 'OK', { duration: 5000 });
    }
  }

  protected newTopic(): void {
    const community = this.community();
    if (!community) return;
    this.dialog
      .open<ComposeDialog, ComposeDialogData, ComposeDialogResult>(ComposeDialog, {
        width: '520px',
        maxWidth: 'calc(100vw - 32px)',
        data: {
          title: 'Novo tópico',
          label: 'Título do tópico',
          submitLabel: 'Criar tópico',
          maxLength: 120,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.store.createTopic(community.id, result.text);
        this.tab.set('forum');
        this.snackBar.open('Tópico criado!', 'OK', { duration: 3000 });
      });
  }
}
