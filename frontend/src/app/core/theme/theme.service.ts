import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { SocialStore } from '../social/social.store';

/**
 * Aplica a aparência escolhida em Configurações (`claro`, `escuro` ou
 * `sistema`) como `data-theme` no <html>. Os tokens em `styles.css` fazem o resto.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly store = inject(SocialStore);
  private readonly systemDark = signal(false);

  constructor() {
    const media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    if (media) {
      this.systemDark.set(media.matches);
      const onChange = (event: MediaQueryListEvent) => this.systemDark.set(event.matches);
      media.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => media.removeEventListener('change', onChange));
    }

    effect(() => {
      const preference = this.store.settings().theme;
      const dark = preference === 'escuro' || (preference === 'sistema' && this.systemDark());
      this.document.documentElement.dataset['theme'] = dark ? 'dark' : 'light';
    });
  }
}
