import { Router, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { startOfDay } from '../../utils/date.util';
import { requireUserId } from '../../utils/request';
import { Goal } from '../goals/models/Goal';
import { Habit } from '../habits/models/Habit';
import { HabitLog } from '../habits/models/HabitLog';
import { PointLedger } from '../gamification/models/PointLedger';
import { Project } from '../projects/models/Project';
import { ProjectNode } from '../projects/models/ProjectNode';
import { Streak } from '../gamification/models/Streak';
import { validate } from '../../middlewares/validate.middleware';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const router = Router();

router.use(authMiddleware);

router.get(
  '/overview',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const userObjectId = new Types.ObjectId(userId);
    const today = startOfDay(new Date());

    const [projects, activeHabits, completedToday, pointsRows, bestStreak, goalRows] = await Promise.all([
      Project.find({ userId, active: true }).select('_id name progress'),
      Habit.countDocuments({ userId, active: true }),
      HabitLog.countDocuments({ userId, date: today, status: 'completed' }),
      PointLedger.aggregate([
        { $match: { userId: userObjectId } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Streak.findOne({ userId }).sort({ current: -1 }).select('current'),
      Goal.aggregate([
        { $match: { userId: userObjectId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const goals = goalRows.reduce(
      (acc, row) => ({ ...acc, [row._id]: row.count }),
      { achieved: 0, active: 0 }
    );

    res.json(
      successResponse({
        projects: projects.map((project) => ({
          projectId: project._id.toString(),
          name: project.name,
          achievementPercent: project.progress,
        })),
        habits: {
          dailyCompletionPercent: activeHabits ? Math.round((completedToday / activeHabits) * 100) : 0,
          totalPoints: pointsRows[0]?.total ?? 0,
          activeStreakMax: bestStreak?.current ?? 0,
        },
        goals,
      })
    );
  })
);

router.get(
  '/projects/:id',
  validate(z.object({ params: z.object({ id: objectId }) })),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const project = await Project.findOne({ _id: req.params.id, userId });
    if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');

    const [goalRows, nodeRows, milestones] = await Promise.all([
      Goal.aggregate([
        { $match: { userId: new Types.ObjectId(userId), projectId: project._id } },
        {
          $group: {
            _id: null,
            target: { $sum: '$target' },
            current: { $sum: '$current' },
          },
        },
      ]),
      ProjectNode.aggregate([
        { $match: { userId: new Types.ObjectId(userId), projectId: project._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      ProjectNode.find({ userId, projectId: project._id, status: 'done' })
        .sort({ updatedAt: -1 })
        .limit(10)
        .select('title type status updatedAt'),
    ]);

    const goalTotals = goalRows[0];
    const goalAchievement = goalTotals?.target
      ? Math.min(Math.round((goalTotals.current / goalTotals.target) * 100), 100)
      : project.progress;
    const nodesProgress = Object.fromEntries(nodeRows.map((row) => [row._id, row.count]));

    res.json(successResponse({ goalAchievement, milestones, nodesProgress }));
  })
);

export default router;
