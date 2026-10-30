import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { endOfDay, startOfDay } from '../../utils/date.util';
import { requireUserId } from '../../utils/request';
import { CalendarEvent } from '../calendar/models/CalendarEvent';
import { Habit } from '../habits/models/Habit';
import { HabitLog } from '../habits/models/HabitLog';
import { PointLedger } from '../gamification/models/PointLedger';
import { Streak } from '../gamification/models/Streak';
import { Task } from '../tasks/models/Task';
import { Notification } from '../notifications/notifications.routes';

const router = Router();

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(todayStart);

    const [
      habitsTotal,
      habitsDone,
      tasksDone,
      pointsRows,
      streaks,
      upcomingEvents,
      unreadNotifications,
    ] = await Promise.all([
      Habit.countDocuments({ userId, active: true }),
      HabitLog.countDocuments({ userId, date: todayStart, status: 'completed' }),
      Task.countDocuments({ userId, date: { $gte: todayStart, $lte: todayEnd }, status: 'done' }),
      PointLedger.aggregate([
        { $match: { userId: new Types.ObjectId(userId) } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Streak.find({ userId }).sort({ current: -1 }).limit(5).populate('habitId', 'name'),
      CalendarEvent.find({ userId, date: { $gte: new Date() } }).sort({ date: 1 }).limit(5),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    res.json(
      successResponse({
        todayStats: {
          habitsDone,
          habitsTotal,
          tasksDone,
          points: pointsRows[0]?.total ?? 0,
        },
        streaks: streaks.map((streak) => ({
          habitName: (streak.habitId as any)?.name ?? 'Habit',
          current: streak.current,
        })),
        upcomingEvents,
        unreadNotifications,
      })
    );
  })
);

export default router;
