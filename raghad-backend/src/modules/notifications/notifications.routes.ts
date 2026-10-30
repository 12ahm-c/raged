import { Router, Response } from 'express';
import mongoose, { Document, Schema, Types } from 'mongoose';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { pageOptions, requireUserId } from '../../utils/request';
import {
  getVapidPublicKey,
  removePushSubscription,
  savePushSubscription,
  sendPushToUser,
} from './push.service';

type NotificationType = 'habit_reminder' | 'task_reminder' | 'daily_summary' | 'streak' | 'level_up' | 'system';

interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  readAt?: Date | null;
  data: Record<string, unknown>;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  sourceKey?: string;
  createdAt: Date;
}

interface IDeviceToken extends Document {
  userId: Types.ObjectId;
  token: string;
  platform: 'web' | 'android' | 'ios';
  lastSeenAt: Date;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['habit_reminder', 'task_reminder', 'daily_summary', 'streak', 'level_up', 'system'], required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    data: { type: Schema.Types.Mixed, default: {} },
    scheduledAt: { type: Date, default: null, index: true },
    sentAt: { type: Date, default: null },
    sourceKey: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, scheduledAt: 1 });
notificationSchema.index({ userId: 1, sourceKey: 1 }, { unique: true, sparse: true });

const deviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true },
    platform: { type: String, enum: ['web', 'android', 'ios'], required: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
deviceTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', deviceTokenSchema);

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  scheduledAt?: Date;
  sourceKey?: string;
}): Promise<INotification | null> {
  try {
    return await Notification.create({ ...input, data: input.data ?? {} });
  } catch (err: any) {
    if (err?.code === 11000) return null;
    throw err;
  }
}

export async function sendPushSafe(userId: string, notification: INotification): Promise<void> {
  // إرسال فعلي عبر Web Push (PWA) إلى كل اشتراكات الجهاز،
  // ثم ختم الإشعار بوقت الإرسال.
  await sendPushToUser(userId, {
    title: notification.title,
    body: notification.body,
    // url يُستخدم من الـ Service Worker لفتح التطبيق عند الضغط على الإشعار.
    data: { ...notification.data, url: '/' },
  });
  notification.sentAt = new Date();
  await notification.save();
}

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const router = Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const filter: Record<string, unknown> = { userId };
  if (req.query.unreadOnly === 'true') filter.isRead = false;
  if (typeof req.query.type === 'string') filter.type = req.query.type;
  const { page, limit, skip } = pageOptions(req.query);
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId, isRead: false }),
  ]);
  res.json(successResponse({ items, meta: { page, limit, total, unreadCount } }));
}));

router.patch('/:id/read', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: requireUserId(req) },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) throw new AppError('NOT_FOUND', 404, 'Notification not found');
  res.json(successResponse(notification));
}));

router.patch('/read-all', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await Notification.updateMany({ userId: requireUserId(req), isRead: false }, { isRead: true, readAt: new Date() });
  res.json(successResponse({ updatedCount: result.modifiedCount }));
}));

router.post('/device-token', validate(z.object({ body: z.object({ token: z.string().min(1), platform: z.enum(['web', 'android', 'ios']) }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await DeviceToken.findOneAndUpdate(
    { userId: requireUserId(req), token: req.body.token },
    { platform: req.body.platform, lastSeenAt: new Date() },
    { upsert: true, new: true }
  );
  res.status(201).json(successResponse({ registered: true }));
}));

// ---- Web Push (PWA) ----

const pushSubscriptionBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

/** مفتاح VAPID العام — يطلبه التطبيق قبل إنشاء اشتراك Push. */
router.get('/push/public-key', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json(successResponse({ publicKey: getVapidPublicKey() }));
}));

/** تسجيل اشتراك Push جديد (من شاشة الإعدادات). */
router.post('/push/subscribe', validate(z.object({ body: pushSubscriptionBody })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await savePushSubscription(requireUserId(req), req.body, req.headers['user-agent']);
  res.status(201).json(successResponse({ subscribed: true }));
}));

/** إلغاء اشتراك Push (عند إطفاء مفتاح الإشعارات). */
router.post('/push/unsubscribe', validate(z.object({ body: z.object({ endpoint: z.string().url() }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await removePushSubscription(requireUserId(req), req.body.endpoint);
  res.json(successResponse({ unsubscribed: true }));
}));

export default router;
