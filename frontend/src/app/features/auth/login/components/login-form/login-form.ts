import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRippleModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import type { LoginCredentials } from '../../../../../core/auth/auth.models';
import { TiltDirective } from '../../../../../shared/motion/tilt.directive';

/**
 * Card de login (componente de apresentação): valida o formulário e emite as
 * credenciais. Quem decide o que fazer com elas é a página (container).
 */
@Component({
  selector: 'ok-login-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRippleModule,
    TiltDirective,
  ],
  templateUrl: './login-form.html',
  styleUrl: './login-form.css',
})
export class LoginForm {
  readonly pending = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly submitted = output<LoginCredentials>();

  protected readonly passwordVisible = signal(false);

  private readonly emailInput = viewChild.required<ElementRef<HTMLInputElement>>('emailInput');
  private readonly errorAlert = viewChild<ElementRef<HTMLElement>>('errorAlert');

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(128)]],
    remember: [false],
  });

  constructor() {
    // Bloqueia o formulário durante o envio (evita duplo submit).
    effect(() => {
      if (this.pending()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    });

    // Leva o foco ao alerta de erro para que leitores de tela o anunciem.
    effect(() => {
      if (this.errorMessage()) this.errorAlert()?.nativeElement.focus();
    });
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected submit(): void {
    if (this.pending()) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (this.form.controls.email.invalid) this.emailInput().nativeElement.focus();
      return;
    }

    const { email, password, remember } = this.form.getRawValue();
    this.submitted.emit({ email: email.trim(), password, remember });
  }
}
