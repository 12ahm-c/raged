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

interface IMoneyEntry extends Document {
  userId: Types.ObjectId;
  amount: number;
  source: string;
  note?: string;
  date: Date;
  createdAt: Date;
}

const moneyEntrySchema = new Schema<IMoneyEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    source: { type: String, required: true, trim: true },
    note: { type: String },
    date: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
moneyEntrySchema.index({ userId: 1, date: 1, source: 1 });

const MoneyEntry = mongoose.model<IMoneyEntry>('MoneyEntry', moneyEntrySchema);
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const body = z.object({
  amount: z.number(),
  source: z.string().min(1),
  note: z.string().optional(),
  date: z.string().optional(),
});

function addDateFilter(filter: Record<string, unknown>, query: Record<string, unknown>): void {
  if (typeof query.from === 'string' || typeof query.to === 'string') {
    filter.date = {
      ...(typeof query.from === 'string' ? { $gte: startOfDay(new Date(query.from)) } : {}),
      ...(typeof query.to === 'string' ? { $lte: endOfDay(new Date(query.to)) } : {}),
    };
  }
}

const router = Router();
router.use(authMiddleware);

router.post('/entries', validate(z.object({ body })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json(successResponse(await MoneyEntry.create({
    ...req.body,
    userId: requireUserId(req),
    date: req.body.date ? new Date(req.body.date) : new Date(),
  })));
}));

router.get('/entries', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filter: Record<string, unknown> = { userId: requireUserId(req) };
  if (typeof req.query.source === 'string') filter.source = req.query.source;
  addDateFilter(filter, req.query);
  const { page, limit, skip } = pageOptions(req.query);
  const [items, total, totals] = await Promise.all([
    MoneyEntry.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    MoneyEntry.countDocuments(filter),
    MoneyEntry.aggregate([{ $match: filter }, { $group: { _id: null, totalAmount: { $sum: '$amount' } } }]),
  ]);
  res.json(successResponse({ items, meta: { page, limit, total, totalAmount: totals[0]?.totalAmount ?? 0 } }));
}));

router.get('/summary', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = new Types.ObjectId(requireUserId(req));
  const [total, bySource, byMonth] = await Promise.all([
    MoneyEntry.aggregate([{ $match: { userId } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    MoneyEntry.aggregate([{ $match: { userId } }, { $group: { _id: '$source', total: { $sum: '$amount' } } }, { $sort: { total: -1 } }]),
    MoneyEntry.aggregate([
      { $match: { userId } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  res.json(successResponse({ total: total[0]?.total ?? 0, bySource, byMonth }));
}));

router.delete('/entries/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const entry = await MoneyEntry.findOneAndDelete({ _id: req.params.id, userId: requireUserId(req) });
  if (!entry) throw new AppError('NOT_FOUND', 404, 'Money entry not found');
  res.status(204).send();
}));

export default router;
