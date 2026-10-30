import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRippleModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import type { Gender, Relationship, SignupData } from '../../../../../core/auth/auth.models';
import { TiltDirective } from '../../../../../shared/motion/tilt.directive';
import { photoError } from '../../../onboarding/onboarding-api';
import { passwordStrength } from './password-strength';

export const MIN_SIGNUP_AGE = 13;
export const ABOUT_MAX_LENGTH = 500;

/** Mesma regra da API: 8+ caracteres, com letras e números. */
function passwordRule(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value ?? '';
  if (!value) return null;
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value)
    ? null
    : { passwordRule: true };
}

/** Aniversário: exige idade mínima e data plausível (vazio fica para o `required`). */
export function birthDateRule(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value;
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime()) || value < '1900-01-01') return { birthDate: true };

  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  if (
    now.getMonth() < date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())
  ) {
    age--;
  }
  return age >= MIN_SIGNUP_AGE ? null : { minAge: true };
}

export interface SignupSubmission {
  data: SignupData;
  photo: File | null;
}

type Step = 1 | 2;

/**
 * Card "Criar conta" em duas etapas no mesmo card (apresentação):
 *  1. informações gerais + e-mail e senha;
 *  2. foto de perfil (opcional), descrição breve e aceite dos termos.
 * Valida cada etapa e emite os dados; quem chama a API é a página.
 */
@Component({
  selector: 'ok-signup-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRippleModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink,
    TiltDirective,
  ],
  templateUrl: './signup-form.html',
  styleUrl: './signup-form.css',
})
export class SignupForm {
  readonly pending = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitted = output<SignupSubmission>();

  private readonly injector = inject(Injector);

  protected readonly step = signal<Step>(1);
  protected readonly passwordVisible = signal(false);
  protected readonly photo = signal<File | null>(null);
  protected readonly photoUrl = signal<string | null>(null);
  protected readonly photoMessage = signal<string | null>(null);
  protected readonly minAge = MIN_SIGNUP_AGE;
  protected readonly aboutMax = ABOUT_MAX_LENGTH;
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly genders: { value: Gender; label: string }[] = [
    { value: 'feminino', label: 'Feminino' },
    { value: 'masculino', label: 'Masculino' },
    { value: 'outro', label: 'Outro' },
    { value: 'nao-informar', label: 'Prefiro não informar' },
  ];
  protected readonly relationships: { value: Relationship; label: string }[] = [
    { value: 'solteiro', label: 'Solteiro(a)' },
    { value: 'namorando', label: 'Namorando' },
    { value: 'casado', label: 'Casado(a)' },
    { value: 'relacionamento-aberto', label: 'Relacionamento aberto' },
    { value: 'nao-informar', label: 'Prefiro não informar' },
  ];

  private readonly firstInput = viewChild<ElementRef<HTMLInputElement>>('firstInput');
  private readonly stepTwoTitle = viewChild<ElementRef<HTMLElement>>('stepTwoTitle');
  private readonly errorAlert = viewChild<ElementRef<HTMLElement>>('errorAlert');

  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly general = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(40)]],
    lastName: ['', [Validators.required, Validators.maxLength(40)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(128), passwordRule]],
    gender: this.fb.control<Gender | ''>('', Validators.required),
    relationship: this.fb.control<Relationship | ''>('', Validators.required),
    birthDate: ['', [Validators.required, birthDateRule]],
    city: ['', [Validators.required, Validators.maxLength(80)]],
  });

  protected readonly details = this.fb.group({
    about: ['', Validators.maxLength(ABOUT_MAX_LENGTH)],
    acceptTerms: [false, Validators.requiredTrue],
  });

  protected readonly strength = toSignal(
    this.general.controls.password.valueChanges.pipe(map(passwordStrength)),
    { initialValue: passwordStrength('') },
  );
  protected readonly aboutLength = toSignal(
    this.details.controls.about.valueChanges.pipe(map((value) => value.length)),
    { initialValue: 0 },
  );

  constructor() {
    effect(() => {
      const method = this.pending() ? 'disable' : 'enable';
      this.general[method]({ emitEvent: false });
      this.details[method]({ emitEvent: false });
    });

    effect(() => {
      if (this.errorMessage()) this.errorAlert()?.nativeElement.focus();
    });

    // E-mail já usado (409) pertence à etapa 1: volta para lá com o erro visível.
    effect(() => {
      const message = this.errorMessage();
      if (message && /e-mail/i.test(message)) this.step.set(1);
    });

    inject(DestroyRef).onDestroy(() => this.revokePhotoUrl());
  }

  protected next(): void {
    if (this.general.invalid) {
      this.general.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }
    this.goTo(2);
  }

  protected back(): void {
    this.goTo(1);
  }

  protected onPhoto(files: FileList | null): void {
    const file = files?.[0];
    if (!file) return;

    const error = photoError(file);
    if (error) {
      this.photoMessage.set(error);
      return;
    }
    this.revokePhotoUrl();
    this.photo.set(file);
    this.photoUrl.set(URL.createObjectURL(file));
    this.photoMessage.set(null);
  }

  protected removePhoto(): void {
    this.revokePhotoUrl();
    this.photo.set(null);
    this.photoUrl.set(null);
  }

  protected submit(): void {
    if (this.pending()) return;
    if (this.step() === 1) return this.next();

    if (this.details.invalid) {
      this.details.markAllAsTouched();
      return;
    }

    const general = this.general.getRawValue();
    const details = this.details.getRawValue();
    this.submitted.emit({
      data: {
        firstName: general.firstName.trim(),
        lastName: general.lastName.trim(),
        email: general.email.trim(),
        password: general.password,
        birthDate: general.birthDate,
        gender: general.gender as Gender,
        relationship: general.relationship as Relationship,
        city: general.city.trim(),
        about: details.about.trim(),
        acceptTerms: true,
      },
      photo: this.photo(),
    });
  }

  /** Troca de etapa e leva o foco ao início dela (leitores de tela anunciam). */
  private goTo(step: Step): void {
    this.step.set(step);
    afterNextRender(
      () => {
        const target = step === 1 ? this.firstInput() : this.stepTwoTitle();
        target?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  private focusFirstInvalid(): void {
    const host = this.firstInput()?.nativeElement.closest('form');
    const invalid = host?.querySelector<HTMLElement>(
      '.ng-invalid input, .ng-invalid mat-select, input.ng-invalid',
    );
    invalid?.focus();
  }

  private revokePhotoUrl(): void {
    const url = this.photoUrl();
    if (url) URL.revokeObjectURL(url);
  }
}
