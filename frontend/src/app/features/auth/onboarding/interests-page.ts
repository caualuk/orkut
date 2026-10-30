import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { toApiError } from '../../../core/http/api-error';
import { BrandLogo } from '../../../shared/ui/brand-logo/brand-logo';
import type { OnboardingNavigationState } from '../signup/signup-page';
import { OnboardingApi } from './onboarding-api';

export const SUGGESTED_INTERESTS = [
  'Música',
  'Viagens',
  'Tecnologia',
  'Café',
  'Games',
  'Cinema',
  'Séries',
  'Livros',
  'Futebol',
  'Esportes',
  'Fotografia',
  'Culinária',
  'Arte',
  'Animais',
  'Moda',
  'Natureza',
];
export const MIN_INTERESTS = 3;
export const MAX_INTERESTS = 20;
const MAX_INTEREST_LENGTH = 30;

/**
 * Onboarding pós-cadastro (sessão já ativa): o usuário marca seus interesses,
 * que vão para o perfil. Pede ao menos 3, mas dá para pular e escolher depois
 * em "Editar perfil".
 */
@Component({
  selector: 'ok-interests-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandLogo, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './interests-page.html',
  styleUrl: './interests-page.css',
})
export class InterestsPage {
  private readonly auth = inject(AuthService);
  private readonly api = inject(OnboardingApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly min = MIN_INTERESTS;
  protected readonly max = MAX_INTERESTS;
  protected readonly maxLength = MAX_INTEREST_LENGTH;

  protected readonly firstName = computed(() => this.auth.user()?.displayName.split(' ')[0] ?? '');
  /** A foto da etapa 2 não subiu (o cadastro em si deu certo). */
  protected readonly photoFailed = Boolean(
    (this.router.currentNavigation()?.extras.state as OnboardingNavigationState | undefined)
      ?.photoFailed ?? (history.state as OnboardingNavigationState | null)?.photoFailed,
  );

  protected readonly options = signal<string[]>([...SUGGESTED_INTERESTS]);
  protected readonly selected = signal<string[]>([]);
  protected readonly draft = signal('');
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly canContinue = computed(
    () => this.selected().length >= MIN_INTERESTS && !this.saving(),
  );
  protected readonly remaining = computed(() =>
    Math.max(0, MIN_INTERESTS - this.selected().length),
  );

  protected isSelected(interest: string): boolean {
    return this.selected().includes(interest);
  }

  protected toggle(interest: string): void {
    this.selected.update((list) => {
      if (list.includes(interest)) return list.filter((item) => item !== interest);
      return list.length < MAX_INTERESTS ? [...list, interest] : list;
    });
  }

  /** Interesse livre: entra na lista já marcado (sem duplicar, ignorando caixa). */
  protected addCustom(): void {
    const value = this.draft().trim().replace(/\s+/g, ' ').slice(0, MAX_INTEREST_LENGTH);
    this.draft.set('');
    if (!value) return;

    const existing = this.options().find((item) => item.toLowerCase() === value.toLowerCase());
    if (!existing) this.options.update((list) => [...list, value]);
    const interest = existing ?? value;
    if (!this.isSelected(interest)) this.toggle(interest);
  }

  protected save(): void {
    if (!this.canContinue()) return;
    this.saving.set(true);
    this.errorMessage.set(null);

    this.api
      .saveInterests(this.selected())
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl('/home'),
        error: (error: unknown) => this.errorMessage.set(toApiError(error).message),
      });
  }

  protected skip(): void {
    void this.router.navigateByUrl('/home');
  }
}
