import { Platform } from 'react-native';
import { api } from '../api/client';

/**
 * إدارة اشتراك Web Push لتطبيق PWA (مثبّت على الشاشة الرئيسية من Safari):
 * - iOS 16.4+ و Android Chrome يدعمان Push عبر Service Worker.
 * - يعمل فقط على الويب؛ على المنصات الأخرى يُرجع false بصمت.
 *
 * ملاحظة iOS: الإذن لا يُطلب إلا من مستخدم حقيقي (نقرة) ومن تطبيق
 * مثبّت على الشاشة الرئيسية — لذلك الاستدعاء من مفتاح الإشعارات في الإعدادات.
 */

interface WebPushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

function isWebPushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** هل الإشعارات مفعّلة حاليًا على هذا الجهاز؟ */
export async function isPushEnabled(): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  try {
    const permission = Notification.permission === 'granted';
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    return permission && Boolean(subscription);
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * تفعيل الإشعارات: تسجيل الـ Service Worker + طلب الإذن + إنشاء اشتراك Push
 * وتسجيله لدى الخادم. يجب استدعاؤها من مستخدم حقيقي (نقرة) على iOS.
 */
export async function enablePushNotifications(): Promise<{ ok: boolean; reason?: string }> {
  if (!isWebPushSupported()) {
    return { ok: false, reason: 'الإشعارات غير مدعومة في هذا المتصفح' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'لم يتم منح إذن الإشعارات من المتصفح' };
    }

    // تسجيل الـ Service Worker الذي يستقبل Push ويعرض الإشعار.
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // مفتاح VAPID من الخادم (لا حاجة لمتغيرات بيئة في الواجهة).
    const publicKey = await api.getPushPublicKey();
    if (!publicKey) {
      return {
        ok: false,
        reason: 'الخادم غير مهيأ للإشعارات (مفاتيح VAPID غير مضبوطة)',
      };
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = subscription.toJSON() as WebPushSubscriptionJSON;
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: 'تعذر إنشاء اشتراك الإشعارات على هذا الجهاز' };
    }

    await api.subscribePush(json);
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: 'تعذر تفعيل الإشعارات. على iPhone: أضِف التطبيق إلى الشاشة الرئيسية أولًا ثم أعد المحاولة.',
    };
  }
}

/** إيقاف الإشعارات: إلغاء الاشتراك من المتصفح ومن الخادم. */
export async function disablePushNotifications(): Promise<void> {
  if (!isWebPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await api.unsubscribePush(endpoint);
    }
  } catch {
    // الإلغاء صامت — يمكن تجربته لاحقًا.
  }
}
