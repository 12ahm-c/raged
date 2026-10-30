import { Router, Response } from 'express';
import mongoose, { Document, Schema, Types } from 'mongoose';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireUserId } from '../../utils/request';
import { getLocalDate, startOfDay } from '../../utils/date.util';

type Skill = 'reading' | 'writing' | 'listening' | 'speaking';
type LevelStatus = 'locked' | 'unlocked' | 'completed';

interface IEnglishLevel extends Document {
  userId: Types.ObjectId;
  index: number;
  skill: Skill;
  title: string;
  status: LevelStatus;
  contentRef?: string;
  completedAt?: Date | null;
}

interface IEnglishProgress extends Document {
  userId: Types.ObjectId;
  skill: Skill;
  currentLevel: number;
  completedLevels: number[];
  score: number;
}

const levelSchema = new Schema<IEnglishLevel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    index: { type: Number, required: true },
    skill: { type: String, enum: ['reading', 'writing', 'listening', 'speaking'], required: true },
    title: { type: String, required: true },
    status: { type: String, enum: ['locked', 'unlocked', 'completed'], default: 'locked' },
    contentRef: { type: String },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
levelSchema.index({ userId: 1, skill: 1, index: 1 }, { unique: true });

const progressSchema = new Schema<IEnglishProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skill: { type: String, enum: ['reading', 'writing', 'listening', 'speaking'], required: true },
    currentLevel: { type: Number, default: 1 },
    completedLevels: { type: [Number], default: [] },
    score: { type: Number, default: 0 },
  },
  { timestamps: true }
);
progressSchema.index({ userId: 1, skill: 1 }, { unique: true });

export const EnglishLevel = mongoose.model<IEnglishLevel>('EnglishLevel', levelSchema);
export const EnglishProgress = mongoose.model<IEnglishProgress>('EnglishProgress', progressSchema);

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const skills: Skill[] = ['reading', 'writing', 'listening', 'speaking'];

async function getProgress(userId: string, skill: Skill): Promise<IEnglishProgress> {
  return EnglishProgress.findOneAndUpdate(
    { userId, skill },
    { $setOnInsert: { userId, skill } },
    { new: true, upsert: true }
  );
}

const router = Router();
router.use(authMiddleware);

router.get('/levels', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filter: Record<string, unknown> = { userId: requireUserId(req) };
  if (typeof req.query.skill === 'string') filter.skill = req.query.skill;
  res.json(successResponse(await EnglishLevel.find(filter).sort({ skill: 1, index: 1 })));
}));

router.post('/levels', validate(z.object({
  body: z.object({
    index: z.number().int().min(1),
    skill: z.enum(['reading', 'writing', 'listening', 'speaking']),
    title: z.string().min(1),
    contentRef: z.string().optional(),
  }),
})), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const status = req.body.index === 1 ? 'unlocked' : 'locked';
  res.status(201).json(successResponse(await EnglishLevel.create({ ...req.body, status, userId: requireUserId(req) })));
}));

/** الهدف المطلوب: إتمام 3 مستويات كل أسبوع (أسبوع يبدأ الأحد — يوم العطلة الرسمية). */
export const WEEKLY_LEVEL_TARGET = 3;

router.get('/progress', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const entries = await Promise.all(skills.map((skill) => getProgress(userId, skill)));

  // إحصاء الأسبوع الجاري: مستويات أُنجزت منذ آخر يوم أحد (بتوقيت نواكشوط).
  const now = getLocalDate();
  const weekStart = startOfDay(new Date(now.getTime() - now.getDay() * 86_400_000));
  const weekCompleted = await EnglishLevel.countDocuments({
    userId,
    status: 'completed',
    completedAt: { $gte: weekStart },
  });

  res.json(successResponse({
    ...Object.fromEntries(entries.map((entry) => [entry.skill, entry])),
    weekly: {
      target: WEEKLY_LEVEL_TARGET,
      completed: weekCompleted,
      remaining: Math.max(0, WEEKLY_LEVEL_TARGET - weekCompleted),
      weekStart: weekStart.toISOString(),
    },
  }));
}));

router.get('/levels/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const level = await EnglishLevel.findOne({ _id: req.params.id, userId: requireUserId(req) });
  if (!level) throw new AppError('NOT_FOUND', 404, 'English level not found');
  res.json(successResponse(level));
}));

router.post('/levels/:id/complete', validate(z.object({
  params: z.object({ id: objectId }),
  body: z.object({ score: z.number().min(0).max(100).default(0) }),
})), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const level = await EnglishLevel.findOne({ _id: req.params.id, userId });
  if (!level) throw new AppError('NOT_FOUND', 404, 'English level not found');
  const progress = await getProgress(userId, level.skill);
  if (level.index > progress.currentLevel) throw new AppError('LEVEL_LOCKED', 409, 'Previous level must be completed first');
  level.status = 'completed';
  level.completedAt = new Date();
  await level.save();
  const unlockedNext = await EnglishLevel.findOneAndUpdate(
    { userId, skill: level.skill, index: level.index + 1, status: 'locked' },
    { status: 'unlocked' },
    { new: true }
  );
  progress.currentLevel = Math.max(progress.currentLevel, level.index + 1);
  progress.completedLevels = Array.from(new Set([...progress.completedLevels, level.index])).sort((a, b) => a - b);
  progress.score = req.body.score;
  await progress.save();
  res.json(successResponse({ level, unlockedNext, progress }));
}));

export default router;
