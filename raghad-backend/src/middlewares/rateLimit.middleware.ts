import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config';

const isDevelopment = config.nodeEnv === 'development';

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 1000 : 200,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isDevelopment && req.path === '/health',
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 100 : 20,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many authentication attempts, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isDevelopment ? 60 : 30,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
});

export function conditionalRateLimiter(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith('/v1/auth')) {
    authRateLimiter(req, res, next);
  } else if (req.path.startsWith('/v1/integrations/maps/route')) {
    strictRateLimiter(req, res, next);
  } else {
    globalRateLimiter(req, res, next);
  }
}