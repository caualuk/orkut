import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import type { Poll } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import { Avatar } from '../../shared/ui/avatar/avatar';
import {
  ComposeDialog,
  type ComposeDialogData,
  type ComposeDialogResult,
} from '../../shared/ui/compose-dialog/compose-dialog';

type Tab = 'forum' | 'enquetes' | 'eventos' | 'membros';

/** Comunidade ("Comunidade · Desktop 1440", "M · Comunidade"). */
@Component({
  selector: 'ok-community-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, MatIconModule, RouterLink],
  templateUrl: './community-page.html',
  styleUrl: './community-page.css',
})
export class CommunityPage {
  readonly communityId = input.required<string>();

  protected readonly store = inject(SocialStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly community = computed(() => this.store.communityById(this.communityId()));
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
    this.store.toggleMembership(community.id);
    this.snackBar.open(
      community.joined
        ? `Você saiu de "${community.name}".`
        : `Você entrou em "${community.name}"!`,
      'OK',
      { duration: 3000 },
    );
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
