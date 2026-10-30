import { useCallback, useState } from 'react';
import {
  Modal,
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
import { api } from '../../api/client';
import {
  commonStyles,
  LoadingState,
  palette,
  ScreenState,
} from '../../components/ui/States';
import type {
  DashboardDTO,
  GamificationLevelsDTO,
  GamificationPointsDTO,
  GamificationStatsDTO,
  ProgressOverviewDTO,
  StreakDTO,
} from '../../types/dto';
import type { RootStackParamList } from '../../navigation/types';
import { getApiErrorMessage } from '../../utils/apiError';

export function GamificationScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [points, setPoints] = useState<GamificationPointsDTO | null>(null);
  const [streaks, setStreaks] = useState<StreakDTO[]>([]);
  const [stats, setStats] = useState<GamificationStatsDTO | null>(null);
  const [levels, setLevels] = useState<GamificationLevelsDTO | null>(null);
  const [dashboard, setDashboard] = useState<DashboardDTO | null>(null);
  const [overview, setOverview] = useState<ProgressOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [filterKind, setFilterKind] = useState<'all' | 'earned' | 'lost'>('all');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [
        pointsResult,
        streakResult,
        statsResult,
        levelsResult,
        dashboardResult,
        overviewResult,
      ] = await Promise.all([
        api.getPoints(),
        api.getStreaks(),
        api.getGamificationStats(),
        api.getGamificationLevels(),
        api.getDashboard(),
        api.getProgressOverview(),
      ]);
      setPoints(pointsResult);
      setStreaks(streakResult);
      setStats(statsResult);
      setLevels(levelsResult);
      setDashboard(dashboardResult);
      setOverview(overviewResult);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading && !points) return <LoadingState label="جارٍ تحميل التقدم والتحفيز..." />;
  if (error && !points) {
    return (
      <ScreenState
        title="تعذر تحميل بيانات التحفيز"
        message={error}
        actionLabel="إعادة المحاولة"
        onAction={() => void load()}
      />
    );
  }

  const totalPoints = points?.total ?? dashboard?.todayStats?.points ?? 0;
  const currentLevel = levels?.currentLevel ?? levels?.level ?? 1;
  const pointsToNext = levels?.nextLevelAt
    ? Math.max(0, levels.nextLevelAt - (levels.points ?? totalPoints))
    : 100;
  const todayScheduled = dashboard?.todayStats?.habitsTotal ?? 32;
  const todayCompleted = dashboard?.todayStats?.habitsDone ?? 2;
  const todayRatio = todayScheduled > 0 ? todayCompleted / todayScheduled : 0;

  const weeklyRate = Math.round(stats?.week?.ratePercent ?? 100);
  const monthlyRate = Math.round(stats?.month?.ratePercent ?? 100);

  const longestStreak =
    stats?.bestStreak ??
    (streaks.length > 0 ? Math.max(...streaks.map((s) => s.longest)) : 1);
  const streakCount = stats?.streakCount ?? streaks.length ?? 3;

  const filteredEntries = (points?.entries ?? []).filter((entry) => {
    if (filterKind === 'earned') return entry.amount > 0;
    if (filterKind === 'lost') return entry.amount < 0;
    return true;
  });

  return (
    <View style={commonStyles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            colors={[palette.primary]}
            tintColor={palette.primary}
          />
        }
      >
        {/* Screen Title & Subtitle (matching Image 2) */}
        <View style={styles.titleBox}>
          <Text style={styles.screenTitle}>التحفيز والتقدم</Text>
          <Text style={styles.screenSubtitle}>رحلتك نحو عادات أفضل كل يوم</Text>
        </View>

        {/* Hero Radiant Blue Gradient Card (matching Image 2) */}
        <LinearGradient
          colors={['#1E40AF', '#2563EB', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            {/* Circular Ring with points on the right (in RTL) */}
            <View style={styles.circleOuter}>
              <View style={styles.circleTrack}>
                <View style={styles.indicatorDot} />
                <Text style={styles.circleNumber}>{totalPoints}</Text>
                <Text style={styles.circleLabel}>نقطة</Text>
              </View>
            </View>

            {/* Motivational message on the left */}
            <View style={styles.heroTexts}>
              <Text style={styles.heroMotivationalTitle}>
                كل نقطة تقرّبك من نسخة أفضل! ✨
              </Text>
              <Text style={styles.heroMotivationalSubtitle}>
                استمر في الالتزام وتحقيق أهدافك ✨
              </Text>
            </View>
          </View>

          {/* Bottom rule strip inside Hero card */}
          <View style={styles.heroRuleStrip}>
            <Text style={styles.heroRuleText}>
              قاعدة النقاط: +1 نقطة عند تنفيذ العادة - 1 نقطة إذا لم تُنفَّذ قبل الساعة 23:00 (العادات المؤقتة ولا تخصم)
            </Text>
          </View>
        </LinearGradient>

        {/* Section 1: النقاط والمستوى (matching Image 2) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart" size={19} color={palette.primary} />
            <Text style={styles.sectionTitle}>النقاط والمستوى</Text>
          </View>

          <View style={styles.grid2x2}>
            {/* Box 1: المستوى الحالي */}
            <View style={styles.statBox}>
              <View style={styles.statBoxIcon}>
                <Ionicons name="bar-chart" size={20} color={palette.primary} />
              </View>
              <View style={styles.statBoxTexts}>
                <Text style={styles.statNumberLarge}>{currentLevel}</Text>
                <Text style={styles.statLabelMuted}>المستوى الحالي</Text>
              </View>
            </View>

            {/* Box 2: إجمالي النقاط */}
            <View style={styles.statBox}>
              <View style={[styles.statBoxIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="trophy" size={20} color="#D97706" />
              </View>
              <View style={styles.statBoxTexts}>
                <Text style={styles.statNumberLarge}>{totalPoints}</Text>
                <Text style={styles.statLabelMuted}>إجمالي النقاط</Text>
              </View>
            </View>

            {/* Box 3: مخصصة / مكتملة اليوم */}
            <View style={styles.statBox}>
              <View style={styles.statBoxIcon}>
                <Ionicons name="reorder-two" size={20} color={palette.primary} />
              </View>
              <View style={styles.statBoxTexts}>
                <Text style={styles.statNumberDual}>
                  <Text style={{ color: palette.muted }}>مخصصة اليوم: </Text>
                  <Text style={{ fontWeight: '800', color: palette.text }}>{todayScheduled}</Text>
                </Text>
                <Text style={styles.statNumberDual}>
                  <Text style={{ color: palette.muted }}>مكتملة اليوم: </Text>
                  <Text style={{ fontWeight: '800', color: '#10B981' }}>{todayCompleted}</Text>
                </Text>
              </View>
            </View>

            {/* Box 4: النقاط للمستوى التالي */}
            <View style={styles.statBox}>
              <View style={styles.statBoxIcon}>
                <Ionicons name="radio-button-on" size={20} color={palette.primary} />
              </View>
              <View style={styles.statBoxTexts}>
                <Text style={styles.statNumberLarge}>{pointsToNext}</Text>
                <Text style={styles.statLabelMuted}>النقاط للمستوى التالي</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 2: معدلات الأداء (matching Image 2) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up" size={19} color={palette.primary} />
            <Text style={styles.sectionTitle}>معدلات الأداء</Text>
          </View>

          <View style={styles.row2Cols}>
            {/* معدل الأسبوع */}
            <View style={styles.statBox}>
              <View style={[styles.statBoxIcon, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="flash" size={20} color="#D97706" />
              </View>
              <View style={styles.statBoxTexts}>
                <Text style={styles.statNumberLarge}>{weeklyRate}%</Text>
                <Text style={styles.statLabelMuted}>معدل الأسبوع</Text>
              </View>
            </View>

            {/* معدل الشهر */}
            <View style={styles.statBox}>
              <View style={styles.statBoxIcon}>
                <Ionicons name="calendar" size={20} color={palette.primary} />
              </View>
              <View style={styles.statBoxTexts}>
                <Text style={styles.statNumberLarge}>{monthlyRate}%</Text>
                <Text style={styles.statLabelMuted}>معدل الشهر</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 3: الإحصاءات والسلاسل (matching Image 2) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="star" size={19} color={palette.primary} />
            <Text style={styles.sectionTitle}>الإحصاءات والسلاسل</Text>
          </View>

          <View style={styles.row3Cols}>
            {/* النقاط حسب الإحصاءات */}
            <View style={styles.statBoxSmall}>
              <View style={styles.statBoxIconSmall}>
                <Ionicons name="stats-chart" size={16} color={palette.primary} />
              </View>
              <Text style={styles.statNumberMedium}>{totalPoints}</Text>
              <Text style={styles.statLabelSmall}>النقاط حسب الإحصاءات</Text>
            </View>

            {/* أطول سلسلة */}
            <View style={styles.statBoxSmall}>
              <View style={styles.statBoxIconSmall}>
                <Ionicons name="link" size={16} color={palette.primary} />
              </View>
              <Text style={styles.statNumberMedium}>{longestStreak}</Text>
              <Text style={styles.statLabelSmall}>أطول سلسلة</Text>
            </View>

            {/* عدد السلاسل */}
            <View style={styles.statBoxSmall}>
              <View style={[styles.statBoxIconSmall, { backgroundColor: '#FFEDD5' }]}>
                <Ionicons name="flame" size={16} color="#EA580C" />
              </View>
              <Text style={styles.statNumberMedium}>{streakCount}</Text>
              <Text style={styles.statLabelSmall}>عدد السلاسل</Text>
            </View>
          </View>
        </View>

        {/* Section 4: إحصاءات اليوم والأهداف (matching Image 2) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="disc" size={19} color={palette.primary} />
            <Text style={styles.sectionTitle}>إحصاءات اليوم والأهداف</Text>
          </View>

          <View style={styles.ratioHeaderRow}>
            <Text style={styles.ratioValue}>
              {todayCompleted}/{todayScheduled}
            </Text>
            <Text style={styles.ratioLabel}>عادات مكتملة اليوم</Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(0, Math.min(100, Math.round(todayRatio * 100)))}%` },
              ]}
            />
          </View>
        </View>

        {/* Action Button: عرض سجل النقاط المفصل */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setHistoryModalVisible(true)}
          style={styles.historyBtn}
        >
          <Ionicons name="receipt-outline" size={18} color={palette.primary} />
          <Text style={styles.historyBtnText}>عرض سجل المعاملات والنقاط</Text>
        </Pressable>
      </ScrollView>

      {/* Points History Modal (الصفحة الداخلية لسجل النقاط) */}
      <Modal
        visible={historyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => setHistoryModalVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={palette.text} />
              </Pressable>
              <Text style={styles.modalTitle}>سجل حركة النقاط</Text>
            </View>

            {/* Filter Pills */}
            <View style={styles.filterRow}>
              <Pressable
                onPress={() => setFilterKind('all')}
                style={[
                  styles.filterPill,
                  filterKind === 'all' && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filterKind === 'all' && styles.filterPillTextActive,
                  ]}
                >
                  الكل
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setFilterKind('earned')}
                style={[
                  styles.filterPill,
                  filterKind === 'earned' && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filterKind === 'earned' && styles.filterPillTextActive,
                  ]}
                >
                  المكتسبة (+)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setFilterKind('lost')}
                style={[
                  styles.filterPill,
                  filterKind === 'lost' && styles.filterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filterKind === 'lost' && styles.filterPillTextActive,
                  ]}
                >
                  المخصومة (-)
                </Text>
              </Pressable>
            </View>

            {filteredEntries.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={32} color={palette.muted} />
                <Text style={styles.emptyText}>لا توجد حركات مسجلة حاليًا.</Text>
              </View>
            ) : (
              filteredEntries.map((entry, index) => {
                const isPositive = entry.amount > 0;
                return (
                  <View key={entry._id ?? index} style={styles.entryCard}>
                    <View
                      style={[
                        styles.pointsBadge,
                        isPositive
                          ? styles.pointsBadgePositive
                          : styles.pointsBadgeNegative,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pointsBadgeText,
                          isPositive
                            ? styles.pointsBadgeTextPositive
                            : styles.pointsBadgeTextNegative,
                        ]}
                      >
                        {isPositive ? `+${entry.amount}` : `${entry.amount}`}
                      </Text>
                    </View>

                    <View style={styles.entryTexts}>
                      <Text style={styles.entryReason}>
                        {entry.note || entry.reason || 'تسجيل نشاط عادة أو مهمة'}
                      </Text>
                      {entry.date ? (
                        <Text style={styles.entryDate}>
                          {new Date(entry.date).toLocaleDateString('ar-MR', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>
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
  titleBox: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  screenSubtitle: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 2,
    textAlign: 'right',
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTexts: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 14,
    gap: 4,
  },
  heroMotivationalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  heroMotivationalSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'right',
  },
  circleOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  circleTrack: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    gap: 1,
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
  circleNumber: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  circleLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '700',
  },
  heroRuleStrip: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    padding: 10,
  },
  heroRuleText: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
  },
  grid2x2: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  statBoxIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBoxTexts: {
    alignItems: 'flex-end',
    flex: 1,
  },
  statNumberLarge: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  statLabelMuted: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  statNumberDual: {
    fontSize: 12,
    textAlign: 'right',
  },
  row2Cols: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  row3Cols: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  statBoxSmall: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statBoxIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumberMedium: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
  },
  statLabelSmall: {
    fontSize: 11,
    color: palette.muted,
    fontWeight: '600',
    textAlign: 'center',
  },
  ratioHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratioLabel: {
    fontSize: 14,
    color: palette.muted,
    fontWeight: '600',
  },
  ratioValue: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.primary,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: palette.primary,
  },
  historyBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  historyBtnText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: palette.background,
  },
  modalContent: {
    padding: 20,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  entryCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
  },
  pointsBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 50,
    alignItems: 'center',
  },
  pointsBadgePositive: {
    backgroundColor: '#ECFDF5',
  },
  pointsBadgeNegative: {
    backgroundColor: '#FEF2F2',
  },
  pointsBadgeText: {
    fontSize: 15,
    fontWeight: '800',
  },
  pointsBadgeTextPositive: {
    color: '#059669',
  },
  pointsBadgeTextNegative: {
    color: '#DC2626',
  },
  entryTexts: {
    flex: 1,
    alignItems: 'flex-end',
  },
  entryReason: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'right',
  },
  entryDate: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
    textAlign: 'right',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: palette.muted,
  },
});
