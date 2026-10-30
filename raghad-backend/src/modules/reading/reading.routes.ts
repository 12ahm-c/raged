import { Router, Response } from 'express';
import mongoose, { Document, Schema, SortOrder, Types } from 'mongoose';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { pageOptions, requireUserId } from '../../utils/request';

type BookStatus = 'locked' | 'unlocked' | 'in_progress' | 'completed';

interface IBook extends Document {
  userId: Types.ObjectId;
  title: string;
  author: string;
  level: number;
  status: BookStatus;
  pdfUrl: string;
  bookmarkPage: number;
  notes?: string;
  completedAt?: Date | null;
}

interface IBookNote extends Document {
  userId: Types.ObjectId;
  bookId: Types.ObjectId;
  text: string;
  page?: number;
  createdAt: Date;
}

const bookSchema = new Schema<IBook>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    level: { type: Number, required: true },
    status: { type: String, enum: ['locked', 'unlocked', 'in_progress', 'completed'], default: 'locked' },
    pdfUrl: { type: String, required: true },
    bookmarkPage: { type: Number, default: 1 },
    notes: { type: String },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
bookSchema.index({ userId: 1, level: 1 }, { unique: true });
bookSchema.index({ userId: 1, status: 1, title: 1 });

const noteSchema = new Schema<IBookNote>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bookId: { type: Schema.Types.ObjectId, ref: 'Book', required: true, index: true },
    text: { type: String, required: true },
    page: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Book = mongoose.model<IBook>('Book', bookSchema);
export const BookNote = mongoose.model<IBookNote>('BookNote', noteSchema);

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const bookBody = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  pdfUrl: z.string().url(),
  level: z.number().int().min(1).optional(),
  order: z.number().int().min(1).optional(),
});

async function ensureBookUnlocked(userId: string, book: IBook): Promise<void> {
  if (book.level <= 1) return;
  const previous = await Book.findOne({ userId, level: book.level - 1 });
  if (!previous || previous.status !== 'completed') {
    throw new AppError('LEVEL_LOCKED', 409, 'Previous book level must be completed first');
  }
}

const router = Router();
router.use(authMiddleware);

router.get('/books', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const filter: Record<string, unknown> = { userId };
  if (typeof req.query.status === 'string') filter.status = req.query.status;
  if (typeof req.query.search === 'string') filter.title = { $regex: req.query.search, $options: 'i' };
  const { page, limit, skip } = pageOptions(req.query);
  const sort: Record<string, SortOrder> = req.query.sort === 'alphabetical' ? { title: 1 } : { level: 1 };
  const [items, total] = await Promise.all([
    Book.find(filter).sort(sort).skip(skip).limit(limit),
    Book.countDocuments(filter),
  ]);
  res.json(successResponse({ items, meta: { page, limit, total } }));
}));

router.post('/books', validate(z.object({ body: bookBody })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const level = req.body.level ?? req.body.order ?? ((await Book.countDocuments({ userId })) + 1);
  const status: BookStatus = level === 1 ? 'unlocked' : 'locked';
  const book = await Book.create({ ...req.body, level, status, userId });
  res.status(201).json(successResponse(book));
}));

router.get('/books/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const book = await Book.findOne({ _id: req.params.id, userId });
  if (!book) throw new AppError('NOT_FOUND', 404, 'Book not found');
  const notes = await BookNote.find({ userId, bookId: book._id }).sort({ createdAt: -1 });
  res.json(successResponse({ book, notes }));
}));

router.put('/books/:id', validate(z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    bookmarkPage: z.number().int().min(1).optional(),
    notes: z.string().optional(),
    status: z.enum(['locked', 'unlocked', 'in_progress', 'completed']).optional(),
  }),
})), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const book = await Book.findOne({ _id: req.params.id, userId });
  if (!book) throw new AppError('NOT_FOUND', 404, 'Book not found');
  if (req.body.status && req.body.status !== 'locked') await ensureBookUnlocked(userId, book);
  Object.assign(book, req.body);
  if (req.body.status === 'completed') book.completedAt = new Date();
  await book.save();
  const next = await Book.findOne({ userId, level: book.level + 1, status: 'locked' });
  if (req.body.status === 'completed' && next) {
    next.status = 'unlocked';
    await next.save();
  }
  res.json(successResponse(book));
}));

router.get('/books/:id/notes', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await BookNote.find({ userId: requireUserId(req), bookId: req.params.id }).sort({ createdAt: -1 })));
}));

router.post('/books/:id/notes', validate(z.object({
  params: z.object({ id: objectId }),
  body: z.object({ text: z.string().min(1), page: z.number().int().min(1).optional() }),
})), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const book = await Book.findOne({ _id: req.params.id, userId });
  if (!book) throw new AppError('NOT_FOUND', 404, 'Book not found');
  res.status(201).json(successResponse(await BookNote.create({ ...req.body, userId, bookId: book._id })));
}));

export default router;
