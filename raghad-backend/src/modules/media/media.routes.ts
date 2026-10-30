import { Router, Response } from 'express';
import mongoose, { Document, Schema, Types } from 'mongoose';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { endOfDay, startOfDay } from '../../utils/date.util';
import { pageOptions, requireUserId } from '../../utils/request';

type MediaKind = 'program' | 'journal' | 'beek_idea';

interface IMediaItem extends Document {
  userId: Types.ObjectId;
  kind: MediaKind;
  title: string;
  body: string;
  projectId?: Types.ObjectId | null;
  watchedAt?: Date | null;
  tags: string[];
  createdAt: Date;
}

const mediaItemSchema = new Schema<IMediaItem>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['program', 'journal', 'beek_idea'], required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    watchedAt: { type: Date, default: null },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);
mediaItemSchema.index({ userId: 1, kind: 1, createdAt: -1 });
mediaItemSchema.index({ userId: 1, projectId: 1 });

export const MediaItem = mongoose.model<IMediaItem>('MediaItem', mediaItemSchema);
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const body = z.object({
  kind: z.enum(['program', 'journal', 'beek_idea']),
  title: z.string().min(1),
  body: z.string().min(1),
  projectId: objectId.nullable().optional(),
  tags: z.array(z.string()).default([]),
});

const router = Router();
router.use(authMiddleware);

router.get('/items', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filter: Record<string, unknown> = { userId: requireUserId(req) };
  if (typeof req.query.kind === 'string') filter.kind = req.query.kind;
  if (typeof req.query.projectId === 'string') filter.projectId = req.query.projectId;
  if (typeof req.query.from === 'string' || typeof req.query.to === 'string') {
    filter.createdAt = {
      ...(typeof req.query.from === 'string' ? { $gte: startOfDay(new Date(req.query.from)) } : {}),
      ...(typeof req.query.to === 'string' ? { $lte: endOfDay(new Date(req.query.to)) } : {}),
    };
  }
  const { page, limit, skip } = pageOptions(req.query);
  const [items, total] = await Promise.all([
    MediaItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    MediaItem.countDocuments(filter),
  ]);
  res.json(successResponse({ items, meta: { page, limit, total } }));
}));

router.post('/items', validate(z.object({ body })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json(successResponse(await MediaItem.create({ ...req.body, userId: requireUserId(req) })));
}));

router.get('/items/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const item = await MediaItem.findOne({ _id: req.params.id, userId: requireUserId(req) });
  if (!item) throw new AppError('NOT_FOUND', 404, 'Media item not found');
  res.json(successResponse(item));
}));

router.put('/items/:id', validate(z.object({ params: z.object({ id: objectId }), body: body.partial() })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const item = await MediaItem.findOneAndUpdate({ _id: req.params.id, userId: requireUserId(req) }, req.body, { new: true, runValidators: true });
  if (!item) throw new AppError('NOT_FOUND', 404, 'Media item not found');
  res.json(successResponse(item));
}));

router.delete('/items/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const item = await MediaItem.findOneAndDelete({ _id: req.params.id, userId: requireUserId(req) });
  if (!item) throw new AppError('NOT_FOUND', 404, 'Media item not found');
  res.status(204).send();
}));

router.post('/items/:id/watch', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const item = await MediaItem.findOne({ _id: req.params.id, userId: requireUserId(req) });
  if (!item) throw new AppError('NOT_FOUND', 404, 'Media item not found');
  if (item.kind !== 'program') throw new AppError('VALIDATION_ERROR', 400, 'Only program items can be watched');
  item.watchedAt = new Date();
  await item.save();
  res.json(successResponse(item));
}));

export default router;
