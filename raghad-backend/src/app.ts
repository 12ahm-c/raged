import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { connectDB } from './utils/db';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware';
import { conditionalRateLimiter } from './middlewares/rateLimit.middleware';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import { habitLogRoutes, habitRoutes } from './modules/habits/habit.routes';
import gamificationRoutes from './modules/gamification/gamification.routes';
import dailyRoutes from './modules/daily/daily.routes';
import taskRoutes from './modules/tasks/task.routes';
import projectRoutes, { nodeRouter } from './modules/projects/project.routes';
import goalRoutes from './modules/goals/goal.routes';
import calendarRoutes from './modules/calendar/calendar.routes';
import readingRoutes from './modules/reading/reading.routes';
import quranRoutes from './modules/quran/quran.routes';
import englishRoutes from './modules/english/english.routes';
import brotherhoodRoutes from './modules/brotherhood/brotherhood.routes';
import moneyRoutes from './modules/money/money.routes';
import mediaRoutes from './modules/media/media.routes';
import hasaniyaRoutes from './modules/hasaniya/hasaniya.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import jobRoutes from './modules/jobs/job.routes';
import progressRoutes from './modules/progress/progress.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import integrationRoutes from './modules/integrations/integrations.routes';
import { requestLogger } from './middlewares/requestLogger.middleware';
import { successResponse } from './utils/apiResponse';
import { startScheduler } from './jobs/scheduler';

export function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
  }));
  app.use(express.json());
  app.use(requestLogger);
  app.use(conditionalRateLimiter);

  app.get('/health', (_req, res) => {
    res.json(successResponse({ status: 'ok', timestamp: new Date().toISOString() }));
  });

  app.use('/v1/auth', authRoutes);
  app.use('/v1/users', userRoutes);
  app.use('/v1/habits', habitRoutes);
  app.use('/v1/habit-logs', habitLogRoutes);
  app.use('/v1/gamification', gamificationRoutes);
  app.use('/v1/daily', dailyRoutes);
  app.use('/v1/tasks', taskRoutes);
  app.use('/v1/projects', projectRoutes);
  app.use('/v1/nodes', nodeRouter);
  app.use('/v1/goals', goalRoutes);
  app.use('/v1/calendar', calendarRoutes);
  app.use('/v1/reading', readingRoutes);
  app.use('/v1/quran', quranRoutes);
  app.use('/v1/english', englishRoutes);
  app.use('/v1/brotherhood', brotherhoodRoutes);
  app.use('/v1/money', moneyRoutes);
  app.use('/v1/media', mediaRoutes);
  app.use('/v1/hasaniya', hasaniyaRoutes);
  app.use('/v1/notifications', notificationRoutes);
  app.use('/v1/jobs', jobRoutes);
  app.use('/v1/progress', progressRoutes);
  app.use('/v1/dashboard', dashboardRoutes);
  app.use('/v1/integrations', integrationRoutes);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}

export async function startServer(): Promise<void> {
  await connectDB();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[Server] Running on http://localhost:${config.port}/v1`);
    // مُجدول الإشعارات: تذكيرات قرب الوقت + إغلاق اليوم 23:00 + بداية اليوم.
    startScheduler();
  });
}
