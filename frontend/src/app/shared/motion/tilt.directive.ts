import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, inject, input, numberAttribute } from '@angular/core';
import { allowsPointerMotion } from './motion-preferences';

/**
 * Tilt 3D no hover (Motion spec · item 04): inclina o elemento até `okTiltMax`
 * graus e publica a posição do ponteiro em `--glare-x/--glare-y` para o brilho
 * especular. Escreve apenas variáveis CSS, sem disparar detecção de mudanças.
 */
@Directive({
  selector: '[okTilt]',
  host: {
    '(pointermove)': 'onPointerMove($event)',
    '(pointerleave)': 'reset()',
  },
})
export class TiltDirective {
  readonly okTiltMax = input(6, { transform: numberAttribute });

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly enabled = allowsPointerMotion(inject(DOCUMENT).defaultView);
  private frame = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.enabled) return;

    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const rect = this.element.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width; // 0 → 1
      const y = (event.clientY - rect.top) / rect.height;
      const max = this.okTiltMax();

      this.setVars({
        '--tilt-x': `${((0.5 - y) * 2 * max).toFixed(2)}deg`,
        '--tilt-y': `${((x - 0.5) * 2 * max).toFixed(2)}deg`,
        '--glare-x': `${(x * 100).toFixed(1)}%`,
        '--glare-y': `${(y * 100).toFixed(1)}%`,
        '--glare-opacity': '1',
      });
    });
  }

  protected reset(): void {
    cancelAnimationFrame(this.frame);
    this.setVars({ '--tilt-x': '0deg', '--tilt-y': '0deg', '--glare-opacity': '0' });
  }

  private setVars(vars: Record<string, string>): void {
    for (const [name, value] of Object.entries(vars)) {
      this.element.style.setProperty(name, value);
    }
  }
}
