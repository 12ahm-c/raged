import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { successResponse } from '../../utils/apiResponse';
import { requireUserId } from '../../utils/request';
import * as service from './services/gamification.service';

export async function points(req: AuthenticatedRequest, res: Response): Promise<void> {
  const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined;
  const to = typeof req.query.to === 'string' ? new Date(req.query.to) : undefined;
  const reason = typeof req.query.reason === 'string' ? req.query.reason : undefined;
  const result = await service.getPoints(requireUserId(req), from, to, reason);
  res.json(
    successResponse(
      {
        total: result.total,
        totalEarned: result.totalEarned,
        totalLost: result.totalLost,
        net: result.net,
        entries: result.entries,
      },
      { page: 1, limit: result.entries.length, total: result.entries.length }
    )
  );
}

export async function streaks(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json(successResponse(await service.getStreaks(requireUserId(req))));
}

export async function stats(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json(successResponse(await service.getStats(requireUserId(req))));
}

export async function levels(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json(successResponse(await service.getLevels(requireUserId(req))));
}
