import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Título + subtítulo das telas internas no desktop. Abaixo de 1024px o título
 * vai para a Top App Bar, então aqui ele fica apenas para leitores de tela.
 * Ações (botões, filtros) entram por projeção à direita.
 */
@Component({
  selector: 'ok-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-wrap items-start justify-between gap-4 lg:px-1' },
  template: `
    <div class="max-lg:sr-only">
      <h1
        class="text-[30px] leading-tight font-bold tracking-[-0.01em] text-ink"
        data-testid="page-title"
      >
        {{ heading() }}
      </h1>
      @if (subtitle()) {
        <p class="mt-1 text-sm text-ink-secondary">{{ subtitle() }}</p>
      }
    </div>
    <ng-content />
  `,
})
export class PageHeader {
  readonly heading = input.required<string>();
  readonly subtitle = input('');
}
