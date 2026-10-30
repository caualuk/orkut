import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, finalize, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import { BrandLogo } from '../../../shared/ui/brand-logo/brand-logo';
import { OnboardingApi } from '../onboarding/onboarding-api';
import { SignupForm, type SignupSubmission } from './components/signup-form/signup-form';
import { SignupScene } from './components/signup-scene/signup-scene';

/** Estado de navegação entregue à tela de interesses. */
export interface OnboardingNavigationState {
  photoFailed?: boolean;
}

/**
 * Página "Criar conta" (container). Cria a conta (a API já devolve a sessão),
 * envia a foto escolhida na etapa 2 e segue para a escolha de interesses.
 * Uma falha só na foto não desfaz o cadastro: a tela seguinte avisa.
 */
@Component({
  selector: 'ok-signup-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandLogo, SignupForm, SignupScene],
  templateUrl: './signup-page.html',
  styleUrl: './signup-page.css',
})
export class SignupPage {
  private readonly auth = inject(AuthService);
  private readonly onboarding = inject(OnboardingApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected onSubmit({ data, photo }: SignupSubmission): void {
    this.pending.set(true);
    this.errorMessage.set(null);

    this.auth
      .signup(data)
      .pipe(
        switchMap(() =>
          photo
            ? this.onboarding.uploadPhoto(photo).pipe(
                map(() => false),
                catchError(() => of(true)),
              )
            : of(false),
        ),
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (photoFailed) => {
          const state: OnboardingNavigationState = { photoFailed };
          void this.router.navigateByUrl('/boas-vindas', { state });
        },
        error: (error: unknown) => this.errorMessage.set(toApiError(error).message),
      });
  }
}
