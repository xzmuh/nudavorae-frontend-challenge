import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { authInterceptor, leversInterceptor } from './core/api/interceptors';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // RF8: zoneless. There is no zone.js in the dependency tree or in the
    // polyfills, so nothing can quietly fall back to it.
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // RF6 restores the catalogue's exact offset from the store, after the
      // cached cards have rendered. The router must not also try, or the two
      // race and the loser wins.
      withInMemoryScrolling({ scrollPositionRestoration: 'disabled' }),
    ),
    provideHttpClient(withInterceptors([authInterceptor, leversInterceptor])),
  ],
};
