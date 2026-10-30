import { FilterQuery, Types } from 'mongoose';
import { AppError } from '../../../middlewares/error.middleware';
import { endOfDay, startOfDay } from '../../../utils/date.util';
import { pageOptions } from '../../../utils/request';
import {
  awardPoints,
  duplicateKeyToAppError,
  rebuildHabitStreak,
  removePoints,
} from '../../gamification/services/gamification.service';
import { Streak } from '../../gamification/models/Streak';
import { Habit, IHabit } from '../models/Habit';
import { HabitLog, IHabitLog } from '../models/HabitLog';

function normalizeDate(value?: string | Date): Date {
  return startOfDay(value ? new Date(value) : new Date());
}

function habitStats(logs: IHabitLog[]): { doneDays: number; successRate: number; failureRate: number } {
  const doneDays = logs.filter((log) => log.status === 'completed').length;
  const missedDays = logs.filter((log) => log.status === 'missed').length;
  const total = doneDays + missedDays + logs.filter((log) => log.status === 'skipped').length;
  return {
    doneDays,
    successRate: total ? Math.round((doneDays / total) * 100) : 0,
    failureRate: total ? Math.round((missedDays / total) * 100) : 0,
  };
}

export async function listHabits(userId: string, query: Record<string, unknown>): Promise<unknown> {
  const filter: FilterQuery<IHabit> = { userId };
  if (typeof query.type === 'string') filter.type = query.type;
  if (typeof query.category === 'string') filter.category = query.category;
  if (typeof query.timeSlot === 'string') filter.timeSlot = query.timeSlot;
  if (typeof query.isHobby === 'string') filter.isHobby = query.isHobby === 'true';
  filter.active = typeof query.active === 'string' ? query.active === 'true' : true;
  if (typeof query.search === 'string') filter.name = { $regex: query.search, $options: 'i' };

  const { page, limit, skip } = pageOptions(query);
  const [items, total] = await Promise.all([
    Habit.find(filter).sort({ order: 1, createdAt: -1 }).skip(skip).limit(limit),
    Habit.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total } };
}

export async function createHabit(userId: string, body: Record<string, unknown>): Promise<IHabit> {
  return Habit.create({ ...body, userId });
}

export async function getHabit(userId: string, habitId: string): Promise<unknown> {
  const habit = await Habit.findOne({ _id: habitId, userId });
  if (!habit) throw new AppError('NOT_FOUND', 404, 'Habit not found');
  const logs = await HabitLog.find({ habitId: habit._id, userId }).sort({ date: -1 });
  return { habit, stats: habitStats(logs), streak: await getHabitStreak(userId, habit._id) };
}

async function getHabitStreak(userId: string, habitId: Types.ObjectId): Promise<unknown> {
  return Streak.findOne({ userId, habitId });
}

export async function updateHabit(userId: string, habitId: string, body: Record<string, unknown>): Promise<IHabit> {
  const habit = await Habit.findOneAndUpdate({ _id: habitId, userId }, body, {
    new: true,
    runValidators: true,
  });
  if (!habit) throw new AppError('NOT_FOUND', 404, 'Habit not found');
  return habit;
}

export async function deleteHabit(userId: string, habitId: string): Promise<void> {
  const habit = await Habit.findOneAndUpdate({ _id: habitId, userId }, { active: false });
  if (!habit) throw new AppError('NOT_FOUND', 404, 'Habit not found');
}

export async function addSeasonalSchedule(
  userId: string,
  habitId: string,
  body: { day: string; remindDaysBefore: number }
): Promise<unknown> {
  const habit = await Habit.findOne({ _id: habitId, userId });
  if (!habit) throw new AppError('NOT_FOUND', 404, 'Habit not found');
  const schedule = { day: normalizeDate(body.day), remindDaysBefore: body.remindDaysBefore };
  habit.seasonalSchedule.push(schedule);
  await habit.save();
  return schedule;
}

async function applyHabitPoints(userId: string, habit: IHabit, log: IHabitLog): Promise<number> {
  await removePoints(userId, `habit:${log._id}:`);
  if (log.status === 'completed') {
    return awardPoints({
      userId,
      date: log.date,
      amount: habit.pointsPerCompletion,
      reason: 'habit_completed',
      refType: 'habit',
      refId: habit._id,
      actionKey: `habit:${log._id}:completed`,
    });
  }
  if (log.status === 'missed') {
    return awardPoints({
      userId,
      date: log.date,
      amount: -habit.pointsPenaltyIfMissed,
      reason: 'habit_missed',
      refType: 'habit',
      refId: habit._id,
      actionKey: `habit:${log._id}:missed`,
    });
  }
  return 0;
}

export async function createHabitLog(userId: string, body: Record<string, any>): Promise<unknown> {
  const habit = await Habit.findOne({ _id: body.habitId, userId, active: true });
  if (!habit) throw new AppError('NOT_FOUND', 404, 'Habit not found');

  try {
    const log = await HabitLog.create({
      userId,
      habitId: habit._id,
      date: normalizeDate(body.date),
      status: body.status ?? 'completed',
      completedAt: body.status === 'completed' || !body.status ? new Date() : null,
      note: body.note,
      metadata: body.metadata ?? {},
    });
    const pointsDelta = await applyHabitPoints(userId, habit, log);
    log.points = pointsDelta;
    await log.save();
    await rebuildHabitStreak(userId, habit._id);
    return { log, pointsDelta, streak: await getHabitStreak(userId, habit._id) };
  } catch (err: any) {
    const appError = duplicateKeyToAppError(err);
    if (appError) throw appError;
    throw err;
  }
}

export async function listHabitLogs(userId: string, query: Record<string, unknown>): Promise<unknown> {
  const filter: FilterQuery<IHabitLog> = { userId };
  if (typeof query.habitId === 'string') filter.habitId = query.habitId;
  if (typeof query.status === 'string') filter.status = query.status;
  if (typeof query.from === 'string' || typeof query.to === 'string') {
    filter.date = {
      ...(typeof query.from === 'string' ? { $gte: startOfDay(new Date(query.from)) } : {}),
      ...(typeof query.to === 'string' ? { $lte: endOfDay(new Date(query.to)) } : {}),
    };
  }
  const { page, limit, skip } = pageOptions(query);
  const [items, total] = await Promise.all([
    HabitLog.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
    HabitLog.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total } };
}

export async function getHabitLog(userId: string, logId: string): Promise<IHabitLog> {
  const log = await HabitLog.findOne({ _id: logId, userId });
  if (!log) throw new AppError('NOT_FOUND', 404, 'Habit log not found');
  return log;
}

export async function updateHabitLog(userId: string, logId: string, body: Record<string, unknown>): Promise<IHabitLog> {
  const log = await getHabitLog(userId, logId);
  const habit = await Habit.findOne({ _id: log.habitId, userId });
  if (!habit) throw new AppError('NOT_FOUND', 404, 'Habit not found');
  if (typeof body.status === 'string') {
    log.status = body.status as IHabitLog['status'];
    log.completedAt = body.status === 'completed' ? new Date() : null;
  }
  if (typeof body.note === 'string') log.note = body.note;
  if (body.metadata && typeof body.metadata === 'object') log.metadata = body.metadata as Record<string, unknown>;
  const pointsDelta = await applyHabitPoints(userId, habit, log);
  log.points = pointsDelta;
  await log.save();
  await rebuildHabitStreak(userId, habit._id);
  return log;
}

export async function deleteHabitLog(userId: string, logId: string): Promise<void> {
  const log = await getHabitLog(userId, logId);
  await removePoints(userId, `habit:${log._id}:`);
  await log.deleteOne();
  await rebuildHabitStreak(userId, log.habitId);
}

export async function habitHistory(userId: string, habitId: string): Promise<IHabitLog[]> {
  const habit = await Habit.findOne({ _id: habitId, userId });
  if (!habit) throw new AppError('NOT_FOUND', 404, 'Habit not found');
  return HabitLog.find({ userId, habitId }).sort({ date: -1 });
}

/**
 * هل تُطلب هذه العادة في هذا اليوم؟
 * - أيام العطلة الرسمية (restWeekdays) لا تُطلب ولا تُحتسب غيابًا.
 * - العادات ذات الدورة everyN تُطلب كل N يوم بدءًا من يوم إنشائها.
 */
export function isHabitDueOn(habit: IHabit, day: Date): boolean {
  const restDays = habit.config?.restWeekdays ?? [];
  if (restDays.includes(day.getDay())) return false;
  const everyN = habit.config?.everyN ?? 1;
  if (everyN <= 1) return true;
  const anchor = startOfDay(habit.createdAt).getTime();
  const diffDays = Math.round((startOfDay(day).getTime() - anchor) / 86_400_000);
  return diffDays % everyN === 0;
}

export async function dueHabitsForDate(userId: string, date: Date): Promise<IHabit[]> {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const habits = await Habit.find({
    userId,
    active: true,
    $or: [
      { type: 'daily' },
      { type: 'seasonal', 'seasonalSchedule.day': { $gte: dayStart, $lte: dayEnd } },
    ],
  }).sort({ order: 1, suggestedTime: 1 });
  return habits.filter((habit) => isHabitDueOn(habit, dayStart));
}
