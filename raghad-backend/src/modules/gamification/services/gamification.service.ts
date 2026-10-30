import { Types } from 'mongoose';
import { AppError } from '../../../middlewares/error.middleware';
import { endOfDay, startOfDay } from '../../../utils/date.util';
import { PointLedger, PointReason, PointRefType } from '../models/PointLedger';
import { Streak } from '../models/Streak';
import { HabitLog } from '../../habits/models/HabitLog';
import { Habit } from '../../habits/models/Habit';

interface AwardInput {
  userId: string;
  date: Date;
  amount: number;
  reason: PointReason;
  refType: PointRefType;
  refId: Types.ObjectId;
  actionKey: string;
  note?: string;
}

export async function awardPoints(input: AwardInput): Promise<number> {
  if (input.amount === 0) return 0;

  try {
    const entry = await PointLedger.create({
      userId: input.userId,
      date: input.date,
      amount: input.amount,
      reason: input.reason,
      refType: input.refType,
      refId: input.refId,
      actionKey: input.actionKey,
      note: input.note,
    });
    return entry.amount;
  } catch (err: any) {
    if (err?.code === 11000) return 0;
    throw err;
  }
}

export async function removePoints(userId: string, actionKeyPrefix: string): Promise<void> {
  await PointLedger.deleteMany({ userId, actionKey: { $regex: `^${actionKeyPrefix}` } });
}

export async function rebuildHabitStreak(userId: string, habitId: Types.ObjectId): Promise<void> {
  const logs = await HabitLog.find({
    userId,
    habitId,
    status: 'completed',
  }).sort({ date: 1 });

  let current = 0;
  let longest = 0;
  let previous: Date | null = null;
  let lastCompletedDate: Date | null = null;

  for (const log of logs) {
    const currentDate = startOfDay(log.date);
    if (previous) {
      const diffDays = Math.round((currentDate.getTime() - previous.getTime()) / 86400000);
      current = diffDays === 1 ? current + 1 : 1;
    } else {
      current = 1;
    }
    longest = Math.max(longest, current);
    previous = currentDate;
    lastCompletedDate = currentDate;
  }

  await Streak.findOneAndUpdate(
    { userId, habitId },
    { current, longest, lastCompletedDate },
    { upsert: true, new: true }
  );
}

export async function getPoints(
  userId: string,
  from?: Date,
  to?: Date,
  reason?: string
): Promise<{
  total: number;
  totalEarned: number;
  totalLost: number;
  net: number;
  entries: unknown[];
}> {
  const query: Record<string, unknown> = { userId };
  if (from || to) query.date = { ...(from ? { $gte: startOfDay(from) } : {}), ...(to ? { $lte: endOfDay(to) } : {}) };
  if (reason) query.reason = reason;
  const entries = await PointLedger.find(query).sort({ date: -1, createdAt: -1 });
  let totalEarned = 0;
  let totalLost = 0;
  for (const entry of entries) {
    if (entry.amount > 0) totalEarned += entry.amount;
    else totalLost += -entry.amount;
  }
  const total = totalEarned - totalLost;
  return { total, totalEarned, totalLost, net: total, entries };
}

export async function getStreaks(userId: string): Promise<unknown[]> {
  const [streaks, habits] = await Promise.all([
    Streak.find({ userId }).sort({ longest: -1, current: -1 }).lean(),
    Habit.find({ userId }).select('name').lean(),
  ]);
  const nameById = new Map(habits.map((habit) => [String(habit._id), habit.name]));
  return streaks.map((streak) => ({
    ...streak,
    habitName: nameById.get(String(streak.habitId)) ?? null,
  }));
}

interface HabitLogRate {
  completed: number;
  missed: number;
}

async function habitLogRates(userId: string, from: Date, to: Date): Promise<Map<string, HabitLogRate>> {
  const rows = await HabitLog.aggregate<{ _id: { habitId: Types.ObjectId; status: string }; count: number }>([
    {
      $match: {
        userId: new Types.ObjectId(userId),
        date: { $gte: from, $lte: to },
        status: { $in: ['completed', 'missed'] },
      },
    },
    { $group: { _id: { habitId: '$habitId', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const rates = new Map<string, HabitLogRate>();
  for (const row of rows) {
    const key = String(row._id.habitId);
    const entry = rates.get(key) ?? { completed: 0, missed: 0 };
    if (row._id.status === 'completed') entry.completed += row.count;
    else entry.missed += row.count;
    rates.set(key, entry);
  }
  return rates;
}

function ratePercent(rate: HabitLogRate): number {
  const total = rate.completed + rate.missed;
  return total ? Math.round((rate.completed / total) * 100) : 0;
}

function totalRate(rates: Iterable<HabitLogRate>): HabitLogRate {
  let completed = 0;
  let missed = 0;
  for (const rate of rates) {
    completed += rate.completed;
    missed += rate.missed;
  }
  return { completed, missed };
}

/** إحصاءات تحفيزية: اليوم/الأسبوع/الشهر ومعدل كل عادة هذا الأسبوع — كلها من الخادم. */
export async function getStats(userId: string): Promise<unknown> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = new Date(todayStart.getTime() - 6 * 86400000);
  const monthStart = new Date(todayStart.getTime() - 29 * 86400000);

  const [todayPoints, weekRates, monthRates, streakCount, bestStreak, totalPoints, habits] = await Promise.all([
    getPoints(userId, todayStart, todayEnd),
    habitLogRates(userId, weekStart, todayEnd),
    habitLogRates(userId, monthStart, todayEnd),
    Streak.countDocuments({ userId }),
    Streak.findOne({ userId }).sort({ longest: -1 }),
    PointLedger.aggregate([{ $match: { userId: new Types.ObjectId(userId) } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Habit.find({ userId }).select('name').lean(),
  ]);

  const nameById = new Map(habits.map((habit) => [String(habit._id), habit.name]));
  const weekTotal = totalRate(weekRates.values());
  const monthTotal = totalRate(monthRates.values());

  const habitsWeekly = Array.from(weekRates.entries())
    .map(([habitId, rate]) => ({
      habitId,
      habitName: nameById.get(habitId) ?? null,
      ratePercent: ratePercent(rate),
      completed: rate.completed,
      missed: rate.missed,
    }))
    .sort((a, b) => a.ratePercent - b.ratePercent);

  return {
    points: totalPoints[0]?.total ?? 0,
    streakCount,
    bestStreak: bestStreak?.longest ?? 0,
    today: { earned: todayPoints.totalEarned, lost: todayPoints.totalLost, net: todayPoints.total },
    week: { ratePercent: ratePercent(weekTotal), completed: weekTotal.completed, total: weekTotal.completed + weekTotal.missed },
    month: { ratePercent: ratePercent(monthTotal), completed: monthTotal.completed, total: monthTotal.completed + monthTotal.missed },
    habitsWeekly,
  };
}

export function levelForPoints(points: number): { level: number; currentLevelMin: number; nextLevelAt: number } {
  const level = Math.max(Math.floor(points / 100) + 1, 1);
  return {
    level,
    currentLevelMin: (level - 1) * 100,
    nextLevelAt: level * 100,
  };
}

export async function getLevels(userId: string): Promise<unknown> {
  const { total } = await getPoints(userId);
  const base = levelForPoints(total);

  // تاريخ وصول المستويات: تتبّع تراكم النقاط في دفتر النقاط.
  const entries = await PointLedger.find({ userId }).sort({ date: 1, createdAt: 1 }).select('date amount').lean();
  const history: { level: number; reachedAt: Date }[] = [];
  let running = 0;
  let reached = 1;
  for (const entry of entries) {
    running += entry.amount;
    const level = levelForPoints(running).level;
    if (level > reached) {
      for (let next = reached + 1; next <= level; next += 1) {
        history.push({ level: next, reachedAt: entry.date });
      }
      reached = level;
    }
  }

  return { ...base, currentLevel: base.level, points: total, history };
}

export function duplicateKeyToAppError(err: any): AppError | undefined {
  if (err?.code === 11000) {
    return new AppError('DUPLICATE', 409, 'Duplicate record');
  }
  return undefined;
}
