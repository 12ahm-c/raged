import { Router, Response } from 'express';
import { z } from 'zod';
import { config } from '../../config';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { startOfDay } from '../../utils/date.util';
import { requireUserId } from '../../utils/request';
import { Habit } from '../habits/models/Habit';
import { HabitLog } from '../habits/models/HabitLog';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const router = Router();

router.use(authMiddleware);

router.get(
  '/status',
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json(
      successResponse({
        // Web Push (PWA): يعتمد على مفاتيح VAPID في بيئة الخادم.
        fcm: config.vapidPublicKey && config.vapidPrivateKey ? 'ok' : 'not_configured',
        huggingface: config.hfApiKey ? 'ok' : 'not_configured',
        maps: config.mapsApiKey ? 'ok' : 'not_configured',
        storage: config.storagePublicBaseUrl ? 'ok' : 'not_configured',
      })
    );
  })
);

router.post(
  '/maps/route',
  validate(
    z.object({
      body: z.object({
        habitId: objectId,
        date: z.string().optional(),
        distanceKm: z.number().min(0),
        route: z
          .array(
            z.object({
              lat: z.number().min(-90).max(90),
              lng: z.number().min(-180).max(180),
            })
          )
          .min(1)
          .max(1000),
      }),
    })
  ),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const habit = await Habit.findOne({ _id: req.body.habitId, userId, active: true });
    if (!habit) throw new AppError('NOT_FOUND', 404, 'Habit not found');

    const date = startOfDay(req.body.date ? new Date(req.body.date) : new Date());
    const log = await HabitLog.findOneAndUpdate(
      { userId, habitId: habit._id, date },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          metadata: {
            distanceKm: req.body.distanceKm,
            route: req.body.route,
          },
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(201).json(successResponse(log));
  })
);

export default router;
