import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, type EndOfDayDisplayDTO } from '../../api/client';
import {
  commonStyles,
  LoadingState,
  palette,
  PrimaryButton,
  ScreenState,
} from '../../components/ui/States';
import type { RootStackParamList } from '../../navigation/types';
import type { DailyHabitItemDTO, DailyResponseDTO, TaskDTO } from '../../types/dto';
import { getApiErrorMessage } from '../../utils/apiError';
import { openHabitPage } from '../../utils/habitSpecialRoutes';
import { optimisticallyCompleteHabit, reconcileCompletedHabit } from '../../utils/dailyState';

function localDateIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nouakchott',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T00:00:00.000Z`;
}

function canRequestEndOfDay(): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Nouakchott',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .find((part) => part.type === 'hour')?.value
  );
  return hour >= 23;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('ar-MR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function statusLabel(status: DailyHabitItemDTO['logStatus']): string {
  switch (status) {
    case 'completed':
      return 'مكتملة';
    case 'missed':
      return 'لم تُنفذ';
    case 'skipped':
      return 'مؤجلة';
    default:
      return 'بانتظار التنفيذ';
  }
}

function moodLabel(mood: EndOfDayDisplayDTO['mood']): string | null {
  if (mood === 'praise') return 'تقدير';
  if (mood === 'encourage') return 'تشجيع';
  if (mood === 'blame') return 'تأنيب';
  return null;
}

function CircularProgress({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <View style={styles.circleOuter}>
      <View style={styles.circleTrack}>
        <View style={styles.indicatorDot} />
        <Text style={styles.circleText}>{clamped}%</Text>
      </View>
    </View>
  );
}

function HabitItem({
  habit,
  busy,
  onOpen,
  onComplete,
}: {
  habit: DailyHabitItemDTO;
  busy: boolean;
  onOpen: () => void;
  onComplete: () => void;
}) {
  const complete = habit.logStatus === 'completed';

  return (
    <View style={styles.habitCard}>
      {/* Time Badge on the right (in RTL) */}
      <View style={styles.timeBadge}>
        <Text style={styles.timeBadgeText}>
          {habit.suggestedTime || 'مرن'}
        </Text>
      </View>

      {/* Habit Title & Subtext */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`فتح تفاصيل ${habit.name}`}
        onPress={onOpen}
        style={styles.habitContent}
      >
        <Text style={styles.habitName} numberOfLines={1}>
          {habit.name}
        </Text>
        <Text
          style={[
            styles.habitStatus,
            complete && styles.habitStatusComplete,
            habit.logStatus === 'missed' && styles.habitStatusMissed,
          ]}
        >
          {statusLabel(habit.logStatus)}
        </Text>
      </Pressable>

      {/* Checkbox on the left */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${complete ? 'تم إنجاز' : 'إنجاز'} ${habit.name}`}
        accessibilityState={{ disabled: complete || busy }}
        disabled={complete || busy}
        onPress={onComplete}
        style={({ pressed }) => [
          styles.checkCircle,
          complete && styles.checkCircleComplete,
          busy && styles.checkCircleBusy,
          pressed && !complete && !busy && styles.checkCirclePressed,
        ]}
      >
        {complete ? (
          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
        ) : (
          <Ionicons name="checkmark" size={17} color="#93C5FD" />
        )}
      </Pressable>
    </View>
  );
}

function TaskItem({
  task,
  busy,
  onStatusChange,
}: {
  task: TaskDTO;
  busy: boolean;
  onStatusChange: (status: TaskDTO['status']) => void;
}) {
  const isDone = task.status === 'done';
  return (
    <View style={styles.habitCard}>
      <View style={styles.timeBadge}>
        <Text style={styles.timeBadgeText}>
          {task.startTime || 'مهمة'}
        </Text>
      </View>

      <View style={styles.habitContent}>
        <Text style={[styles.habitName, isDone && styles.taskDoneText]} numberOfLines={1}>
          {task.title}
        </Text>
        <Text style={styles.habitStatus}>
          {isDone ? 'مكتملة ✓' : task.status === 'deferred' ? 'مؤجلة' : 'قيد التنفيذ'}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isDone ? `إعادة فتح ${task.title}` : `إنجاز ${task.title}`}
        disabled={busy}
        onPress={() => onStatusChange(isDone ? 'todo' : 'done')}
        style={[styles.checkCircle, isDone && styles.checkCircleComplete]}
      >
        {isDone ? (
          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
        ) : (
          <Ionicons name="checkmark" size={17} color="#93C5FD" />
        )}
      </Pressable>
    </View>
  );
}

export function TodayScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [daily, setDaily] = useState<DailyResponseDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyHabitId, setBusyHabitId] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [endOfDay, setEndOfDay] = useState<EndOfDayDisplayDTO | null>(null);
  const [endOfDayLoading, setEndOfDayLoading] = useState(false);
  const [endOfDayError, setEndOfDayError] = useState('');

  const date = localDateIso();
  const endOfDayAvailable = canRequestEndOfDay();

  const loadDaily = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await api.getDaily(date);
      setDaily(result);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      void loadDaily();
    }, [loadDaily])
  );

  async function completeHabit(habit: DailyHabitItemDTO) {
    if (!daily || busyHabitId) return;
    const previous = daily;
    const priorHabit = daily.habits.find((item) => item._id === habit._id);
    if (!priorHabit || priorHabit.logStatus === 'completed') return;

    setSuccess('');
    setError('');
    setBusyHabitId(habit._id);
    setDaily(optimisticallyCompleteHabit(daily, habit._id));
    try {
      const log = habit.logId
        ? await api.updateHabitLog(habit.logId, { status: 'completed' })
        : (
            await api.createHabitLog({
              habitId: habit._id,
              date,
              status: 'completed',
            })
          ).log;
      setDaily((current) =>
        current
          ? reconcileCompletedHabit(
              current,
              habit._id,
              log._id,
              log.status
            )
          : current
      );
      setSuccess('سُجّل إنجاز العادة بنجاح!');
      await loadDaily(true);
    } catch (requestError) {
      setDaily(previous);
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusyHabitId(null);
    }
  }

  async function changeTaskStatus(task: TaskDTO, status: TaskDTO['status']) {
    if (!daily || busyTaskId) return;
    const previous = daily;
    setBusyTaskId(task._id);
    setError('');
    setSuccess('');
    setDaily({
      ...daily,
      tasks: daily.tasks.map((item) => item._id === task._id ? { ...item, status } : item),
    });
    try {
      const result = await api.updateTaskStatus(task._id, { status });
      setDaily((current) => current ? {
        ...current,
        tasks: current.tasks.map((item) => item._id === task._id ? result : item),
      } : current);
      await loadDaily(true);
    } catch (requestError) {
      setDaily(previous);
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusyTaskId(null);
    }
  }

  async function loadEndOfDay() {
    setEndOfDayLoading(true);
    setEndOfDayError('');
    setEndOfDay(null);
    try {
      setEndOfDay(await api.getEndOfDay(date));
    } catch (requestError) {
      setEndOfDayError(getApiErrorMessage(requestError));
    } finally {
      setEndOfDayLoading(false);
    }
  }

  const baseHabits = useMemo(
    () => (daily ? daily.habits.filter((habit) => !habit.isHobby) : []),
    [daily]
  );
  const hobbyHabits = useMemo(
    () => (daily ? daily.habits.filter((habit) => habit.isHobby) : []),
    [daily]
  );

  const completionPercent = useMemo(() => {
    if (!daily || !daily.summary.totalItems) return 0;
    return Math.round((daily.summary.completed / daily.summary.totalItems) * 100);
  }, [daily]);

  if (loading && !daily) return <LoadingState label="جارٍ تحميل يومك..." />;
  if (error && !daily) {
    return (
      <ScreenState
        title="تعذر تحميل بيانات اليوم"
        message={error}
        actionLabel="إعادة المحاولة"
        onAction={() => void loadDaily()}
      />
    );
  }
  if (!daily) return <ScreenState title="لا توجد بيانات لليوم" message={error} />;

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void loadDaily(true)}
          colors={[palette.primary]}
          tintColor={palette.primary}
        />
      }
    >
      {/* Top Header Row: Day Title & Date on Right, Refresh Button on Left */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleBox}>
          <Text style={styles.pageTitle}>يومي</Text>
          <Text style={styles.pageSubtitle}>{formatDate(daily.date)}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="تحديث بيانات اليوم"
          onPress={() => void loadDaily(true)}
          style={({ pressed }) => [
            styles.refreshPill,
            pressed && styles.refreshPillPressed,
          ]}
        >
          <Ionicons name="refresh-outline" size={17} color={palette.primary} />
          <Text style={styles.refreshPillText}>تحديث</Text>
        </Pressable>
      </View>

      {/* Hero Progress Card (Gradient Blue) */}
      <LinearGradient
        colors={['#1E40AF', '#2563EB', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTop}>
          <CircularProgress percent={completionPercent} />
          <View style={styles.heroTexts}>
            <Text style={styles.heroTitle}>تقدّم اليوم</Text>
            <Text style={styles.heroSubtitle}>
              {daily.summary.completed} من {daily.summary.totalItems} عنصراً مُنجزاً
            </Text>
          </View>
        </View>

        {/* 3 Translucent Stats Boxes */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="reorder-three-outline" size={22} color="#FFFFFF" />
            <Text style={styles.statNumber}>{daily.summary.totalItems}</Text>
            <Text style={styles.statLabel}>العناصر</Text>
          </View>

          <View style={styles.statBox}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />
            <Text style={styles.statNumber}>{daily.summary.completed}</Text>
            <Text style={styles.statLabel}>المكتمل</Text>
          </View>

          <View style={styles.statBox}>
            <Ionicons name="star-outline" size={22} color="#FFFFFF" />
            <Text style={styles.statNumber}>{daily.summary.points}</Text>
            <Text style={styles.statLabel}>النقاط</Text>
          </View>
        </View>
      </LinearGradient>

      {success ? (
        <View style={styles.alertSuccess}>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          <Text style={styles.alertSuccessText}>{success}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.alertError}>
          <Ionicons name="alert-circle" size={18} color="#EF4444" />
          <Text style={styles.alertErrorText}>{error}</Text>
        </View>
      ) : null}

      {/* Section Header: عادات اليوم & الأساسيات Badge */}
      <View style={styles.sectionHeader}>
        <View style={styles.badgeAmber}>
          <Text style={styles.badgeAmberText}>الأساسيات • {baseHabits.length}</Text>
        </View>
        <Text style={styles.sectionTitle}>عادات اليوم</Text>
      </View>

      {/* Habits List */}
      {baseHabits.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="sparkles-outline" size={32} color={palette.muted} />
          <Text style={styles.emptyTitle}>لا توجد عادات أساسية لهذا اليوم</Text>
          <Pressable
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Main', { screen: 'Habits' })}
          >
            <Text style={styles.emptyButtonText}>إدارة العادات</Text>
          </Pressable>
        </View>
      ) : (
        baseHabits.map((habit) => (
          <HabitItem
            key={habit._id}
            habit={habit}
            busy={busyHabitId === habit._id}
            onOpen={() => openHabitPage(navigation, habit._id, habit.config?.special)}
            onComplete={() => void completeHabit(habit)}
          />
        ))
      )}

      {/* Hobbies Section (if any) */}
      {hobbyHabits.length > 0 ? (
        <>
          <View style={[styles.sectionHeader, { marginTop: 22 }]}>
            <View style={[styles.badgeAmber, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <Text style={[styles.badgeAmberText, { color: palette.primary }]}>
                الهوايات • {hobbyHabits.length}
              </Text>
            </View>
            <Text style={styles.sectionTitle}>الهوايات</Text>
          </View>
          {hobbyHabits.map((habit) => (
            <HabitItem
              key={habit._id}
              habit={habit}
              busy={busyHabitId === habit._id}
              onOpen={() => openHabitPage(navigation, habit._id, habit.config?.special)}
              onComplete={() => void completeHabit(habit)}
            />
          ))}
        </>
      ) : null}

      {/* Tasks Section */}
      <View style={[styles.sectionHeader, { marginTop: 22 }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Tasks')}
          style={styles.badgeLink}
        >
          <Text style={styles.badgeLinkText}>إدارة المهام ←</Text>
        </Pressable>
        <Text style={styles.sectionTitle}>المهام اليومية</Text>
      </View>

      {daily.tasks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>لا توجد مهام إضافية لليوم.</Text>
        </View>
      ) : (
        daily.tasks.map((task) => (
          <TaskItem
            key={task._id}
            task={task}
            busy={busyTaskId === task._id}
            onStatusChange={(status) => void changeTaskStatus(task, status)}
          />
        ))
      )}

      {/* End of Day Evaluation Card */}
      <View style={styles.evaluationCard}>
        <View style={styles.evaluationHeader}>
          <Ionicons name="moon-outline" size={22} color={palette.primary} />
          <Text style={styles.evaluationTitle}>تقييم نهاية اليوم</Text>
        </View>
        <Text style={styles.evaluationDesc}>
          {daily.endOfDay.message ?? 'يتاح تقييم اليوم وتصفية النقاط بعد الساعة 23:00 مساءً.'}
        </Text>

        {endOfDay ? <EndOfDayDetails data={endOfDay} /> : null}

        {endOfDayError ? (
          <Text style={styles.alertErrorText}>{endOfDayError}</Text>
        ) : null}

        <PrimaryButton
          label={
            endOfDayLoading
              ? 'جارٍ تحميل التقييم...'
              : endOfDayAvailable
                ? 'عرض التقييم النهائي'
                : 'يتاح التقييم بعد 23:00'
          }
          onPress={() => void loadEndOfDay()}
          disabled={endOfDayLoading || !endOfDayAvailable}
        />
      </View>
    </ScrollView>
  );
}

function EndOfDayDetails({ data }: { data: EndOfDayDisplayDTO }) {
  return (
    <View style={styles.evalBox}>
      {data.ratePercent !== undefined ? (
        <View style={styles.evalStatRow}>
          <Text style={styles.evalStatValue}>{data.ratePercent}%</Text>
          <Text style={styles.evalStatLabel}>معدل الإنجاز</Text>
        </View>
      ) : null}
      {data.backendScore !== undefined ? (
        <View style={styles.evalStatRow}>
          <Text style={styles.evalStatValue}>{data.backendScore}%</Text>
          <Text style={styles.evalStatLabel}>التقييم العام</Text>
        </View>
      ) : null}
      {data.pointsEarned !== undefined ? (
        <View style={styles.evalStatRow}>
          <Text style={[styles.evalStatValue, { color: '#10B981' }]}>+{data.pointsEarned}</Text>
          <Text style={styles.evalStatLabel}>النقاط المكتسبة</Text>
        </View>
      ) : null}
      {data.pointsLost !== undefined ? (
        <View style={styles.evalStatRow}>
          <Text style={[styles.evalStatValue, { color: '#EF4444' }]}>-{data.pointsLost}</Text>
          <Text style={styles.evalStatLabel}>النقاط المخصومة</Text>
        </View>
      ) : null}
      {data.mood ? (
        <View style={styles.evalStatRow}>
          <Text style={styles.evalStatValue}>{moodLabel(data.mood) ?? data.mood}</Text>
          <Text style={styles.evalStatLabel}>الحالة</Text>
        </View>
      ) : null}
      {data.message ? (
        <Text style={styles.evalMessage}>{data.message}</Text>
      ) : null}
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
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleBox: {
    alignItems: 'flex-end',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  pageSubtitle: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 2,
    textAlign: 'right',
  },
  refreshPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  refreshPillPressed: {
    backgroundColor: '#DBEAFE',
  },
  refreshPillText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 20,
  },
  heroTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTexts: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    textAlign: 'right',
  },
  circleOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  circleTrack: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  indicatorDot: {
    position: 'absolute',
    top: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  circleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  badgeAmber: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeAmberText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '700',
  },
  badgeLink: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeLinkText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  habitCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  timeBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 64,
    alignItems: 'center',
  },
  timeBadgeText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  habitContent: {
    flex: 1,
    marginHorizontal: 14,
    alignItems: 'flex-end',
  },
  habitName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'right',
  },
  habitStatus: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 3,
    textAlign: 'right',
  },
  habitStatusComplete: {
    color: '#10B981',
    fontWeight: '600',
  },
  habitStatusMissed: {
    color: '#EF4444',
  },
  taskDoneText: {
    textDecorationLine: 'line-through',
    color: palette.muted,
  },
  checkCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleComplete: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  checkCircleBusy: {
    opacity: 0.5,
  },
  checkCirclePressed: {
    backgroundColor: '#EFF6FF',
  },
  alertSuccess: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  alertSuccessText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  alertError: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  alertErrorText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 8,
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyButtonText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  evaluationCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginTop: 18,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  evaluationHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  evaluationTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
  },
  evaluationDesc: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'right',
    lineHeight: 21,
  },
  evalBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  evalStatRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  evalStatLabel: {
    fontSize: 14,
    color: palette.muted,
  },
  evalStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  evalMessage: {
    fontSize: 14,
    color: palette.text,
    textAlign: 'right',
    marginTop: 6,
    lineHeight: 20,
  },
});
