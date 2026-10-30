import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/apiResponse';
import { ZodError } from 'zod';
import { RequestWithId, logError } from './requestLogger.middleware';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const requestId = (req as RequestWithId).requestId ?? 'unknown';
  logError(requestId, err, { path: req.originalUrl, method: req.method });

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    err.errors.forEach((e) => {
      const path = e.path.join('.');
      fields[path] = e.message;
    });
    res.status(400).json(errorResponse('VALIDATION_ERROR', 'بيانات غير صالحة', fields));
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.code, err.message, err.fields));
    return;
  }

  res.status(500).json(errorResponse('INTERNAL', 'خطأ داخلي في الخادم'));
};

export const notFoundMiddleware = (_req: Request, res: Response): void => {
  res.status(404).json(errorResponse('NOT_FOUND', 'المورد غير موجود'));
};
