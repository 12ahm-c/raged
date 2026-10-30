import { Router, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../middlewares/error.middleware';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { pageOptions, requireUserId } from '../../utils/request';
import { Project } from './models/Project';
import { ProjectNode } from './models/ProjectNode';
import { awardPoints } from '../gamification/services/gamification.service';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const projectBody = z.object({
  key: z.enum(['lb', 'supnum', 'basma_tech', 'competitions', 'messages_gaza', 'hasaniya', 'ai_depth']),
  name: z.string().min(1),
  structureType: z.enum(['notes_board', 'tree_cards', 'goals_pages', 'calendar_notes', 'level_game', 'card_sets']),
  description: z.string().optional(),
});
const nodeBody = z.object({
  parentId: objectId.nullable().optional(),
  type: z.enum(['file', 'board', 'column', 'card', 'leaf', 'note', 'goal', 'level']),
  title: z.string().min(1),
  order: z.number().int().default(0),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  data: z.record(z.unknown()).optional(),
});

const router = Router();
const nodeRouter = Router();
router.use(authMiddleware);
nodeRouter.use(authMiddleware);

router.post('/', validate(z.object({ body: projectBody })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json(successResponse(await Project.create({ ...req.body, userId: requireUserId(req) })));
}));

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, skip } = pageOptions(req.query);
  const userId = requireUserId(req);
  const [items, total] = await Promise.all([
    Project.find({ userId, active: true }).sort({ createdAt: 1 }).skip(skip).limit(limit),
    Project.countDocuments({ userId, active: true }),
  ]);
  res.json(successResponse({ items, meta: { page, limit, total } }));
}));

router.get('/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const project = await Project.findOne({ _id: req.params.id, userId });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  const [nodes, nodeCount] = await Promise.all([
    ProjectNode.find({ projectId: project._id, userId }).sort({ order: 1 }).limit(50),
    ProjectNode.countDocuments({ projectId: project._id, userId }),
  ]);
  res.json(successResponse({ project, nodes, stats: { nodeCount } }));
}));

router.put('/:id', validate(z.object({ params: z.object({ id: objectId }), body: projectBody.partial() })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findOneAndUpdate({ _id: req.params.id, userId: requireUserId(req) }, req.body, { new: true, runValidators: true });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  res.json(successResponse(project));
}));

router.delete('/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findOneAndUpdate({ _id: req.params.id, userId: requireUserId(req) }, { active: false });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  res.status(204).send();
}));

router.get('/:id/achievements', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const project = await Project.findOne({ _id: req.params.id, userId: requireUserId(req) });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  res.json(successResponse({ milestones: [], progress: project.progress }));
}));

router.post('/:id/nodes', validate(z.object({ params: z.object({ id: objectId }), body: nodeBody })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const project = await Project.findOne({ _id: req.params.id, userId });
  if (!project) throw new AppError('NOT_FOUND', 404, 'Project not found');
  res.status(201).json(successResponse(await ProjectNode.create({ ...req.body, userId, projectId: project._id })));
}));

router.get('/:id/nodes', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filter: Record<string, unknown> = { userId: requireUserId(req), projectId: req.params.id };
  if (typeof req.query.parentId === 'string') filter.parentId = req.query.parentId === 'null' ? null : req.query.parentId;
  if (typeof req.query.type === 'string') filter.type = req.query.type;
  if (typeof req.query.status === 'string') filter.status = req.query.status;
  res.json(successResponse(await ProjectNode.find(filter).sort({ order: 1 })));
}));

async function ensureLevelUnlocked(userId: string, nodeId: string): Promise<void> {
  const node = await ProjectNode.findOne({ _id: nodeId, userId });
  if (!node || node.type !== 'level') return;
  const project = await Project.findOne({ _id: node.projectId, userId });
  if (!project || project.structureType !== 'level_game') return;
  const previous = await ProjectNode.findOne({
    userId,
    projectId: node.projectId,
    type: 'level',
    order: { $lt: node.order },
    status: { $ne: 'done' },
  }).sort({ order: -1 });
  if (previous) throw new AppError('LEVEL_LOCKED', 409, 'Previous level must be completed first');
}

/**
 * عقوبة التأخير في مشروع رسائل من غزة:
 * عند إنهاء مستوى بعد انتهاء مدته يُخصم مبلغ العقوبة مرة واحدة،
 * وتُدمج مهام المستويات المتأخرة غير المنجزة ضمن عقوبة المستوى.
 */
async function applyGazaLatePenalty(
  userId: string,
  node: InstanceType<typeof ProjectNode>
): Promise<{ latePenalty?: number }> {
  if (node.type !== 'level') return {};
  const project = await Project.findOne({ _id: node.projectId, userId });
  if (!project || project.key !== 'messages_gaza') return {};

  const startValue = node.data?.startDate;
  const durationDays = node.data?.durationDays;
  if (typeof startValue !== 'string' || typeof durationDays !== 'number' || durationDays < 1) return {};

  const deadline = new Date(`${startValue.slice(0, 10)}T00:00:00.000Z`).getTime() + durationDays * 86400000;
  if (Date.now() <= deadline) return {};

  const penaltyAmount = typeof node.data?.penalty === 'number' ? node.data.penalty : 2;
  const awarded = await awardPoints({
    userId,
    date: new Date(),
    amount: -Math.abs(penaltyAmount),
    reason: 'penalty',
    refType: 'project',
    refId: project._id,
    actionKey: `project:${String(project._id)}:level:${String(node._id)}:late_penalty`,
    note: `تأخر إنهاء المستوى «${node.title}» عن مدته المحددة`,
  });
  return awarded !== 0 ? { latePenalty: awarded } : {};
}

nodeRouter.put('/:id', validate(z.object({ params: z.object({ id: objectId }), body: nodeBody.partial() })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (req.body.status === 'done' || req.body.status === 'in_progress') await ensureLevelUnlocked(requireUserId(req), req.params.id);
  const node = await ProjectNode.findOneAndUpdate({ _id: req.params.id, userId: requireUserId(req) }, req.body, { new: true, runValidators: true });
  if (!node) throw new AppError('NOT_FOUND', 404, 'Node not found');
  const penalty = req.body.status === 'done' ? await applyGazaLatePenalty(requireUserId(req), node) : {};
  res.json(successResponse({ ...node.toObject(), ...penalty }));
}));

nodeRouter.patch('/:id/status', validate(z.object({ params: z.object({ id: objectId }), body: z.object({ status: z.enum(['todo', 'in_progress', 'done']) }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await ensureLevelUnlocked(requireUserId(req), req.params.id);
  const node = await ProjectNode.findOneAndUpdate({ _id: req.params.id, userId: requireUserId(req) }, { status: req.body.status }, { new: true });
  if (!node) throw new AppError('NOT_FOUND', 404, 'Node not found');
  const penalty = req.body.status === 'done' ? await applyGazaLatePenalty(requireUserId(req), node) : {};
  res.json(successResponse({ ...node.toObject(), ...penalty }));
}));

nodeRouter.delete('/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const root = await ProjectNode.findOne({ _id: req.params.id, userId });
  if (!root) throw new AppError('NOT_FOUND', 404, 'Node not found');
  const queue = [root._id];
  const ids = [root._id];
  while (queue.length) {
    const parentId = queue.pop();
    const children = await ProjectNode.find({ userId, parentId }).select('_id');
    children.forEach((child) => {
      ids.push(child._id);
      queue.push(child._id);
    });
  }
  await ProjectNode.deleteMany({ _id: { $in: ids }, userId });
  res.status(204).send();
}));

export { nodeRouter };
export default router;
