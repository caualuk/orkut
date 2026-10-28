import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Login → Home com Smart Animate (Motion spec · 07).
      withViewTransitions({ skipInitialTransition: true }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    // CSRF é tratado no backend (cookie SameSite=Strict + verificação de Origin).
    provideHttpClient(withFetch()),
    // Material Symbols como fonte de ligadura: o nome do ícone vem de `fontIcon`
    // (via CSS), sem texto no DOM que conflite com rótulos acessíveis.
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass(
        'material-symbols-rounded',
        'mat-ligature-font',
      );
    }),
  ],
};
