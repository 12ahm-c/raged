import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { Response } from 'express';
import { successResponse } from '../../utils/apiResponse';
import * as authService from './services/auth.service';
import { AppError } from '../../middlewares/error.middleware';

export async function login(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.json(successResponse({ user: result.user, ...result.tokens }));
}

export async function register(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await authService.register(req.body);
  res.status(201).json(successResponse({ user: result.user, ...result.tokens }));
}

export async function refresh(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  const result = await authService.refresh(refreshToken);
  res.json(successResponse({ user: result.user, ...result.tokens }));
}

export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.user?.userId) {
    await authService.logout(req.user.userId, req.body?.refreshToken);
  }
  res.status(204).send();
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.userId) {
    throw new AppError('AUTH_REQUIRED', 401, 'توكن المصادقة مطلوب');
  }
  const user = await authService.getMe(req.user.userId);
  res.json(successResponse(user));
}

export async function updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.userId) {
    throw new AppError('AUTH_REQUIRED', 401, 'توكن المصادقة مطلوب');
  }
  const user = await authService.updateProfile(req.user.userId, req.body);
  res.json(successResponse(user));
}

export async function getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.userId) {
    throw new AppError('AUTH_REQUIRED', 401, 'توكن المصادقة مطلوب');
  }
  const settings = await authService.getSettings(req.user.userId);
  res.json(successResponse(settings));
}

export async function updateSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.userId) {
    throw new AppError('AUTH_REQUIRED', 401, 'توكن المصادقة مطلوب');
  }
  const settings = await authService.updateSettings(req.user.userId, req.body);
  res.json(successResponse(settings));
}
