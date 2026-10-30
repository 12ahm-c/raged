import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireUserId } from '../../utils/request';
import { createTaskSchema, taskIdSchema, updateTaskSchema, updateTaskStatusSchema } from './dtos/task.dto';
import * as service from './task.service';

const router = Router();
router.use(authMiddleware);

router.post('/', validate(createTaskSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json(successResponse(await service.createTask(requireUserId(req), req.body)));
}));
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await service.listTasks(requireUserId(req), req.query)));
}));
router.get('/:id', validate(taskIdSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await service.getTask(requireUserId(req), req.params.id)));
}));
router.put('/:id', validate(updateTaskSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await service.updateTask(requireUserId(req), req.params.id, req.body)));
}));
router.delete('/:id', validate(taskIdSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await service.deleteTask(requireUserId(req), req.params.id);
  res.status(204).send();
}));
router.patch('/:id/status', validate(updateTaskStatusSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await service.updateTaskStatus(requireUserId(req), req.params.id, req.body.status)));
}));

export default router;
