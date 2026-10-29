import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
}

/** Confirmação para ações destrutivas. Fecha com `true` ao confirmar. */
@Component({
  selector: 'ok-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="text-sm text-ink-secondary">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="gap-2 !px-6 !pb-5">
      <button type="button" class="ok-btn-tonal" [mat-dialog-close]="false" cdkFocusInitial>
        Cancelar
      </button>
      <button
        type="button"
        class="ok-btn-primary"
        [class.!bg-none]="data.danger"
        [class.!bg-danger]="data.danger"
        [mat-dialog-close]="true"
        data-testid="confirm-dialog-confirm"
      >
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
