import { Types } from 'mongoose';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/error.middleware';
import { endOfDay, startOfDay } from './date.util';

export function requireUserId(req: AuthenticatedRequest): string {
  if (!req.user?.userId) {
    throw new AppError('AUTH_REQUIRED', 401, 'Authentication required');
  }
  return req.user.userId;
}

export function toObjectId(id: string, field = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError('VALIDATION_ERROR', 400, `Invalid ${field}`);
  }
  return new Types.ObjectId(id);
}

export function parseDateInput(value?: unknown): Date {
  if (!value || typeof value !== 'string') {
    return startOfDay(new Date());
  }
  return startOfDay(new Date(value));
}

export function dateRange(from?: unknown, to?: unknown): { $gte?: Date; $lte?: Date } | undefined {
  const range: { $gte?: Date; $lte?: Date } = {};
  if (typeof from === 'string') range.$gte = startOfDay(new Date(from));
  if (typeof to === 'string') range.$lte = endOfDay(new Date(to));
  return range.$gte || range.$lte ? range : undefined;
}

export function pageOptions(query: Record<string, unknown>): { page: number; limit: number; skip: number } {
  const page = Math.max(parseInt(String(query.page ?? '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? '50'), 10) || 50, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}
