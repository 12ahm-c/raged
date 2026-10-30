/**
 * usePushNotifications
 *
 * يدير دورة حياة إشعارات Web Push للـ PWA:
 * 1. يسجّل الـ Service Worker (مرة واحدة عند بدء التطبيق).
 * 2. يطلب إذن الإشعارات من المستخدم.
 * 3. يشترك في Web Push (VAPID) ويسجّل الاشتراك في الخادم.
 * 4. يستمع لرسائل الـ SW (pushsubscriptionchange، إشعارات جديدة).
 *
 * iOS Safari:
 * - يتطلب iOS 16.4+ مع التطبيق مثبّتًا كـ PWA من الشاشة الرئيسية.
 * - Notification.permission يكون 'default' قبل الطلب (لا يوجد 'granted' تلقائيًا).
 * - يجب طلب الإذن من خلال تفاعل مباشر من المستخدم (onPress).
 * - PushManager.subscribe يتطلب userVisibleOnly: true.
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { api } from '../api/client';
import { useNotificationStore } from '../stores/notificationStore';

/** هل المتصفح يدعم Web Push؟ */
export function isPushSupported(): boolean {
  if (Platform.OS !== 'web') return false;
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** الحالة الحالية لإذن الإشعارات */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/** تحويل base64url إلى Uint8Array (مطلوب لـ VAPID) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface UsePushNotificationsResult {
  /** هل الإشعارات مدعومة في هذه البيئة؟ */
  isSupported: boolean;
  /** إذن الإشعارات الحالي */
  permission: NotificationPermission | 'unsupported';
  /** هل التطبيق مشترك حاليًا في Push؟ */
  isSubscribed: boolean;
  /**
   * يطلب إذن الإشعارات ثم يشترك في Push.
   * استدعِه عند ضغط المستخدم على زر "تفعيل الإشعارات".
   * @returns 'granted' | 'denied' | 'error'
   */
  requestAndSubscribe: () => Promise<'granted' | 'denied' | 'error'>;
  /** يلغي اشتراك Push ويُبلغ الخادم */
  unsubscribe: () => Promise<void>;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const supported = isPushSupported();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const incrementUnread = useNotificationStore((s) => s.incrementUnread);

  // استمع لرسائل الـ Service Worker
  useEffect(() => {
    if (!supported) return;

    function onMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== 'object') return;
      const { type } = event.data as { type?: string };

      if (type === 'PUSH_RECEIVED') {
        incrementUnread();
      }

      if (type === 'PUSH_SUBSCRIPTION_RENEWED') {
        const sub = event.data.subscription as PushSubscriptionJSON | undefined;
        if (sub?.endpoint && sub.keys) {
          void api
            .subscribePush({
              endpoint: sub.endpoint,
              keys: {
                p256dh: (sub.keys as Record<string, string>).p256dh ?? '',
                auth: (sub.keys as Record<string, string>).auth ?? '',
              },
            })
            .catch(() => {
              /* تجاهل أخطاء التجديد الصامت */
            });
        }
      }
    }

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, [supported, incrementUnread]);

  // تحقق من حالة الاشتراك الحالية عند التحميل
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setIsSubscribed(sub !== null);
      } catch {
        // تجاهل
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const requestAndSubscribe = useCallback(async (): Promise<
    'granted' | 'denied' | 'error'
  > => {
    if (!supported) return 'error';

    try {
      // 1. اطلب الإذن
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return 'denied';
      }

      // 2. جهّز الـ Service Worker
      const reg = await navigator.serviceWorker.ready;

      // 3. احصل على VAPID public key من الخادم
      const publicKey = await api.getPushPublicKey();
      if (!publicKey) {
        // لا VAPID مُعيَّن في الخادم — الإشعارات ستكون in-app فقط
        return 'granted';
      }

      // 4. اشترك
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
      });

      const json = subscription.toJSON();
      const keys = json.keys as Record<string, string> | undefined;

      if (json.endpoint && keys?.p256dh && keys?.auth) {
        await api.subscribePush({
          endpoint: json.endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
        });
      }

      setIsSubscribed(true);
      return 'granted';
    } catch {
      return 'error';
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
        setIsSubscribed(false);
      }
    } catch {
      // تجاهل
    }
  }, [supported]);

  return {
    isSupported: supported,
    permission: getNotificationPermission(),
    isSubscribed,
    requestAndSubscribe,
    unsubscribe,
  };
}

/**
 * registerServiceWorker
 * يسجّل الـ Service Worker — يُستدعى مرة واحدة عند بدء التطبيق.
 * آمن للاستدعاء أكثر من مرة (المتصفح يُعيد استخدام التسجيل الموجود).
 */
export async function registerServiceWorker(): Promise<void> {
  if (Platform.OS !== 'web') return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    // فشل تسجيل الـ SW لا يجب أن يوقف التطبيق
  }
}
