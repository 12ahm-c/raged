import { Router, Response } from 'express';
import mongoose, { Document, Schema, Types } from 'mongoose';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { endOfDay, startOfDay } from '../../utils/date.util';
import { requireUserId } from '../../utils/request';

type QuranPhase = 'review' | 'new_daily' | 'new_weekly' | 'new' | 'weekly_rest';

interface IQuranPlan extends Document {
  userId: Types.ObjectId;
  reviewHizbs: number;
  dailyHizbs: number;
  memorizedUpTo: number;
  weeklyRestEnabled: boolean;
  currentHizb: number;
  currentPhase: QuranPhase;
}

interface IQuranLog extends Document {
  userId: Types.ObjectId;
  date: Date;
  hizb: string;
  phase: QuranPhase;
  durationMinutes: number;
  completedAt: Date;
}

const planSchema = new Schema<IQuranPlan>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    reviewHizbs: { type: Number, default: 25 },
    dailyHizbs: { type: Number, default: 15 },
    memorizedUpTo: { type: Number, default: 25, min: 0 },
    weeklyRestEnabled: { type: Boolean, default: true },
    currentHizb: { type: Number, default: 1 },
    currentPhase: { type: String, enum: ['review', 'new_daily', 'new_weekly', 'new', 'weekly_rest'], default: 'review' },
  },
  { timestamps: true }
);

const logSchema = new Schema<IQuranLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true },
    hizb: { type: String, required: true },
    phase: { type: String, enum: ['review', 'new_daily', 'new_weekly', 'new', 'weekly_rest'], required: true },
    durationMinutes: { type: Number, default: 0 },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
logSchema.index({ userId: 1, date: 1, phase: 1 });

const QuranPlan = mongoose.model<IQuranPlan>('QuranPlan', planSchema);
const QuranLog = mongoose.model<IQuranLog>('QuranLog', logSchema);

const planBody = z.object({
  reviewHizbs: z.number().int().min(1).optional(),
  dailyHizbs: z.number().int().min(1).optional(),
  memorizedUpTo: z.number().int().min(0).max(60).optional(),
  weeklyRestEnabled: z.boolean().optional(),
  currentHizb: z.number().int().min(1).optional(),
  currentPhase: z.enum(['review', 'new_daily', 'new_weekly', 'new', 'weekly_rest']).optional(),
});

async function getOrCreatePlan(userId: string): Promise<IQuranPlan> {
  return QuranPlan.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { new: true, upsert: true });
}

const TOTAL_HIZBS = 60;
const NEW_HIZB_PHASES = ['new', 'new_daily', 'new_weekly'];

function nextHizbNumber(plan: IQuranPlan): number {
  // الحزب التالي = بعد آخر حزب حُفظ فعليًا، ولا يقلّ عن (ما هو محفوظ سابقًا + 1).
  return Math.max(plan.currentHizb, plan.memorizedUpTo + 1);
}

/**
 * الجدولة الذكية للحفظ:
 * - الأحزاب حتى memorizedUpTo (25): محفوظة سلفًا، يُراجع فقط.
 * - ما بعدها حتى memorizedUpTo + dailyHizbs (40): حزب واحد كل يوم، مع يوم راحة كل 7 أحزاب.
 * - البقية (41-60): حزب واحد كل أسبوع، مع مراجعة مستمرة في الانتظار.
 */
async function computeSuggestion(plan: IQuranPlan): Promise<{ suggestedHizb: string; phase: QuranPhase; reason: string }> {
  const next = nextHizbNumber(plan);

  if (next > TOTAL_HIZBS) {
    return {
      suggestedHizb: String(plan.memorizedUpTo),
      phase: 'review',
      reason: 'أتممت أحزاب الختمة الستين، فوّقك الله. خصّص وقتك للمراجعة المستمرة.',
    };
  }

  const today = startOfDay(new Date());
  const todayNewLog = await QuranLog.findOne({
    userId: plan.userId,
    date: today,
    phase: { $in: NEW_HIZB_PHASES },
  });
  if (todayNewLog) {
    return {
      suggestedHizb: String(next),
      phase: 'review',
      reason: 'سجّلت حزبًا جديدًا اليوم، فخصّص بقيّة وقتك لمراجعة ما تحفظه.',
    };
  }

  const dailyEnd = plan.memorizedUpTo + plan.dailyHizbs;

  if (next <= dailyEnd) {
    const completedInPhase = next - plan.memorizedUpTo - 1;
    if (plan.weeklyRestEnabled && completedInPhase > 0 && completedInPhase % 7 === 0) {
      return {
        suggestedHizb: String(next),
        phase: 'weekly_rest',
        reason: 'حان يوم الراحة الأسبوعية بعد ستة أحزاب جديدة؛ راجع المحفوظ فقط اليوم.',
      };
    }
    return {
      suggestedHizb: String(next),
      phase: 'new_daily',
      reason: `أنت في مرحلة الحزب اليومي حتى الحزب ${dailyEnd}: حزب واحد متأنٍّ كل يوم.`,
    };
  }

  const lastNewLog = await QuranLog.findOne({
    userId: plan.userId,
    phase: { $in: NEW_HIZB_PHASES },
  }).sort({ date: -1 });

  if (lastNewLog) {
    const daysSince = Math.round(
      (startOfDay(new Date()).getTime() - startOfDay(lastNewLog.date).getTime()) / 86400000
    );
    if (daysSince < 7) {
      return {
        suggestedHizb: String(next),
        phase: 'review',
        reason: `المرحلة الأسبوعية: بقي ${7 - daysSince} يومًا من آخر حزب، فاليوم لمراجعة المحفوظ.`,
      };
    }
  }

  return {
    suggestedHizb: String(next),
    phase: 'new_weekly',
    reason: 'المرحلة الأسبوعية: حزب واحد كل أسبوع بقراءة متأنية وخشوع.',
  };
}

const router = Router();
router.use(authMiddleware);

router.get('/plan', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await getOrCreatePlan(requireUserId(req))));
}));

router.put('/plan', validate(z.object({ body: planBody })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const plan = await QuranPlan.findOneAndUpdate({ userId: requireUserId(req) }, req.body, { new: true, upsert: true, runValidators: true });
  res.json(successResponse(plan));
}));

router.post('/logs', validate(z.object({
  body: z.object({
    date: z.string().optional(),
    hizb: z.union([z.string().min(1), z.number().int().min(1)]).transform((val) => String(val)),
    phase: z.enum(['review', 'new_daily', 'new_weekly', 'new', 'weekly_rest']),
    durationMinutes: z.number().int().min(0).default(0),
  }),
})), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const log = await QuranLog.create({ ...req.body, userId, date: startOfDay(req.body.date ? new Date(req.body.date) : new Date()) });
  const plan = await getOrCreatePlan(userId);

  // التقدّم للأمام يحدث فقط عند حفظ حزب جديد، لا عند المراجعة.
  if (NEW_HIZB_PHASES.includes(req.body.phase)) {
    const hizbNumber = Number.parseInt(req.body.hizb, 10);
    if (Number.isInteger(hizbNumber) && hizbNumber > 0) {
      plan.currentHizb = Math.max(plan.currentHizb, hizbNumber + 1, plan.memorizedUpTo + 1);
    } else {
      plan.currentHizb = Math.max(nextHizbNumber(plan) + 1, plan.memorizedUpTo + 1);
    }
    plan.currentPhase = req.body.phase === 'new_weekly' ? 'new_weekly' : 'new_daily';
  } else {
    plan.currentPhase = req.body.phase;
  }
  await plan.save();
  res.status(201).json(successResponse({ log, nextPhaseSuggestion: await computeSuggestion(plan) }));
}));

router.get('/logs', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filter: Record<string, unknown> = { userId: requireUserId(req) };
  if (typeof req.query.phase === 'string') filter.phase = req.query.phase;
  if (typeof req.query.from === 'string' || typeof req.query.to === 'string') {
    filter.date = {
      ...(typeof req.query.from === 'string' ? { $gte: startOfDay(new Date(req.query.from)) } : {}),
      ...(typeof req.query.to === 'string' ? { $lte: endOfDay(new Date(req.query.to)) } : {}),
    };
  }
  res.json(successResponse(await QuranLog.find(filter).sort({ date: -1 })));
}));

router.get('/next', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse(await computeSuggestion(await getOrCreatePlan(requireUserId(req)))));
}));

export default router;
