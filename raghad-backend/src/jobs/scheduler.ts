import { getLocalDate } from '../utils/date.util';
import {
  dailySummaryJob,
  endOfDayJob,
  reminderJob,
  seasonalActivationJob,
} from './notification.jobs';

/**
 * مُجدول داخلي يعمل كل دقيقة (بديل cron — لا حاجة لخدمة خارجية):
 * - كل دقيقة: تذكيرات قرب الوقت (عادات بوقتها، مهام قبل 5 دقائق، جلسات الأخوة).
 * - 23:00 بالتوقيت المحلي: إغلاق اليوم (خصم −1 للعادات غير المنفذة) + تذكير التقييم.
 * - 00:05: تهنئة يوم جديد.
 * - مرة يوميًا: تفعيل العادات الموسمية القريبة.
 * التكرار ممنوع تمامًا عبر sourceKey الموحّد في قاعدة البيانات.
 */

const TICK_MS = 60 * 1000;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function safeRun(name: string, job: () => Promise<unknown>): Promise<void> {
  try {
    await job();
  } catch (error) {
    console.error(`[Scheduler] ${name} failed:`, error);
  }
}

export async function schedulerTick(now = new Date()): Promise<void> {
  if (running) return; // لا تداخل بين الدفعات
  running = true;
  try {
    const local = getLocalDate(now);
    const hour = local.getHours();
    const minute = local.getMinutes();

    // تذكيرات قرب الوقت — كل دقيقة.
    await safeRun('reminderJob', () => reminderJob(now));

    // إغلاق اليوم عند 23:00 — خلال أول 10 دقائق من الساعة تكفي (dedupe يمنع التكرار).
    if (hour === 23 && minute < 10) {
      await safeRun('endOfDayJob', () => endOfDayJob(now));
    }

    // بداية اليوم الجديد.
    if (hour === 0 && minute < 10) {
      await safeRun('dailySummaryJob', () => dailySummaryJob(now));
    }

    // العادات الموسمية — مرة يوميًا عند منتصف الليل تقريبًا.
    if (hour === 0 && minute < 30) {
      await safeRun('seasonalActivationJob', () => seasonalActivationJob(now));
    }
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    void schedulerTick();
  }, TICK_MS);
  // أول دفعة بعد 5 ثوانٍ من الإقلاع (لا تزامن مع اتصال قاعدة البيانات).
  setTimeout(() => {
    void schedulerTick();
  }, 5 * 1000);
  console.log('[Scheduler] Started — ticking every minute');
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
