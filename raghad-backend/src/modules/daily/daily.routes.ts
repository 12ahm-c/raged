import { Router, Response } from 'express';
import mongoose, { Document, Schema, Types } from 'mongoose';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { parseDateInput, requireUserId } from '../../utils/request';
import * as service from './daily.service';

interface IDailyPlan extends Document {
  userId: Types.ObjectId;
  date: Date;
  items: { kind: 'habit' | 'task'; id: string }[];
}

const dailyPlanSchema = new Schema<IDailyPlan>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true },
    items: {
      type: [{ kind: { type: String, enum: ['habit', 'task'], required: true }, id: { type: String, required: true } }],
      default: [],
    },
  },
  { timestamps: true }
);
dailyPlanSchema.index({ userId: 1, date: 1 }, { unique: true });

export const DailyPlan = mongoose.model<IDailyPlan>('DailyPlan', dailyPlanSchema);

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

router.get(
  '/plan',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const date = parseDateInput(req.query.date);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const plan = await DailyPlan.findOne({ userId, date: start });
    res.json(successResponse(plan ? plan.items : []));
  })
);

router.put(
  '/plan',
  validate(z.object({ body: z.object({ date: z.string(), items: z.array(z.object({ kind: z.enum(['habit', 'task']), id: z.string() })) }) })),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const date = parseDateInput(req.body.date);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const plan = await DailyPlan.findOneAndUpdate(
      { userId, date: start },
      { userId, date: start, items: req.body.items },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(successResponse(plan.items));
  })
);

export default router;