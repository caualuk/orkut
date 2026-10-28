import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { BrandLogo } from '../brand-logo/brand-logo';

/**
 * Página genérica para telas ainda não implementadas e para o 404.
 * Título e descrição chegam pelo `data` da rota (withComponentInputBinding).
 */
@Component({
  selector: 'ok-coming-soon-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandLogo, MatButtonModule, RouterLink],
  template: `
    <main
      class="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center"
    >
      <ok-brand-logo [size]="40" />
      <h1 class="text-[28px] font-bold text-ink" data-testid="page-title">{{ heading() }}</h1>
      <p class="max-w-md text-sm text-ink-secondary">{{ description() }}</p>
      <a mat-flat-button routerLink="/login" data-testid="back-to-login">Voltar para o login</a>
    </main>
  `,
})
export class ComingSoonPage {
  readonly heading = input('Em breve');
  readonly description = input('Esta tela está em construção.');
}
