import mongoose, { Document, Schema, Types } from 'mongoose';
import webpush from 'web-push';
import { config } from '../../config';

/**
 * Web Push لتطبيق PWA (مثبّت من Safari على الشاشة الرئيسية):
 * - iOS 16.4+ و Android تدعمان الاشتراك عبر Service Worker.
 * - مفاتيح VAPID تُولَّد مرة واحدة عبر `npm run vapid:keys` وتوضع في .env.
 */

export interface IPushSubscription extends Document {
  userId: Types.ObjectId;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  createdAt: Date;
}

const pushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PushSubscription = mongoose.model<IPushSubscription>(
  'PushSubscription',
  pushSubscriptionSchema
);

let vapidReady = false;
let warnedMissingVapid = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!config.vapidPublicKey || !config.vapidPrivateKey) {
    if (!warnedMissingVapid) {
      warnedMissingVapid = true;
      console.warn(
        '[Push] VAPID keys missing — set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY (run `npm run vapid:keys`). Web push disabled, in-app notifications still work.'
      );
    }
    return false;
  }
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
  vapidReady = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  return config.vapidPublicKey || null;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** حفظ (أو تحديث) اشتراك Push القادم من المتصفح/الجهاز. */
export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
): Promise<void> {
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      userId: new mongoose.Types.ObjectId(userId),
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/** إزالة اشتراك (عند إيقاف الإشعارات أو انتهاء صلاحيته). */
export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await PushSubscription.deleteOne({ userId, endpoint });
}

/**
 * إرسال إشعار Push لكل اشتراكات المستخدم.
 * الاشتراكات المنتهية (404/410) تُحذف تلقائيًا.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!ensureVapid()) return 0;
  const subscriptions = await PushSubscription.find({ userId });
  if (!subscriptions.length) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          body,
          { TTL: 24 * 60 * 60, urgency: 'normal' }
        );
        sent += 1;
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // انتهت صلاحية الاشتراك على الجهاز — نظّفه.
          await PushSubscription.deleteOne({ _id: subscription._id });
        } else {
          console.warn('[Push] send failed:', statusCode ?? error);
        }
      }
    })
  );
  return sent;
}
