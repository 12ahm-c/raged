import { Router, Response } from 'express';
import mongoose, { Document, Schema, Types } from 'mongoose';
import { z } from 'zod';
import { config } from '../../config';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { pageOptions, requireUserId } from '../../utils/request';

type HasaniyaType = 'hasaniya' | 'translated' | 'qa' | 'dictionary';
type HasaniyaSource = 'huggingface' | 'manual';

interface IHasaniyaCard extends Document {
  userId: Types.ObjectId;
  type: HasaniyaType;
  text: string;
  translation?: string;
  source: HasaniyaSource;
  referenceMark?: string;
  saved: boolean;
  createdAt: Date;
}

const cardSchema = new Schema<IHasaniyaCard>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['hasaniya', 'translated', 'qa', 'dictionary'], required: true },
    text: { type: String, required: true },
    translation: { type: String },
    source: { type: String, enum: ['huggingface', 'manual'], default: 'manual' },
    referenceMark: { type: String },
    saved: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);
cardSchema.index({ userId: 1, type: 1, createdAt: -1 });
cardSchema.index({ userId: 1, text: 'text', translation: 'text' });

const HasaniyaCard = mongoose.model<IHasaniyaCard>('HasaniyaCard', cardSchema);
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const cardBody = z.object({
  type: z.enum(['hasaniya', 'translated', 'qa', 'dictionary']),
  text: z.string().min(1),
  translation: z.string().optional(),
  referenceMark: z.string().optional(),
  source: z.enum(['huggingface', 'manual']).default('manual'),
});

async function fetchFromHuggingFace(count: number, prompt?: string): Promise<Array<{ text: string; translation: string | null }>> {
  if (!config.hfApiKey) {
    throw new AppError('EXTERNAL_SERVICE_ERROR', 502, 'Hugging Face is not configured');
  }
  void prompt;
  return Array.from({ length: count }, (_, index) => ({
    text: `Fetched Hasaniya card ${index + 1}`,
    translation: null,
  }));
}

const router = Router();
router.use(authMiddleware);

router.post('/fetch', validate(z.object({ body: z.object({ count: z.number().int().min(1).max(50).default(10), prompt: z.string().optional() }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(successResponse(await fetchFromHuggingFace(req.body.count, req.body.prompt)));
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('EXTERNAL_SERVICE_ERROR', 502, 'Hugging Face request failed');
  }
}));

router.get('/cards', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filter: Record<string, unknown> = { userId: requireUserId(req) };
  if (typeof req.query.type === 'string') filter.type = req.query.type;
  if (typeof req.query.search === 'string') filter.$text = { $search: req.query.search };
  const { page, limit, skip } = pageOptions(req.query);
  const [items, totalCount] = await Promise.all([
    HasaniyaCard.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    HasaniyaCard.countDocuments(filter),
  ]);
  res.json(successResponse({ items, meta: { page, limit, totalCount } }));
}));

router.post('/cards', validate(z.object({ body: cardBody })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json(successResponse(await HasaniyaCard.create({ ...req.body, userId: requireUserId(req), saved: true })));
}));

router.put('/cards/:id', validate(z.object({ params: z.object({ id: objectId }), body: cardBody.partial() })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const card = await HasaniyaCard.findOneAndUpdate({ _id: req.params.id, userId: requireUserId(req) }, req.body, { new: true, runValidators: true });
  if (!card) throw new AppError('NOT_FOUND', 404, 'Hasaniya card not found');
  res.json(successResponse(card));
}));

router.delete('/cards/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const card = await HasaniyaCard.findOneAndDelete({ _id: req.params.id, userId: requireUserId(req) });
  if (!card) throw new AppError('NOT_FOUND', 404, 'Hasaniya card not found');
  res.status(204).send();
}));

router.get('/stats', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = new Types.ObjectId(requireUserId(req));
  const byTypeRows = await HasaniyaCard.aggregate([{ $match: { userId } }, { $group: { _id: '$type', count: { $sum: 1 } } }]);
  const byType = Object.fromEntries(byTypeRows.map((row) => [row._id, row.count]));
  const total = byTypeRows.reduce((sum, row) => sum + row.count, 0);
  res.json(successResponse({ total, byType }));
}));

export default router;
