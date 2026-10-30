import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  dailyResetJob,
  dailySummaryJob,
  endOfDayJob,
  reminderJob,
  seasonalActivationJob,
} from '../../jobs/notification.jobs';

const router = Router();
router.use(authMiddleware);

router.post('/reminders/run', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await reminderJob()));
}));
router.post('/daily-reset/run', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await dailyResetJob()));
}));
router.post('/end-of-day/run', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await endOfDayJob()));
}));
router.post('/daily-summary/run', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await dailySummaryJob()));
}));
router.post('/seasonal-activation/run', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await seasonalActivationJob()));
}));

export default router;
