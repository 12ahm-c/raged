import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import * as controller from './habit.controller';
import {
  createHabitLogSchema,
  createHabitSchema,
  habitIdSchema,
  habitLogIdSchema,
  seasonalScheduleSchema,
  updateHabitLogSchema,
  updateHabitSchema,
} from './dtos/habit.dto';

export const habitRoutes = Router();
export const habitLogRoutes = Router();

habitRoutes.use(authMiddleware);
habitRoutes.post('/', validate(createHabitSchema), asyncHandler(controller.createHabit));
habitRoutes.get('/', asyncHandler(controller.listHabits));
habitRoutes.get('/:id', validate(habitIdSchema), asyncHandler(controller.getHabit));
habitRoutes.put('/:id', validate(updateHabitSchema.merge(habitIdSchema)), asyncHandler(controller.updateHabit));
habitRoutes.delete('/:id', validate(habitIdSchema), asyncHandler(controller.deleteHabit));
habitRoutes.post(
  '/:id/seasonal-schedule',
  validate(seasonalScheduleSchema),
  asyncHandler(controller.addSeasonalSchedule)
);
habitRoutes.get('/:id/history', validate(habitIdSchema), asyncHandler(controller.habitHistory));

habitLogRoutes.use(authMiddleware);
habitLogRoutes.post('/', validate(createHabitLogSchema), asyncHandler(controller.createHabitLog));
habitLogRoutes.get('/', asyncHandler(controller.listHabitLogs));
habitLogRoutes.get('/:id', validate(habitLogIdSchema), asyncHandler(controller.getHabitLog));
habitLogRoutes.put('/:id', validate(updateHabitLogSchema), asyncHandler(controller.updateHabitLog));
habitLogRoutes.delete('/:id', validate(habitLogIdSchema), asyncHandler(controller.deleteHabitLog));
