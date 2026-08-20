import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL, FIXED_API_TOKEN } from './api.config';
import { asApiError } from './api-error';

/**
 * Attaches the fixed bearer token to every request aimed at the API.
 * This is what makes the private images work: `<img>` cannot send headers, so
 * images are fetched through HttpClient and go through this interceptor too.
 */
export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const baseUrl = inject(API_BASE_URL);
  if (!request.url.startsWith(baseUrl)) return next(request);

  return next(
    request.clone({
      setHeaders: { Authorization: `Bearer ${FIXED_API_TOKEN}` },
    }),
  );
};

/** Turns every transport failure into the app's own `ApiError`. */
export const errorNormalizationInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(catchError((error: unknown) => throwError(() => asApiError(error))));
