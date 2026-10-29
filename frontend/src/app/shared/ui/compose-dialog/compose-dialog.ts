import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ComposeDialogData {
  title: string;
  /** Rótulo do campo de texto. */
  label: string;
  submitLabel: string;
  maxLength: number;
  /** Quando presente, pede um destinatário (ex.: amigo do depoimento). */
  recipients?: { id: string; name: string }[];
  recipientLabel?: string;
}

export interface ComposeDialogResult {
  text: string;
  recipientId?: string;
}

/**
 * Diálogo genérico de escrita (depoimento, novo tópico…): texto obrigatório,
 * contador de caracteres e, opcionalmente, escolha de destinatário.
 */
@Component({
  selector: 'ok-compose-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form id="compose-form" (submit)="$event.preventDefault(); submit()">
      <mat-dialog-content class="flex flex-col gap-4 !pt-2">
        @if (data.recipients) {
          <div>
            <label class="ok-label" for="compose-recipient">{{ data.recipientLabel }}</label>
            <select
              id="compose-recipient"
              class="ok-input"
              required
              [value]="recipientId()"
              (change)="recipientId.set($any($event.target).value)"
            >
              @for (recipient of data.recipients; track recipient.id) {
                <option [value]="recipient.id" [selected]="recipient.id === recipientId()">
                  {{ recipient.name }}
                </option>
              }
            </select>
          </div>
        }
        <div>
          <label class="ok-label" for="compose-text">{{ data.label }}</label>
          <textarea
            id="compose-text"
            class="ok-input resize-none"
            rows="5"
            required
            cdkFocusInitial
            [attr.maxlength]="data.maxLength"
            [value]="text()"
            (input)="text.set($any($event.target).value)"
            data-testid="compose-text"
          ></textarea>
          <p class="mt-1 text-right text-xs text-ink-muted">
            {{ text().length }} / {{ data.maxLength }}
          </p>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end" class="gap-2 !px-6 !pb-5">
        <button type="button" class="ok-btn-tonal" mat-dialog-close>Cancelar</button>
        <button
          type="submit"
          class="ok-btn-primary"
          [disabled]="!valid()"
          data-testid="compose-submit"
        >
          {{ data.submitLabel }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class ComposeDialog {
  protected readonly data = inject<ComposeDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ComposeDialog, ComposeDialogResult>>(MatDialogRef);

  protected readonly text = signal('');
  protected readonly recipientId = signal(this.data.recipients?.[0]?.id ?? '');
  protected readonly valid = computed(
    () => this.text().trim().length > 0 && (!this.data.recipients || !!this.recipientId()),
  );

  protected submit(): void {
    if (!this.valid()) return;
    this.ref.close({
      text: this.text().trim(),
      recipientId: this.data.recipients ? this.recipientId() : undefined,
    });
  }
}
