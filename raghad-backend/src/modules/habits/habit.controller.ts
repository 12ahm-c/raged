import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { successResponse } from '../../utils/apiResponse';
import { requireUserId } from '../../utils/request';
import * as habitService from './services/habit.service';

export async function createHabit(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(201).json(successResponse(await habitService.createHabit(requireUserId(req), req.body)));
}

export async function listHabits(req: AuthenticatedRequest, res: Response): Promise<void> {
  const result = await habitService.listHabits(requireUserId(req), req.query);
  res.json(successResponse(result));
}

export async function getHabit(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json(successResponse(await habitService.getHabit(requireUserId(req), req.params.id)));
}

export async function updateHabit(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json(successResponse(await habitService.updateHabit(requireUserId(req), req.params.id, req.body)));
}

export async function deleteHabit(req: AuthenticatedRequest, res: Response): Promise<void> {
  await habitService.deleteHabit(requireUserId(req), req.params.id);
  res.status(204).send();
}

export async function addSeasonalSchedule(req: AuthenticatedRequest, res: Response): Promise<void> {
  res
    .status(201)
    .json(successResponse(await habitService.addSeasonalSchedule(requireUserId(req), req.params.id, req.body)));
}

export async function createHabitLog(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.status(201).json(successResponse(await habitService.createHabitLog(requireUserId(req), req.body)));
}

export async function listHabitLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json(successResponse(await habitService.listHabitLogs(requireUserId(req), req.query)));
}

export async function getHabitLog(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json(successResponse(await habitService.getHabitLog(requireUserId(req), req.params.id)));
}

export async function updateHabitLog(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json(successResponse(await habitService.updateHabitLog(requireUserId(req), req.params.id, req.body)));
}

export async function deleteHabitLog(req: AuthenticatedRequest, res: Response): Promise<void> {
  await habitService.deleteHabitLog(requireUserId(req), req.params.id);
  res.status(204).send();
}

export async function habitHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json(successResponse(await habitService.habitHistory(requireUserId(req), req.params.id)));
}
