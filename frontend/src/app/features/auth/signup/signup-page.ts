import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import type { SignupData } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import { SocialStore } from '../../../core/social/social.store';
import { BrandLogo } from '../../../shared/ui/brand-logo/brand-logo';
import { SignupForm } from './components/signup-form/signup-form';
import { SignupScene } from './components/signup-scene/signup-scene';

/**
 * Página "Criar conta" (container): envia o cadastro e, com a sessão já criada
 * pela API, segue direto para a Home.
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
  private readonly store = inject(SocialStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  private photoUrl: string | null = null;

  protected onPhoto(url: string): void {
    this.photoUrl = url;
  }

  protected onSubmit(data: SignupData): void {
    this.pending.set(true);
    this.errorMessage.set(null);

    this.auth
      .signup(data)
      .pipe(
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.store.updateProfile({
            firstName: data.firstName,
            lastName: data.lastName,
            ...(data.gender ? { gender: data.gender } : {}),
            ...(data.birthDate ? { birthday: data.birthDate } : {}),
            ...(this.photoUrl ? { photoUrl: this.photoUrl } : {}),
          });
          void this.router.navigateByUrl('/home');
        },
        error: (error: unknown) => this.errorMessage.set(toApiError(error).message),
      });
  }
}
