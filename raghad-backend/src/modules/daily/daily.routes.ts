import { Router } from 'express';
import { Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { parseDateInput, requireUserId } from '../../utils/request';
import * as service from './daily.service';

const router = Router();

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json(successResponse(await service.getDaily(requireUserId(req), parseDateInput(req.query.date))));
  })
);

router.get(
  '/end-of-day',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json(successResponse(await service.endOfDayEvaluation(requireUserId(req), parseDateInput(req.query.date))));
  })
);

export default router;
