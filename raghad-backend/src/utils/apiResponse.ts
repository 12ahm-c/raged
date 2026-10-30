export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: PaginationMeta | null;
}

export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export function successResponse<T>(data: T, meta?: PaginationMeta): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: meta ?? null,
  };
}

export function errorResponse(code: string, message: string, fields?: Record<string, string>): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error: { code, message, fields },
    meta: null,
  };
}