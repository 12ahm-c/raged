import { endOfDay, startOfDay, getLocalDate } from '../utils/date.util';
import { Habit } from '../modules/habits/models/Habit';
import { isHabitDueOn } from '../modules/habits/services/habit.service';
import { Task } from '../modules/tasks/models/Task';
import { User } from '../modules/auth/models/User';
import { endOfDayEvaluation } from '../modules/daily/daily.service';
import { BrotherhoodSession } from '../modules/brotherhood/brotherhood.routes';
import { createNotification, sendPushSafe } from '../modules/notifications/notifications.routes';

async function notify(input: {
  userId: string;
  type: 'habit_reminder' | 'task_reminder' | 'daily_summary' | 'system';
  title: string;
  body: string;
  sourceKey: string;
  scheduledAt?: Date;
  data?: Record<string, unknown>;
}): Promise<boolean> {
  const notification = await createNotification(input);
  // createNotification تُرجع null عند التكرار (sourceKey موحّد) — لا نعيد الإرسال.
  if (!notification) return false;
  await sendPushSafe(input.userId, notification);
  return true;
}

/** تحويل "HH:MM" إلى دقائق منذ منتصف الليل، أو null عند خطأ. */
function parseTimeToMinutes(value?: string): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * تذكيرات قرب الوقت — تُستدعى كل دقيقة من المُجدول:
 * - عادة ذات وقت مقترح: تذكير عند موعدها (بنافذة تسامح قدرها leadMinutes).
 * - مهمة بوقت بدء: تذكير قبلها بـ reminderLeadMinutes (افتراضي 5 دقائق).
 * - جلسة أخوة: تذكير قبلها بـ reminderLeadMinutes.
 * التكرار ممنوع عبر sourceKey الموحّد لكل حدث في يومه.
 */
export async function reminderJob(now = new Date()): Promise<{ created: number }> {
  let created = 0;
  // الوقت المحلي (أفريقيا/نواكشوط) للمطابقة مع التوقيتات المسجّلة.
  const localNow = getLocalDate(now);
  const nowMinutes = localNow.getHours() * 60 + localNow.getMinutes();
  const today = startOfDay(now);
  const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);

  const [habits, tasks, sessions] = await Promise.all([
    Habit.find({ active: true, suggestedTime: { $exists: true } }),
    Task.find({ status: 'todo', date: { $gte: today, $lte: endOfDay(today) }, startTime: { $exists: true } }),
    BrotherhoodSession.find({ status: 'done', date: { $gte: now, $lte: windowEnd } }),
  ]);

  // إعدادات المستخدمين المتأثرين (للنافذة الزمنية وتفعيل الإشعارات).
  const userIds = [
    ...new Set(
      [...habits, ...tasks, ...sessions].map((doc) => doc.userId.toString())
    ),
  ];
  const users = await User.find({ _id: { $in: userIds } });
  const settingsByUser = new Map(users.map((user) => [user._id.toString(), user.settings]));

  for (const habit of habits) {
    const userId = habit.userId.toString();
    const settings = settingsByUser.get(userId);
    if (settings && !settings.notificationsEnabled) continue;
    if (!isHabitDueOn(habit, today)) continue;
    const suggestedMinutes = parseTimeToMinutes(habit.suggestedTime);
    if (suggestedMinutes === null) continue;
    const lead = settings?.reminderLeadMinutes ?? 5;
    // التذكير عند الموعد أو خلال نافذة التسامح بعده (dedupe عبر sourceKey).
    if (nowMinutes < suggestedMinutes || nowMinutes > suggestedMinutes + lead) continue;
    const createdNow = await notify({
      userId,
      type: 'habit_reminder',
      title: 'حان وقت العادة',
      body: `${habit.name}${habit.details ? ` — ${habit.details}` : ''}`,
      sourceKey: `habit-reminder:${habit._id}:${today.toISOString()}`,
      scheduledAt: now,
      data: { habitId: habit._id.toString(), url: '/' },
    });
    if (createdNow) created += 1;
  }

  for (const task of tasks) {
    const userId = task.userId.toString();
    const settings = settingsByUser.get(userId);
    if (settings && !settings.notificationsEnabled) continue;
    const startMinutes = parseTimeToMinutes(task.startTime);
    if (startMinutes === null) continue;
    const lead = settings?.reminderLeadMinutes ?? 5;
    const remindAt = startMinutes - lead;
    if (nowMinutes < remindAt || nowMinutes > startMinutes) continue;
    const createdNow = await notify({
      userId,
      type: 'task_reminder',
      title: 'مهمة على وشك البدء',
      body: `${task.title} — بعد ${lead} دقائق`,
      sourceKey: `task-reminder:${task._id}:${task.date.toISOString()}`,
      scheduledAt: now,
      data: { taskId: task._id.toString(), url: '/' },
    });
    if (createdNow) created += 1;
  }

  for (const session of sessions) {
    const userId = session.userId.toString();
    const settings = settingsByUser.get(userId);
    if (settings && !settings.notificationsEnabled) continue;
    const lead = settings?.reminderLeadMinutes ?? 5;
    const remindAt = session.date.getTime() - lead * 60 * 1000;
    if (now.getTime() < remindAt || now.getTime() > session.date.getTime()) continue;
    const createdNow = await notify({
      userId,
      type: 'task_reminder',
      title: 'جلسة الأخوة بعد قليل',
      body: `مراجعة الطلاب بعد ${lead} دقائق`,
      sourceKey: `brotherhood-reminder:${session._id}:${session.date.toISOString()}`,
      scheduledAt: now,
      data: { sessionId: session._id.toString(), studentId: session.studentId.toString(), url: '/' },
    });
    if (createdNow) created += 1;
  }

  return { created };
}

export async function endOfDayJob(date = new Date()): Promise<{ users: number }> {
  const users = await User.find({});
  for (const user of users) {
    if (user.settings && !user.settings.notificationsEnabled) continue;
    // تقييد الغيابات وإخصام النقاط (−1 قبل 23:00) يتم داخل getDaily تلقائيًا.
    await endOfDayEvaluation(user._id.toString(), date);
    await notify({
      userId: user._id.toString(),
      type: 'daily_summary',
      title: 'إغلاق اليوم',
      body: 'حان وقت تقييم اليوم — راجع إنجازك قبل النوم',
      sourceKey: `end-of-day:${user._id}:${startOfDay(date).toISOString()}`,
      scheduledAt: date,
      data: { url: '/' },
    });
  }
  return { users: users.length };
}

export async function dailySummaryJob(date = new Date()): Promise<{ users: number }> {
  const users = await User.find({});
  for (const user of users) {
    if (user.settings && !user.settings.notificationsEnabled) continue;
    await notify({
      userId: user._id.toString(),
      type: 'daily_summary',
      title: 'يوم جديد 🌅',
      body: 'ابدأ يومك بالدعاء ثم نفّذ عاداتك — نقطة واحدة لكل عادة تنفذها',
      sourceKey: `daily-summary:${user._id}:${startOfDay(date).toISOString()}`,
      scheduledAt: date,
      data: { url: '/' },
    });
  }
  return { users: users.length };
}

export async function seasonalActivationJob(date = new Date()): Promise<{ checked: number }> {
  const today = startOfDay(date);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const habits = await Habit.find({ type: 'seasonal', active: true });
  let checked = 0;
  for (const habit of habits) {
    for (const schedule of habit.seasonalSchedule) {
      const diffDays = Math.ceil((schedule.day.getTime() - today.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays <= schedule.remindDaysBefore && schedule.day <= monthEnd) {
        await notify({
          userId: habit.userId.toString(),
          type: 'habit_reminder',
          title: 'Seasonal habit',
          body: habit.name,
          sourceKey: `seasonal:${habit._id}:${schedule.day.toISOString()}`,
          scheduledAt: schedule.day,
          data: { habitId: habit._id.toString() },
        });
      }
    }
    checked += 1;
  }
  return { checked };
}

export async function dailyResetJob(): Promise<{ ok: true }> {
  return { ok: true };
}
