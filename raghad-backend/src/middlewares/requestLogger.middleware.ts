import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export interface RequestWithId extends Request {
  requestId?: string;
}

const SENSITIVE_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/users/me',
  '/notifications/device-token',
  '/integrations/maps/route',
];

const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'refreshToken',
  'accessToken',
  'token',
  'authorization',
  'cookie',
  'jwt',
  'secret',
  'key',
  'firebaseServiceAccountJson',
  'hfApiKey',
  'mapsApiKey',
  'storageAccessKey',
  'storageSecretKey',
  'deviceToken',
  'fcmToken',
];

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return obj;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((s) => lowerKey.includes(s))) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      result[key] = sanitize(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function logJson(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload));
}

export function requestLogger(req: RequestWithId, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id']?.toString() ?? randomUUID();
  const startedAt = Date.now();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const isSensitivePath = SENSITIVE_PATHS.some((p) => req.originalUrl.startsWith(p));
  const safeBody = isSensitivePath ? { '[REDACTED]': 'sensitive endpoint' } : sanitize(req.body as Record<string, unknown>);
  const safeQuery = sanitize(req.query as Record<string, unknown>);

  res.on('finish', () => {
    logJson({
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      event: 'http_request',
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      ...(Object.keys(safeBody).length > 0 && { body: safeBody }),
      ...(Object.keys(safeQuery).length > 0 && { query: safeQuery }),
    });
  });

  next();
}

export function logError(requestId: string, err: Error, context?: Record<string, unknown>): void {
  logJson({
    level: 'error',
    event: 'error',
    requestId,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: (err as any).code,
      statusCode: (err as any).statusCode,
    },
    ...context,
  });
}
