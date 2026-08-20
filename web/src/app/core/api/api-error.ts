import { HttpErrorResponse } from '@angular/common/http';

export type ApiErrorKind = 'network' | 'unauthorized' | 'not-found' | 'server' | 'client';

/** Normalised transport error: every store and template reads this shape only. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly kind: ApiErrorKind;

  constructor(status: number, code: string, message: string, requestId: string | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.kind = ApiError.kindOf(status);
  }

  private static kindOf(status: number): ApiErrorKind {
    if (status === 0) return 'network';
    if (status === 401 || status === 403) return 'unauthorized';
    if (status === 404) return 'not-found';
    if (status >= 500) return 'server';
    return 'client';
  }

  get isNotFound(): boolean {
    return this.kind === 'not-found';
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; requestId?: string };
}

function readErrorBody(value: unknown): ApiErrorBody['error'] {
  if (typeof value !== 'object' || value === null) return undefined;
  const body = value as ApiErrorBody;
  return body.error;
}

export function toApiError(response: HttpErrorResponse): ApiError {
  const requestId = response.headers.get('x-request-id');

  if (response.status === 0) {
    return new ApiError(
      0,
      'network_error',
      'Could not reach the API. Make sure the mock server is running on port 4000.',
      requestId,
    );
  }

  const body = readErrorBody(response.error);
  return new ApiError(
    response.status,
    body?.code ?? `http_${response.status}`,
    body?.message ?? `The request failed with status ${response.status}.`,
    body?.requestId ?? requestId,
  );
}

export function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof HttpErrorResponse) return toApiError(error);
  const message = error instanceof Error ? error.message : 'Unexpected error.';
  return new ApiError(0, 'unknown_error', message, null);
}
