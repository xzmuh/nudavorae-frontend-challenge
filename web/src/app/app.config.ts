import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import {
  authTokenInterceptor,
  errorNormalizationInterceptor,
} from './core/api/http.interceptors';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Scroll handling is owned by the catalog page: it restores the exact
      // offset of the cached list when you navigate back.
      withInMemoryScrolling({ scrollPositionRestoration: 'disabled' }),
    ),
    provideHttpClient(withInterceptors([authTokenInterceptor, errorNormalizationInterceptor])),
  ],
};
