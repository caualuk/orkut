import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { toApiError } from '../../core/http/api-error';

/**
 * Exclusão definitiva da conta: pede a senha atual e chama a API. Fecha com
 * `true` só depois que a conta foi excluída; senha errada aparece no próprio diálogo.
 */
@Component({
  selector: 'ok-delete-account-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Excluir conta permanentemente?</h2>
    <form (submit)="$event.preventDefault(); submit()" novalidate>
      <mat-dialog-content class="flex flex-col gap-4 !pt-2">
        <p class="text-sm text-ink-secondary">
          Esta ação é irreversível. Seu perfil, recados, mensagens, depoimentos, fotos e as
          comunidades que você criou serão apagados e não poderão ser recuperados.
        </p>
        <div>
          <label class="ok-label" for="delete-account-password">Confirme sua senha</label>
          <input
            id="delete-account-password"
            class="ok-input"
            type="password"
            autocomplete="current-password"
            maxlength="128"
            cdkFocusInitial
            [value]="password()"
            (input)="password.set($any($event.target).value); error.set(null)"
            [attr.aria-invalid]="error() ? 'true' : null"
            [attr.aria-describedby]="error() ? 'delete-account-error' : null"
            data-testid="delete-account-password"
          />
        </div>
        @if (error(); as message) {
          <div
            id="delete-account-error"
            role="alert"
            data-testid="delete-account-error"
            class="flex items-start gap-2 rounded-md bg-danger-container px-4 py-3 text-[13px] font-medium text-danger"
          >
            <mat-icon class="!size-5 shrink-0 !text-[20px]" aria-hidden="true" fontIcon="error" />
            <span>{{ message }}</span>
          </div>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end" class="gap-2 !px-6 !pb-5">
        <button type="button" class="ok-btn-tonal" mat-dialog-close [disabled]="pending()">
          Cancelar
        </button>
        <button
          type="submit"
          class="ok-btn-primary !bg-danger !bg-none"
          [disabled]="!password() || pending()"
          data-testid="delete-account-confirm"
        >
          {{ pending() ? 'Excluindo…' : 'Excluir conta' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class DeleteAccountDialog {
  private readonly auth = inject(AuthService);
  private readonly ref = inject<MatDialogRef<DeleteAccountDialog, boolean>>(MatDialogRef);

  protected readonly password = signal('');
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (!this.password() || this.pending()) return;
    this.pending.set(true);
    this.ref.disableClose = true;

    this.auth.deleteAccount(this.password()).subscribe({
      next: () => this.ref.close(true),
      error: (err: unknown) => {
        this.pending.set(false);
        this.ref.disableClose = false;
        this.error.set(toApiError(err).message);
      },
    });
  }
}
