import { ApiClientError } from '../api/client';
import { ERROR_CODES } from '../types/api';

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const knownCode = error.code as keyof typeof ERROR_CODES;
    return ERROR_CODES[knownCode]?.message ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'حدث خطأ غير متوقع. حاول مرة أخرى.';
}

export function getApiFieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiClientError ? error.fields ?? {} : {};
}
