import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import {
  commonStyles,
  LoadingState,
  palette,
  PrimaryButton,
  ScreenState,
} from '../../components/ui/States';
import type { RootStackParamList } from '../../navigation/types';
import type { HabitDetailDTO, HabitLogDTO } from '../../types/dto';
import { getApiErrorMessage } from '../../utils/apiError';
import { specialPageFor, openHabitPage } from '../../utils/habitSpecialRoutes';
import { goBackSafe } from '../../utils/goBackSafe';

function displayDate(value: string): string {
  return new Date(value).toLocaleDateString('ar-MR', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function logStatusLabel(status: HabitLogDTO['status']): string {
  switch (status) {
    case 'completed':
      return 'مكتملة ✓';
    case 'missed':
      return 'لم تُنفذ ✕';
    case 'skipped':
      return 'متجاوزة';
    case 'pending':
      return 'قيد الانتظار';
    default:
      return status;
  }
}

function getLogStatusStyle(status: HabitLogDTO['status']) {
  switch (status) {
    case 'completed':
      return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
    case 'missed':
      return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' };
    case 'skipped':
      return { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' };
    default:
      return { bg: '#EFF6FF', text: '#2563EB', border: '#DBEAFE' };
  }
}

export function HabitDetailScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'HabitDetail'>>();
  const { id } = route.params;
  const [detail, setDetail] = useState<HabitDetailDTO | null>(null);
  const [history, setHistory] = useState<HabitLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scheduleDay, setScheduleDay] = useState('');
  const [remindDaysBefore, setRemindDaysBefore] = useState('3');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [habitResult, historyResult] = await Promise.all([
        api.getHabit(id),
        api.getHabitHistory(id),
      ]);
      setDetail(habitResult);
      setHistory(historyResult);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function addSchedule() {
    setScheduleMessage('');
    if (!detail || detail.habit.type !== 'seasonal') return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDay)) {
      setScheduleMessage('أدخل التاريخ بصيغة YYYY-MM-DD.');
      return;
    }
    const date = new Date(`${scheduleDay}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== scheduleDay) {
      setScheduleMessage('التاريخ غير صالح.');
      return;
    }
    const reminder = Number(remindDaysBefore);
    if (!Number.isInteger(reminder) || reminder < 0) {
      setScheduleMessage('أدخل عدد أيام صحيحاً غير سالب.');
      return;
    }

    setSavingSchedule(true);
    try {
      await api.createSeasonalSchedule(id, {
        day: date.toISOString(),
        remindDaysBefore: reminder,
      });
      setScheduleMessage('تم حفظ الموعد الموسمي بنجاح.');
      setScheduleDay('');
    } catch (requestError) {
      setScheduleMessage(getApiErrorMessage(requestError));
    } finally {
      setSavingSchedule(false);
    }
  }

  if (loading && !detail) return <LoadingState label="جارٍ تحميل تفاصيل العادة..." />;
  if (error && !detail) {
    return (
      <ScreenState
        title="تعذر تحميل تفاصيل العادة"
        message={error}
        actionLabel="إعادة المحاولة"
        onAction={() => void load()}
      />
    );
  }
  if (!detail) return <ScreenState title="العادة غير متاحة" message={error} />;

  const hasSpecial = specialPageFor(detail.habit.config?.special);

  return (
    <View style={commonStyles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Navigation Header */}
        <View style={styles.topNav}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="العودة"
            onPress={() => goBackSafe(navigation)}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-forward" size={20} color={palette.primary} />
            <Text style={styles.backBtnText}>العودة</Text>
          </Pressable>
          <Text style={styles.navTitle} numberOfLines={1}>
            {detail.habit.name}
          </Text>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIconBox}>
              <Ionicons name="sparkles" size={24} color={palette.primary} />
            </View>
            <View style={styles.heroTitleBox}>
              <Text style={styles.heroTitle}>{detail.habit.name}</Text>
              <View style={styles.tagsRow}>
                <View style={styles.tagBlue}>
                  <Text style={styles.tagBlueText}>
                    {detail.habit.type === 'daily' ? 'عادة يومية' : 'عادة موسمية'}
                  </Text>
                </View>
                {detail.habit.suggestedTime ? (
                  <View style={styles.tagAmber}>
                    <Text style={styles.tagAmberText}>{detail.habit.suggestedTime}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {detail.habit.details ? (
            <View style={styles.detailsBox}>
              <Text style={styles.detailsText}>{detail.habit.details}</Text>
            </View>
          ) : null}

          {/* Stats Grid: 4 cards */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-done-circle" size={24} color="#10B981" />
              <Text style={styles.statValue}>{detail.stats.doneDays}</Text>
              <Text style={styles.statLabel}>أيام الإنجاز</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="trending-up" size={24} color={palette.primary} />
              <Text style={styles.statValue}>{detail.stats.successRate}%</Text>
              <Text style={styles.statLabel}>نسبة النجاح</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="flame" size={24} color="#F59E0B" />
              <Text style={styles.statValue}>{detail.streak?.current ?? 0}</Text>
              <Text style={styles.statLabel}>السلسلة الحالية</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="trophy" size={24} color="#8B5CF6" />
              <Text style={styles.statValue}>{detail.streak?.longest ?? 0}</Text>
              <Text style={styles.statLabel}>أطول سلسلة</Text>
            </View>
          </View>

          {/* Special Page Link Button */}
          {hasSpecial ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => openHabitPage(navigation, detail.habit._id, detail.habit.config?.special)}
              style={styles.specialPageAction}
            >
              <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
              <Text style={styles.specialPageActionText}>
                فتح صفحة العادة الخاصة المخصصة
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* Seasonal Schedule Form (if seasonal) */}
        {detail.habit.type === 'seasonal' ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="calendar-outline" size={22} color={palette.primary} />
              <Text style={styles.sectionTitle}>جدولة العادة الموسمية</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>تاريخ التنفيذ</Text>
              <TextInput
                accessibilityLabel="تاريخ التنفيذ"
                placeholder="YYYY-MM-DD (مثال: 2026-11-15)"
                placeholderTextColor={palette.muted}
                value={scheduleDay}
                onChangeText={setScheduleDay}
                style={styles.inputField}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>التذكير قبل الموعد (بالأيام)</Text>
              <TextInput
                accessibilityLabel="التذكير قبل الموعد بالأيام"
                keyboardType="number-pad"
                value={remindDaysBefore}
                onChangeText={setRemindDaysBefore}
                style={styles.inputField}
              />
            </View>

            {scheduleMessage ? (
              <View style={styles.alertNotice}>
                <Text style={styles.alertNoticeText}>{scheduleMessage}</Text>
              </View>
            ) : null}

            <PrimaryButton
              label={savingSchedule ? 'جارٍ الحفظ...' : 'حفظ الموعد الموسمي'}
              disabled={savingSchedule}
              onPress={() => void addSchedule()}
            />
          </View>
        ) : null}

        {/* Logs History Timeline */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="time-outline" size={22} color={palette.primary} />
            <Text style={styles.sectionTitle}>سجل إنجاز العادة</Text>
          </View>

          {history.length === 0 ? (
            <Text style={styles.emptyLogsText}>
              لا توجد سجلات سابقة لهذه العادة بعد. سيظهر السجل عند تسجيل إنجازها.
            </Text>
          ) : (
            history.map((log) => {
              const statusStyle = getLogStatusStyle(log.status);
              return (
                <View key={log._id} style={styles.logItem}>
                  <View style={[styles.logStatusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
                    <Text style={[styles.logStatusText, { color: statusStyle.text }]}>
                      {logStatusLabel(log.status)}
                    </Text>
                  </View>

                  <View style={styles.logDetails}>
                    <Text style={styles.logDateText}>{displayDate(log.date)}</Text>
                    {log.note ? <Text style={styles.logNoteText}>{log.note}</Text> : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: 16,
  },
  topNav: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  backBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backBtnText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.text,
    flex: 1,
    textAlign: 'left',
    marginRight: 12,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    gap: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  heroHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  heroIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleBox: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  tagsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  tagBlue: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagBlueText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  tagAmber: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagAmberText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '700',
  },
  detailsBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  detailsText: {
    fontSize: 14,
    color: palette.text,
    textAlign: 'right',
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  statLabel: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
  },
  specialPageAction: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.primary,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  specialPageActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'right',
  },
  inputField: {
    minHeight: 48,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    color: palette.text,
    textAlign: 'right',
    fontSize: 15,
  },
  alertNotice: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  alertNoticeText: {
    color: palette.primary,
    fontSize: 13,
    textAlign: 'right',
    fontWeight: '600',
  },
  logItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  logDetails: {
    alignItems: 'flex-end',
    flex: 1,
  },
  logDateText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  logNoteText: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 2,
  },
  logStatusBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  logStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyLogsText: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'right',
    lineHeight: 22,
  },
});
