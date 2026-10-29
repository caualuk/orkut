import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Logotipo "orkut" em gradiente rosa. Compartilha o nome de view-transition com
 * a Top App Bar (Motion spec · 07). Sem `size`, herda o font-size do contexto.
 */
@Component({
  selector: 'ok-brand-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-block font-bold leading-none tracking-[-0.02em] select-none',
    '[style.font-size.px]': 'size()',
    '[style.view-transition-name]': 'viewTransition() ? "brand-logo" : "none"',
  },
  template: `<span class="logo">orkut</span>`,
  styles: `
    .logo {
      background: linear-gradient(135deg, #f06292 0%, #c2185b 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
  `,
})
export class BrandLogo {
  readonly size = input<number>();
  /** Só um logo por página pode participar da transição (nomes devem ser únicos). */
  readonly viewTransition = input(true);
}
