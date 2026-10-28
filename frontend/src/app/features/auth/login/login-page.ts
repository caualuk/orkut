import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import type { LoginCredentials } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { sanitizeReturnUrl } from '../../../core/auth/safe-redirect';
import { toApiError } from '../../../core/http/api-error';
import { BrandLogo } from '../../../shared/ui/brand-logo/brand-logo';
import { LoginForm } from './components/login-form/login-form';
import { LoginScene } from './components/login-scene/login-scene';

/**
 * Página de login (container): orquestra a autenticação e a navegação.
 * A apresentação fica em `LoginForm` (card) e `LoginScene` (cena 3D).
 */
@Component({
  selector: 'ok-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandLogo, LoginForm, LoginScene],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  /** Destino após o login, vindo de `?returnUrl=` (binding de rota). */
  readonly returnUrl = input<string>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected onSubmit(credentials: LoginCredentials): void {
    this.pending.set(true);
    this.errorMessage.set(null);

    this.auth
      .login(credentials)
      .pipe(
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl(sanitizeReturnUrl(this.returnUrl())),
        error: (error: unknown) => this.errorMessage.set(toApiError(error).message),
      });
  }
}
