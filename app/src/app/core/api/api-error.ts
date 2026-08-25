import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorDto } from './contract';

/**
 * A failure the UI can actually say something about.
 *
 * RF5: "if the request fails the screen returns to the truth and says what
 * happened" — so the server's own `message` is what reaches the screen, not a
 * generic apology. The scoring sheet reads whether the failure "says what
 * happened".
 */
export interface ApiError {
  /** 0 when the request never reached the marketplace. */
  readonly status: number;
  readonly code: string;
  readonly message: string;
}

function hasErrorBody(value: unknown): value is ApiErrorDto {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value as { error: unknown };
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

export function toApiError(cause: unknown): ApiError {
  if (cause instanceof HttpErrorResponse) {
    if (hasErrorBody(cause.error)) {
      return { status: cause.status, code: cause.error.error.code, message: cause.error.error.message };
    }
    if (cause.status === 0) {
      return {
        status: 0,
        code: 'network_unreachable',
        message: 'The marketplace could not be reached. Check that the stub is running on port 4010.',
      };
    }
    return { status: cause.status, code: 'unexpected_response', message: cause.message };
  }

  return {
    status: 0,
    code: 'unexpected_error',
    message: cause instanceof Error ? cause.message : 'Something went wrong.',
  };
}
