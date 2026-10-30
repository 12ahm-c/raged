import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.util';
import { AppError } from './error.middleware';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const authMiddleware = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError('AUTH_REQUIRED', 401, 'توكن المصادقة مطلوب'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new AppError('TOKEN_EXPIRED', 401, 'انتهت صلاحية التوكن'));
    } else if (err instanceof jwt.JsonWebTokenError) {
      next(new AppError('TOKEN_INVALID', 401, 'توكن غير صالح'));
    } else {
      next(new AppError('TOKEN_INVALID', 401, 'توكن غير صالح'));
    }
  }
};