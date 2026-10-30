import { Router, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../middlewares/error.middleware';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { endOfDay, startOfDay } from '../../utils/date.util';
import { pageOptions, requireUserId } from '../../utils/request';
import { CalendarEvent } from './models/CalendarEvent';
import { Task } from '../tasks/models/Task';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const body = z.object({
  title: z.string().min(1),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  endDate: z.string().datetime().nullable().optional(),
  type: z.enum(['task', 'habit', 'project', 'goal', 'reminder', 'custom']).default('custom'),
  refId: objectId.nullable().optional(),
  projectId: objectId.nullable().optional(),
  note: z.string().optional(),
});

function normalize(input: Record<string, any>): Record<string, unknown> {
  return {
    ...input,
    date: new Date(input.date),
    endDate: input.endDate ? new Date(input.endDate) : null,
  };
}

const router = Router();
router.use(authMiddleware);

router.post('/events', validate(z.object({ body })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json(successResponse(await CalendarEvent.create({ ...normalize(req.body), userId: requireUserId(req) })));
}));
router.get('/events', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filter: Record<string, unknown> = { userId: requireUserId(req) };
  if (typeof req.query.from === 'string' || typeof req.query.to === 'string') {
    filter.date = {
      ...(typeof req.query.from === 'string' ? { $gte: startOfDay(new Date(req.query.from)) } : {}),
      ...(typeof req.query.to === 'string' ? { $lte: endOfDay(new Date(req.query.to)) } : {}),
    };
  }
  if (typeof req.query.type === 'string') filter.type = req.query.type;
  if (typeof req.query.projectId === 'string') filter.projectId = req.query.projectId;
  const { page, limit, skip } = pageOptions(req.query);
  const [items, total] = await Promise.all([
    CalendarEvent.find(filter).sort({ date: 1 }).skip(skip).limit(limit),
    CalendarEvent.countDocuments(filter),
  ]);
  res.json(successResponse({ items, meta: { page, limit, total } }));
}));
router.get('/main', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const from = typeof req.query.from === 'string' ? startOfDay(new Date(req.query.from)) : startOfDay(new Date());
  const to = typeof req.query.to === 'string' ? endOfDay(new Date(req.query.to)) : endOfDay(new Date());
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : null;
  const now = new Date();

  // الروزنامة تعرض الأحداث + مهام المشاريع (المهام المرتبطة بمشروع أو بعنصر منه)
  // وفق التاريخ المطلوب؛ ومع تحديد مشروع فتصبح "روزنامة المشروع".
  const [events, tasks] = await Promise.all([
    CalendarEvent.find({ userId, date: { $gte: from, $lte: to }, ...(projectId ? { projectId } : {}) }).sort({ date: 1 }),
    Task.find({ userId, date: { $gte: from, $lte: to }, ...(projectId ? { projectId } : {}) }).sort({ date: 1 }),
  ]);

  const entries = [
    ...events.map((event) => ({ ...event.toObject(), source: 'event' as const })),
    ...tasks.map((task) => ({
      _id: task._id,
      title: task.title,
      date: task.date,
      endDate: null,
      type: 'task' as const,
      refId: task.nodeId ?? null,
      projectId: task.projectId ?? null,
      note: task.description ?? null,
      status: task.status,
      source: 'task' as const,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  res.json(successResponse({
    past: entries.filter((entry) => entry.date < now),
    upcoming: entries.filter((entry) => entry.date >= now),
  }));
}));
router.get('/events/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const event = await CalendarEvent.findOne({ _id: req.params.id, userId: requireUserId(req) });
  if (!event) throw new AppError('NOT_FOUND', 404, 'Calendar event not found');
  res.json(successResponse(event));
}));
router.put('/events/:id', validate(z.object({ params: z.object({ id: objectId }), body: body.partial() })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const event = await CalendarEvent.findOneAndUpdate({ _id: req.params.id, userId: requireUserId(req) }, normalize(req.body), { new: true, runValidators: true });
  if (!event) throw new AppError('NOT_FOUND', 404, 'Calendar event not found');
  res.json(successResponse(event));
}));
router.delete('/events/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const event = await CalendarEvent.findOneAndDelete({ _id: req.params.id, userId: requireUserId(req) });
  if (!event) throw new AppError('NOT_FOUND', 404, 'Calendar event not found');
  res.status(204).send();
}));

export default router;
