import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { VISIBILITY_LABELS, type Settings, type Visibility } from '../../core/social/social.models';
import { SocialStore } from '../../core/social/social.store';
import {
  ConfirmDialog,
  type ConfirmDialogData,
} from '../../shared/ui/confirm-dialog/confirm-dialog';

type SectionId = 'geral' | 'privacidade' | 'notificacoes' | 'aparencia' | 'conta';
type ToggleKey = 'showRecentVisitors' | 'allowTestimonials' | 'appearOnline';
type NotificationKey = keyof Settings['notifications'];

/**
 * Configurações ("Configurações · Desktop 1440", "M · Configurações"). As seções
 * ficam empilhadas; no desktop o menu interno leva até cada uma.
 */
@Component({
  selector: 'ok-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatSlideToggleModule, RouterLink],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPage {
  protected readonly store = inject(SocialStore);
  protected readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  protected readonly sections: { id: SectionId; label: string; icon: string }[] = [
    { id: 'geral', label: 'Geral', icon: 'tune' },
    { id: 'privacidade', label: 'Privacidade', icon: 'lock' },
    { id: 'notificacoes', label: 'Notificações', icon: 'notifications' },
    { id: 'aparencia', label: 'Aparência', icon: 'contrast' },
    { id: 'conta', label: 'Conta e segurança', icon: 'shield' },
  ];
  protected readonly active = signal<SectionId>('privacidade');

  protected readonly visibilityLabels = VISIBILITY_LABELS;
  protected readonly visibilityOptions = Object.keys(VISIBILITY_LABELS) as Visibility[];

  protected readonly toggles: { key: ToggleKey; title: string; description: string }[] = [
    {
      key: 'showRecentVisitors',
      title: 'Mostrar visitantes recentes',
      description: 'Você também aparecerá nos perfis que visitar',
    },
    {
      key: 'allowTestimonials',
      title: 'Permitir depoimentos',
      description: 'Novos depoimentos precisam da sua aprovação',
    },
    {
      key: 'appearOnline',
      title: 'Aparecer como online',
      description: 'Seus amigos verão quando você estiver ativo',
    },
  ];

  protected readonly notificationToggles: { key: NotificationKey; title: string }[] = [
    { key: 'scraps', title: 'Novos recados' },
    { key: 'testimonials', title: 'Depoimentos recebidos' },
    { key: 'friendRequests', title: 'Pedidos de amizade' },
    { key: 'birthdays', title: 'Aniversários dos amigos' },
  ];

  protected readonly themes: { id: Settings['theme']; label: string }[] = [
    { id: 'claro', label: 'Claro' },
    { id: 'escuro', label: 'Escuro' },
    { id: 'sistema', label: 'Sistema' },
  ];

  protected goTo(id: SectionId): void {
    this.active.set(id);
    const target = this.document.getElementById(`config-${id}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target?.focus({ preventScroll: true });
  }

  protected setToggle(key: ToggleKey, value: boolean): void {
    this.store.updateSettings({ [key]: value });
  }

  protected setNotification(key: NotificationKey, value: boolean): void {
    const notifications = { ...this.store.settings().notifications, [key]: value };
    this.store.updateSettings({ notifications });
  }

  protected deactivate(): void {
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        width: '440px',
        maxWidth: 'calc(100vw - 32px)',
        data: {
          title: 'Desativar conta?',
          message:
            'Seu perfil, recados e fotos ficarão ocultos até você voltar. Para reativar, basta entrar novamente.',
          confirmLabel: 'Desativar',
          danger: true,
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const done = () => void this.router.navigateByUrl('/login');
        this.auth.logout().subscribe({ complete: done, error: done });
      });
  }
}
