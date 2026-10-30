import { Router, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../middlewares/error.middleware';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireUserId } from '../../utils/request';
import { Goal } from './models/Goal';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const body = z.object({
  title: z.string().min(1),
  scope: z.enum(['global', 'project']).default('global'),
  projectId: objectId.nullable().optional(),
  target: z.number().min(0),
  current: z.number().min(0).default(0),
  deadline: z.string().datetime().nullable().optional(),
  status: z.enum(['active', 'achieved', 'paused']).default('active'),
});

function progressPercent(goal: any): number {
  return goal.target ? Math.min(Math.round((goal.current / goal.target) * 100), 100) : 0;
}

const router = Router();
router.use(authMiddleware);

router.post('/', validate(z.object({ body })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json(successResponse(await Goal.create({ ...req.body, userId: requireUserId(req) })));
}));
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filter: Record<string, unknown> = { userId: requireUserId(req) };
  if (typeof req.query.scope === 'string') filter.scope = req.query.scope;
  if (typeof req.query.projectId === 'string') filter.projectId = req.query.projectId;
  if (typeof req.query.status === 'string') filter.status = req.query.status;
  res.json(successResponse(await Goal.find(filter).sort({ createdAt: -1 })));
}));
router.get('/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const goal = await Goal.findOne({ _id: req.params.id, userId: requireUserId(req) });
  if (!goal) throw new AppError('NOT_FOUND', 404, 'Goal not found');
  res.json(successResponse({ goal, progressPercent: progressPercent(goal) }));
}));
router.put('/:id', validate(z.object({ params: z.object({ id: objectId }), body: body.partial() })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const goal = await Goal.findOneAndUpdate({ _id: req.params.id, userId: requireUserId(req) }, req.body, { new: true, runValidators: true });
  if (!goal) throw new AppError('NOT_FOUND', 404, 'Goal not found');
  res.json(successResponse(goal));
}));
router.delete('/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const goal = await Goal.findOneAndDelete({ _id: req.params.id, userId: requireUserId(req) });
  if (!goal) throw new AppError('NOT_FOUND', 404, 'Goal not found');
  res.status(204).send();
}));

export default router;
