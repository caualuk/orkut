import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { Testimonial } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import { Avatar } from '../../shared/ui/avatar/avatar';
import {
  ComposeDialog,
  type ComposeDialogData,
  type ComposeDialogResult,
} from '../../shared/ui/compose-dialog/compose-dialog';
import { PageHeader } from '../../shared/ui/page-header/page-header';

type Tab = 'recebido' | 'enviado' | 'pendente';

/** Depoimentos ("Depoimentos · Desktop 1440", "M · Depoimentos"). */
@Component({
  selector: 'ok-testimonials-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, MatIconModule, PageHeader],
  templateUrl: './testimonials-page.html',
  styleUrl: './testimonials-page.css',
})
export class TestimonialsPage {
  protected readonly store = inject(SocialStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly tab = signal<Tab>('recebido');
  protected readonly reading = signal<string | null>(null);

  private readonly byStatus = (status: Tab) =>
    computed(() => this.store.testimonials().filter((t) => t.status === status));
  protected readonly received = this.byStatus('recebido');
  protected readonly sent = this.byStatus('enviado');
  protected readonly pending = this.byStatus('pendente');

  protected readonly tabs = computed(() => [
    { id: 'recebido' as Tab, label: 'Recebidos', count: this.received().length },
    { id: 'enviado' as Tab, label: 'Enviados', count: this.sent().length },
    { id: 'pendente' as Tab, label: 'Pendentes', count: this.pending().length },
  ]);

  protected readonly list = computed(() => {
    switch (this.tab()) {
      case 'enviado':
        return this.sent();
      case 'pendente':
        return this.pending();
      default:
        return this.received();
    }
  });

  protected approve(item: Testimonial): void {
    this.store.approveTestimonial(item.id);
    this.snackBar.open(`Depoimento de ${item.authorName} aprovado e visível no seu perfil.`, 'OK', {
      duration: 3000,
    });
  }

  protected reject(item: Testimonial): void {
    this.store.rejectTestimonial(item.id);
    this.snackBar.open('Depoimento recusado.', 'OK', { duration: 3000 });
  }

  protected write(): void {
    const friends = this.store.friends();
    this.dialog
      .open<ComposeDialog, ComposeDialogData, ComposeDialogResult>(ComposeDialog, {
        width: '520px',
        maxWidth: 'calc(100vw - 32px)',
        data: {
          title: 'Escrever depoimento',
          label: 'O que você quer dizer?',
          submitLabel: 'Enviar depoimento',
          maxLength: 1000,
          recipients: friends.map(({ id, name }) => ({ id, name })),
          recipientLabel: 'Para',
        },
      })
      .afterClosed()
      .subscribe((result) => {
        const friend = result?.recipientId ? this.store.friendById(result.recipientId) : undefined;
        if (!result || !friend) return;
        this.store.writeTestimonial(friend, result.text);
        this.tab.set('enviado');
        this.snackBar.open(
          `Depoimento enviado! ${friend.shortName} precisa aprovar para ele aparecer.`,
          'OK',
          { duration: 4000 },
        );
      });
  }
}
