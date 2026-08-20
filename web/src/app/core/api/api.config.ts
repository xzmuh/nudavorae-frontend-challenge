import { InjectionToken } from '@angular/core';

/** Base URL of the mock API. Overridable through the DI token in tests. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:4000',
});

/**
 * Authentication is out of scope, so a single fixed token is attached by the
 * HTTP interceptor to every API call -- including the private image requests.
 */
export const FIXED_API_TOKEN = 'svc_demo_fixed_token_2026';
