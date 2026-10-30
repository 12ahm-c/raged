export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: ApiMeta | null;
}

export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  unreadCount?: number;
  [key: string]: unknown;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ApiMeta & { page: number; limit: number; total: number };
}

export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'DUPLICATE'
  | 'INVALID_STATE'
  | 'LEVEL_LOCKED'
  | 'UNPROCESSABLE'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'INTERNAL'
  | 'RATE_LIMIT_EXCEEDED';

export const ERROR_CODES: Record<ErrorCode, { http: number; message: string }> = {
  AUTH_REQUIRED: { http: 401, message: 'توكن المصادقة مطلوب' },
  TOKEN_EXPIRED: { http: 401, message: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً' },
  TOKEN_INVALID: { http: 401, message: 'جلسة غير صالحة' },
  FORBIDDEN: { http: 403, message: 'لا تملك صلاحية للوصول' },
  NOT_FOUND: { http: 404, message: 'المورد غير موجود' },
  VALIDATION_ERROR: { http: 400, message: 'بيانات غير صالحة' },
  DUPLICATE: { http: 409, message: 'هذا العنصر موجود بالفعل' },
  INVALID_STATE: { http: 409, message: 'العملية غير مسموحة في الحالة الحالية' },
  LEVEL_LOCKED: { http: 409, message: 'يجب إكمال المستوى السابق أولاً' },
  UNPROCESSABLE: { http: 422, message: 'عملية غير منطقية' },
  EXTERNAL_SERVICE_ERROR: { http: 502, message: 'فشل في الخدمة الخارجية' },
  INTERNAL: { http: 500, message: 'خطأ داخلي في الخادم' },
  RATE_LIMIT_EXCEEDED: { http: 429, message: 'كثير من الطلبات، يرجى المحاولة لاحقاً' },
};