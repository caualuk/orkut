import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { BrandLogo } from '../../shared/ui/brand-logo/brand-logo';

/**
 * Home autenticada (provisória). Valida o fluxo Login → Home e o logout até a
 * implementação da tela "Home · Desktop 1440".
 */
@Component({
  selector: 'ok-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandLogo, MatButtonModule, MatIconModule],
  template: `
    <header
      class="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-divider bg-white/80 px-6 backdrop-blur-md"
    >
      <ok-brand-logo [size]="28" />
      <button
        mat-stroked-button
        type="button"
        (click)="logout()"
        [disabled]="loggingOut()"
        data-testid="logout-button"
      >
        <mat-icon aria-hidden="true" fontIcon="logout" />
        Sair
      </button>
    </header>

    <main class="mx-auto max-w-[1248px] px-6 py-12">
      <h1 class="text-[28px] font-bold text-ink" data-testid="home-greeting">
        Olá, {{ auth.user()?.displayName }}!
      </h1>
      <p class="mt-2 text-sm text-ink-secondary">
        Você está conectado como <strong>{{ auth.user()?.email }}</strong
        >.
      </p>
    </main>
  `,
})
export class HomePage {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loggingOut = signal(false);

  protected logout(): void {
    this.loggingOut.set(true);
    this.auth
      .logout()
      .pipe(finalize(() => this.loggingOut.set(false)))
      .subscribe({
        // Mesmo se a API falhar, o estado local já foi limpo: volta ao login.
        complete: () => void this.router.navigateByUrl('/login'),
        error: () => void this.router.navigateByUrl('/login'),
      });
  }
}
