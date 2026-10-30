import { endOfDay, getLocalDate, startOfDay } from '../../utils/date.util';
import { HabitLog } from '../habits/models/HabitLog';
import { dueHabitsForDate, createHabitLog } from '../habits/services/habit.service';
import { getPoints } from '../gamification/services/gamification.service';
import { Task } from '../tasks/models/Task';

export type DailyMood = 'praise' | 'encourage' | 'blame';

/** الساعة التي يُقفل عندها اليوم وتُحتسب الغيابات (23:00 بتوقيت نواكشوط). */
export const END_OF_DAY_CUTOFF_HOUR = 23;

const PRAISE_MESSAGES = [
  'يوم رائع! أغلقت يومك وأنت متماسك، حفظك الله ووفقك.',
  'أحسنت! التزامك اليوم يبني غدك خطوة بخطوة.',
  'ممتاز، دأبٌ وانضباط. واصل بنفس الروح.',
  'عمل مبارك وتنفيذ كامل، خذ نفسًا واستعد لغدٍ أفضل.',
];

const ENCOURAGE_MESSAGES = [
  'تقدّم جيد، وبقيت خطوات صغيرة قبل الإغلاق الكامل.',
  'أنت على الطريق الصحيح، أتمّ ما تبقّى إن أمكن.',
  'مستوى لائق، ويمكنك رفعه لو خصصت وقتًا لما تبقّى.',
  'ما أنجزته اليوم لا يقلّ عن المطلوب، وما فات يمكن تعويضه غدًا.',
];

const BLAME_MESSAGES = [
  'يوم ضعيف، ولا تؤجّل ما بقي إلى الغد فتتكدّس عليك.',
  'كثير من الهفوات اليوم، غدًا فرصة لتدارك ما فات.',
  'لا تقطع السلسلة هكذا؛ عُد بقوة غدًا من أوّل الطريق.',
  'النية كانت جيدة لكن التنفيذ تأخّر، راجع أسباب التشتت.',
];

function pick(messages: string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

export function evaluateDay(score: number): { message: string; mood: DailyMood } {
  if (score >= 90) return { mood: 'praise', message: pick(PRAISE_MESSAGES) };
  if (score >= 50) return { mood: 'encourage', message: pick(ENCOURAGE_MESSAGES) };
  return { mood: 'blame', message: pick(BLAME_MESSAGES) };
}

/** اليوم مقفل فقط بعد الساعة 23:00 بتوقيت نواكشوط (أو إذا كان التاريخ يومًا سابقًا). */
export function isDayClosed(day: Date): boolean {
  const now = getLocalDate();
  const isToday = startOfDay(now).getTime() === startOfDay(day).getTime();
  if (!isToday) return startOfDay(day).getTime() < startOfDay(now).getTime();
  return now.getHours() >= END_OF_DAY_CUTOFF_HOUR;
}

/**
 * تقييد غيابات يوم مغلق (بعد الساعة 23:00) وإخصام نقطة لكل عادة أساسية لم تُنفَّذ.
 * الهوايات مستثناة وفق قاعدة التعويض (تُنجز في اليوم التالي ولا تُخصم نقطة).
 */
async function markMissedForClosedDay(userId: string, day: Date): Promise<void> {
  const habits = await dueHabitsForDate(userId, day);
  const logs = await HabitLog.find({ userId, date: day });
  const loggedHabitIds = new Set(logs.map((log) => log.habitId.toString()));

  for (const habit of habits) {
    if (habit.isHobby) continue;
    if (!loggedHabitIds.has(habit._id.toString())) {
      await createHabitLog(userId, {
        habitId: habit._id.toString(),
        date: day.toISOString(),
        status: 'missed',
      });
    }
  }
}

export async function getDaily(userId: string, date: Date): Promise<unknown> {
  const day = startOfDay(date);
  // قاعدة 23:00: عند تحميل يوم مقفل تُقيَّد الغيابات وتُخصم النقاط تلقائيًا،
  // فلا يتوقف الخصم على فتح صفحة التقييم يدويًا.
  if (isDayClosed(day)) await markMissedForClosedDay(userId, day);
  const [habits, logs, tasks, points] = await Promise.all([
    dueHabitsForDate(userId, day),
    HabitLog.find({ userId, date: day }),
    Task.find({ userId, date: { $gte: day, $lte: endOfDay(day) } }).sort({ startTime: 1, priority: 1 }),
    getPoints(userId, day, endOfDay(day)),
  ]);

  const dailyHabits = habits.map((habit) => ({
    habit,
    log: logs.find((log) => log.habitId.toString() === habit._id.toString()) ?? null,
  }));

  const completedHabits = logs.filter((log) => log.status === 'completed').length;
  const completedTasks = tasks.filter((task) => task.status === 'done').length;
  const totalItems = habits.length + tasks.length;
  const completed = completedHabits + completedTasks;
  const score = totalItems ? Math.round((completed / totalItems) * 100) : 0;
  const { message, mood } = evaluateDay(score);
  const closed = isDayClosed(day);

  return {
    date: day.toISOString(),
    habits: dailyHabits,
    tasks,
    summary: { totalItems, completed, points: points.total },
    endOfDay: {
      score,
      ratePercent: score,
      message,
      mood,
      pointsEarned: points.totalEarned,
      pointsLost: points.totalLost,
      finalized: closed,
    },
  };
}

export async function endOfDayEvaluation(userId: string, date: Date): Promise<unknown> {
  const day = startOfDay(date);

  // قاعدة 23:00: لا تُحتسب الغيابات ما لم ينقضِ وقت اليوم.
  if (!isDayClosed(day)) {
    const payload = (await getDaily(userId, day)) as Record<string, any>;
    payload.endOfDay = {
      ...payload.endOfDay,
      finalized: false,
      message: 'التقييم النهائي يصدر بعد الساعة 23:00؛ ما تبقّى من العادات ما زال قابلًا للإنجاز.',
    };
    return payload;
  }

  // عند الإغلاق يقوم getDaily بتقييد الغيابات وإخصام النقاط تلقائيًا.
  return getDaily(userId, day);
}
