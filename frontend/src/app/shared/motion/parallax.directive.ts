import { DOCUMENT } from '@angular/common';
import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { allowsPointerMotion } from './motion-preferences';

/**
 * Parallax suave seguindo o cursor (Motion spec · item 02). Publica a posição
 * normalizada do ponteiro (-1 → 1) em `--parallax-x/--parallax-y`; cada camada
 * decide sua profundidade via CSS.
 */
@Directive({ selector: '[okParallax]' })
export class ParallaxDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly window = inject(DOCUMENT).defaultView;
  private frame = 0;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      if (!this.window || !allowsPointerMotion(this.window)) return;

      const win = this.window;
      const onMove = (event: PointerEvent) => {
        cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(() => {
          const x = (event.clientX / win.innerWidth) * 2 - 1;
          const y = (event.clientY / win.innerHeight) * 2 - 1;
          this.element.style.setProperty('--parallax-x', x.toFixed(3));
          this.element.style.setProperty('--parallax-y', y.toFixed(3));
        });
      };

      win.addEventListener('pointermove', onMove, { passive: true });
      destroyRef.onDestroy(() => {
        win.removeEventListener('pointermove', onMove);
        cancelAnimationFrame(this.frame);
      });
    });
  }
}
