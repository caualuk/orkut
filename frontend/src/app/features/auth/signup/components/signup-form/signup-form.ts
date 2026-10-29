import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
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
import type { Gender, SignupData } from '../../../../../core/auth/auth.models';
import { TiltDirective } from '../../../../../shared/motion/tilt.directive';
import { passwordStrength } from './password-strength';

export const MIN_SIGNUP_AGE = 13;

/** Mesma regra da API: 8+ caracteres, com letras e números. */
function passwordRule(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value ?? '';
  if (!value) return null;
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value)
    ? null
    : { passwordRule: true };
}

/** Nascimento opcional; se informado, exige idade mínima e data plausível. */
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

/** Card "Criar conta" (apresentação): valida e emite os dados do cadastro. */
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
  readonly submitted = output<SignupData>();
  /** Foto escolhida (prévia local; a página a aplica ao perfil após o cadastro). */
  readonly photoChosen = output<string>();

  protected readonly passwordVisible = signal(false);
  protected readonly photoUrl = signal<string | null>(null);
  protected readonly minAge = MIN_SIGNUP_AGE;
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly genders: { value: Gender; label: string }[] = [
    { value: 'feminino', label: 'Feminino' },
    { value: 'masculino', label: 'Masculino' },
    { value: 'outro', label: 'Outro' },
    { value: 'nao-informar', label: 'Prefiro não informar' },
  ];

  private readonly firstInput = viewChild.required<ElementRef<HTMLInputElement>>('firstInput');
  private readonly errorAlert = viewChild<ElementRef<HTMLElement>>('errorAlert');

  protected readonly form = inject(NonNullableFormBuilder).group({
    firstName: ['', [Validators.required, Validators.maxLength(40)]],
    lastName: ['', [Validators.required, Validators.maxLength(40)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(128), passwordRule]],
    birthDate: ['', birthDateRule],
    gender: [''],
    acceptTerms: [false, Validators.requiredTrue],
  });

  protected readonly strength = toSignal(
    this.form.controls.password.valueChanges.pipe(map(passwordStrength)),
    { initialValue: passwordStrength('') },
  );

  constructor() {
    effect(() => {
      if (this.pending()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    });

    effect(() => {
      if (this.errorMessage()) this.errorAlert()?.nativeElement.focus();
    });
  }

  protected onPhoto(files: FileList | null): void {
    const file = files?.[0];
    if (file && /^image\/(png|jpeg)$/.test(file.type) && file.size <= 5 * 1024 * 1024) {
      const url = URL.createObjectURL(file);
      this.photoUrl.set(url);
      this.photoChosen.emit(url);
    }
  }

  protected submit(): void {
    if (this.pending()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.controls.firstName.invalid) this.firstInput().nativeElement.focus();
      return;
    }

    const value = this.form.getRawValue();
    this.submitted.emit({
      firstName: value.firstName.trim(),
      lastName: value.lastName.trim(),
      email: value.email.trim(),
      password: value.password,
      birthDate: value.birthDate || null,
      gender: (value.gender || null) as Gender | null,
      acceptTerms: true,
    });
  }
}
