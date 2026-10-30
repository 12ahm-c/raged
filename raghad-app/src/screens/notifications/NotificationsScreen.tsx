import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../api/client';
import { LoadingState, palette, ScreenState } from '../../components/ui/States';
import {
  getNotificationPermission,
  usePushNotifications,
} from '../../hooks/usePushNotifications';
import { useNotificationStore } from '../../stores/notificationStore';
import type { NotificationDTO } from '../../types/dto';

// ── Icons & Colors Map ───────────────────────────────────────────────────────
const TYPE_CONFIG: Record<
  NotificationDTO['type'],
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  habit_reminder: {
    label: 'تذكير عادة',
    icon: 'time-outline',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  task_reminder: {
    label: 'تذكير مهمة',
    icon: 'checkbox-outline',
    color: '#059669',
    bg: '#ECFDF5',
  },
  daily_summary: {
    label: 'ملخص اليوم',
    icon: 'pie-chart-outline',
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  streak: {
    label: 'سلسلة حماس',
    icon: 'flame-outline',
    color: '#EA580C',
    bg: '#FFF7ED',
  },
  level_up: {
    label: 'مستوى جديد',
    icon: 'trophy-outline',
    color: '#D97706',
    bg: '#FFFBEB',
  },
  system: {
    label: 'تنبيه نظام',
    icon: 'notifications-outline',
    color: '#475569',
    bg: '#F1F5F9',
  },
};

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;

    return new Intl.DateTimeFormat('ar-SA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return iso;
  }
}

// ── Compact Push Opt-in ─────────────────────────────────────────────────────
function PushBanner() {
  const { isSupported, requestAndSubscribe, isSubscribed } = usePushNotifications();
  const [busy, setBusy] = useState(false);

  if (Platform.OS !== 'web' || !isSupported) return null;
  const currentPermission = getNotificationPermission();
  if (currentPermission === 'granted' && isSubscribed) return null;

  return (
    <View style={styles.pushBanner}>
      <View style={styles.pushBannerInfo}>
        <Ionicons name="notifications-circle" size={24} color={palette.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pushBannerTitle}>تفعيل التنبيهات الفورية</Text>
          <Text style={styles.pushBannerDesc}>لتصلك تذكيرات العادات والمهام في وقتها</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={async () => {
          setBusy(true);
          await requestAndSubscribe();
          setBusy(false);
        }}
        disabled={busy}
        style={styles.pushBannerBtn}
      >
        <Text style={styles.pushBannerBtnText}>{busy ? '...' : 'تفعيل'}</Text>
      </Pressable>
    </View>
  );
}

// ── Notifications Modal Window ──────────────────────────────────────────────
export interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationsModal({ visible, onClose }: NotificationsModalProps) {
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const resetUnread = useNotificationStore((s) => s.resetUnread);
  const decrementBy = useNotificationStore((s) => s.decrementBy);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);

    api
      .listNotifications({ page: 1, limit: 30 })
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setUnreadCount(result.meta.unreadCount);
        void fetchUnreadCount();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'تعذر تحميل الإشعارات.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, fetchUnreadCount]);

  async function handleMarkOne(id: string) {
    try {
      await api.markNotificationRead(id);
      setItems((prev) =>
        prev.map((n) =>
          n._id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      decrementBy(1);
    } catch {
      // Ignored
    }
  }

  async function handleReadAll() {
    setBusy(true);
    try {
      const { updatedCount } = await api.markAllNotificationsRead();
      setItems((prev) =>
        prev.map((n) => ({
          ...n,
          isRead: true,
          readAt: n.readAt ?? new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
      decrementBy(updatedCount);
      resetUnread();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث الإشعارات.');
    } finally {
      setBusy(false);
    }
  }

  const displayedItems =
    filter === 'unread' ? items.filter((n) => !n.isRead) : items;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Dim backdrop tap to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* Floating Window */}
        <View style={styles.windowCard}>
          {/* Header */}
          <View style={styles.windowHeader}>
            <View style={styles.headerRight}>
              <View style={styles.bellIconCircle}>
                <Ionicons name="notifications" size={18} color={palette.primary} />
              </View>
              <View>
                <View style={styles.titleRow}>
                  <Text style={styles.windowTitle}>الإشعارات</Text>
                  {unreadCount > 0 ? (
                    <View style={styles.unreadPill}>
                      <Text style={styles.unreadPillText}>{unreadCount} جديد</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.windowSubtitle}>آخر التنبيهات والتحديثات</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إغلاق"
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={20} color={palette.muted} />
            </Pressable>
          </View>

          {/* Filter Bar & Action */}
          <View style={styles.filterBar}>
            <View style={styles.tabsRow}>
              <Pressable
                onPress={() => setFilter('all')}
                style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filter === 'all' && styles.filterTabTextActive,
                  ]}
                >
                  الكل ({items.length})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setFilter('unread')}
                style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filter === 'unread' && styles.filterTabTextActive,
                  ]}
                >
                  غير مقروء ({unreadCount})
                </Text>
              </Pressable>
            </View>

            {unreadCount > 0 ? (
              <Pressable
                onPress={handleReadAll}
                disabled={busy}
                style={styles.readAllBtn}
              >
                <Ionicons name="checkmark-done" size={14} color={palette.primary} />
                <Text style={styles.readAllText}>قراءة الكل</Text>
              </Pressable>
            ) : null}
          </View>

          <PushBanner />

          {/* List Content */}
          {loading ? (
            <View style={styles.stateContainer}>
              <LoadingState label="جارٍ جلب الإشعارات..." />
            </View>
          ) : error ? (
            <View style={styles.stateContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : displayedItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={32} color={palette.muted} />
              </View>
              <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
              <Text style={styles.emptySub}>
                {filter === 'unread'
                  ? 'لقد قرأت جميع الإشعارات!'
                  : 'ليس لديك أي إشعارات مسجلة حالياً.'}
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.itemsScroll}
              contentContainerStyle={styles.itemsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {displayedItems.map((item) => {
                const conf = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.system;
                return (
                  <View
                    key={item._id}
                    style={[
                      styles.notificationItem,
                      !item.isRead && styles.notificationItemUnread,
                    ]}
                  >
                    <View style={[styles.typeIconBox, { backgroundColor: conf.bg }]}>
                      <Ionicons name={conf.icon} size={18} color={conf.color} />
                    </View>

                    <View style={styles.itemContent}>
                      <View style={styles.itemTopRow}>
                        <Text style={[styles.itemTypeLabel, { color: conf.color }]}>
                          {conf.label}
                        </Text>
                        <Text style={styles.itemTime}>{formatDate(item.createdAt)}</Text>
                      </View>

                      <Text style={styles.itemTitle}>{item.title}</Text>
                      <Text style={styles.itemBody} numberOfLines={3}>
                        {item.body}
                      </Text>

                      {!item.isRead ? (
                        <Pressable
                          onPress={() => void handleMarkOne(item._id)}
                          style={styles.markReadBtn}
                        >
                          <Ionicons name="checkmark" size={14} color={palette.primary} />
                          <Text style={styles.markReadBtnText}>تعيين كمقروء</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Standalone Screen Fallback (renders the compact window on its screen) ────
export function NotificationsScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.screenFallback}>
      <NotificationsModal
        visible={true}
        onClose={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenFallback: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  windowCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 25,
    elevation: 8,
    display: 'flex',
    flexDirection: 'column',
  },
  windowHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  bellIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  windowTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    writingDirection: 'rtl',
  },
  unreadPill: {
    backgroundColor: palette.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  unreadPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  windowSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    writingDirection: 'rtl',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tabsRow: {
    flexDirection: 'row-reverse',
    gap: 6,
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  readAllBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  readAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
  },
  pushBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  pushBannerInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pushBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  pushBannerDesc: {
    fontSize: 10,
    color: '#3B82F6',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 1,
  },
  pushBannerBtn: {
    backgroundColor: palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pushBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  stateContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  itemsScroll: {
    flex: 1,
  },
  itemsScrollContent: {
    padding: 14,
    gap: 10,
  },
  notificationItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  notificationItemUnread: {
    backgroundColor: '#F8FAFF',
    borderColor: '#DBEAFE',
  },
  typeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  itemTypeLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  itemTime: {
    fontSize: 10,
    color: '#94A3B8',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 3,
  },
  itemBody: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 18,
  },
  markReadBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  markReadBtnText: {
    fontSize: 11,
    color: palette.primary,
    fontWeight: '700',
  },
});
