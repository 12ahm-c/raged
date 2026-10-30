/**
 * notificationStore
 * يدير عداد الإشعارات غير المقروءة عالميًا ليُعرض في رأس التطبيق.
 * يُحدَّث عند:
 * - تحميل شاشة الإشعارات
 * - قراءة إشعار أو قراءة الكل
 * - استقبال push notification من الـ Service Worker
 */
import { create } from 'zustand';
import { api } from '../api/client';

interface NotificationState {
  unreadCount: number;
  /** هل تم تحميل العدد مرة واحدة على الأقل؟ */
  loaded: boolean;
  /** حالة طلب التحميل الجاري */
  fetching: boolean;
  fetchUnreadCount: () => Promise<void>;
  /** يُستدعى بعد قراءة إشعار أو إشعارات */
  decrementBy: (n: number) => void;
  /** يُستدعى بعد قراءة الكل */
  resetUnread: () => void;
  /** يُستدعى عند استقبال push notification جديد */
  incrementUnread: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  loaded: false,
  fetching: false,

  async fetchUnreadCount() {
    set({ fetching: true });
    try {
      const result = await api.listNotifications({ page: 1, limit: 1 });
      set({ unreadCount: result.meta.unreadCount, loaded: true });
    } catch {
      // نتجاهل الخطأ هنا — العداد يبقى كما هو
    } finally {
      set({ fetching: false });
    }
  },

  decrementBy(n) {
    set((state) => ({ unreadCount: Math.max(0, state.unreadCount - n) }));
  },

  resetUnread() {
    set({ unreadCount: 0 });
  },

  incrementUnread() {
    set((state) => ({ unreadCount: state.unreadCount + 1 }));
  },
}));
