import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { IMAGE_RULES_MESSAGE, isAcceptedImage } from '../../../core/social/image-upload';

export interface FormDialogField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'datetime-local' | 'image';
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  value?: string;
  /** Campo `image`: o arquivo não cabe no resultado de texto, então sai por aqui. */
  onImage?: (file: File | null) => void;
}

export interface FormDialogData {
  title: string;
  submitLabel: string;
  fields: FormDialogField[];
}

export type FormDialogResult = Record<string, string>;

/**
 * Diálogo de formulário simples (criar comunidade, enquete, evento): campos
 * declarativos, validação de obrigatório/tamanho e retorno dos valores aparados.
 */
@Component({
  selector: 'ok-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form (submit)="$event.preventDefault(); submit()" novalidate>
      <mat-dialog-content class="!flex flex-col gap-4 !pt-2">
        @for (field of data.fields; track field.key; let first = $first) {
          <div>
            <label class="ok-label" [for]="'form-' + field.key">
              {{ field.label }}{{ field.required ? '' : ' (opcional)' }}
            </label>
            @switch (field.type) {
              @case ('textarea') {
                <textarea
                  [id]="'form-' + field.key"
                  class="ok-input resize-none"
                  rows="4"
                  [attr.maxlength]="field.maxLength"
                  [attr.placeholder]="field.placeholder"
                  [attr.aria-describedby]="field.hint ? 'hint-' + field.key : null"
                  [attr.cdkFocusInitial]="first ? '' : null"
                  [value]="values()[field.key] ?? ''"
                  (input)="set(field.key, $any($event.target).value)"
                  [attr.data-testid]="'form-' + field.key"
                ></textarea>
              }
              @case ('image') {
                <div class="flex items-center gap-3">
                  @if (preview(); as url) {
                    <img [src]="url" alt="" class="size-14 rounded-2xl object-cover" />
                  } @else {
                    <span
                      class="grid size-14 place-items-center rounded-2xl bg-surface-variant text-ink-secondary"
                      aria-hidden="true"
                    >
                      <mat-icon fontIcon="add_a_photo" />
                    </span>
                  }
                  <label class="ok-btn-tonal cursor-pointer focus-within:outline-2">
                    <input
                      [id]="'form-' + field.key"
                      type="file"
                      class="sr-only"
                      accept="image/png,image/jpeg"
                      (change)="pick(field, $any($event.target))"
                      [attr.data-testid]="'form-' + field.key"
                    />
                    {{ preview() ? 'Trocar imagem' : 'Escolher imagem' }}
                  </label>
                  @if (preview()) {
                    <button
                      type="button"
                      class="cursor-pointer text-[13px] font-bold text-danger"
                      (click)="clear(field)"
                    >
                      Remover
                    </button>
                  }
                </div>
                @if (imageError()) {
                  <p class="mt-1 text-xs text-danger" role="alert">{{ imageError() }}</p>
                }
              }
              @case ('select') {
                <select
                  [id]="'form-' + field.key"
                  class="ok-input"
                  [value]="values()[field.key] ?? ''"
                  (change)="set(field.key, $any($event.target).value)"
                  [attr.data-testid]="'form-' + field.key"
                >
                  @for (option of field.options ?? []; track option.value) {
                    <option
                      [value]="option.value"
                      [selected]="option.value === values()[field.key]"
                    >
                      {{ option.label }}
                    </option>
                  }
                </select>
              }
              @default {
                <input
                  [id]="'form-' + field.key"
                  class="ok-input"
                  [type]="field.type"
                  [attr.maxlength]="field.maxLength"
                  [attr.placeholder]="field.placeholder"
                  [attr.aria-describedby]="field.hint ? 'hint-' + field.key : null"
                  [value]="values()[field.key] ?? ''"
                  (input)="set(field.key, $any($event.target).value)"
                  [attr.data-testid]="'form-' + field.key"
                />
              }
            }
            @if (field.hint) {
              <p [id]="'hint-' + field.key" class="mt-1 text-xs text-ink-muted">{{ field.hint }}</p>
            }
          </div>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end" class="gap-2 !px-6 !pb-5">
        <button type="button" class="ok-btn-tonal" mat-dialog-close>Cancelar</button>
        <button
          type="submit"
          class="ok-btn-primary"
          [disabled]="!valid()"
          data-testid="form-submit"
        >
          {{ data.submitLabel }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class FormDialog {
  protected readonly data = inject<FormDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<FormDialog, FormDialogResult>>(MatDialogRef);

  protected readonly values = signal<FormDialogResult>(
    Object.fromEntries(
      this.data.fields.map((f) => [f.key, f.value ?? f.options?.[0]?.value ?? '']),
    ),
  );

  /** Prévia da imagem escolhida (`blob:`, liberada ao trocar ou fechar). */
  protected readonly preview = signal<string | null>(null);
  protected readonly imageError = signal('');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.setPreview(null));
  }

  protected readonly valid = computed(() =>
    this.data.fields.every((field) => {
      const value = (this.values()[field.key] ?? '').trim();
      if (field.required && !value) return false;
      return !value || value.length >= (field.minLength ?? 0);
    }),
  );

  protected set(key: string, value: string): void {
    this.values.update((values) => ({ ...values, [key]: value }));
  }

  protected pick(field: FormDialogField, input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!isAcceptedImage(file)) {
      this.imageError.set(IMAGE_RULES_MESSAGE);
      return;
    }
    this.imageError.set('');
    this.setPreview(URL.createObjectURL(file));
    field.onImage?.(file);
  }

  protected clear(field: FormDialogField): void {
    this.setPreview(null);
    field.onImage?.(null);
  }

  private setPreview(url: string | null): void {
    const previous = this.preview();
    if (previous) URL.revokeObjectURL(previous);
    this.preview.set(url);
  }

  protected submit(): void {
    if (!this.valid()) return;
    this.ref.close(
      Object.fromEntries(Object.entries(this.values()).map(([key, value]) => [key, value.trim()])),
    );
  }
}
