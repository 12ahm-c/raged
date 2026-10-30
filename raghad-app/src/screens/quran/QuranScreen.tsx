import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import {
  commonStyles,
  LoadingState,
  palette,
  PrimaryButton,
  ScreenState,
} from '../../components/ui/States';
import { getApiErrorMessage } from '../../utils/apiError';
import { goBackSafe } from '../../utils/goBackSafe';

export interface QuranPlan {
  reviewHizbs: number;
  dailyHizbs: number;
  weeklyRestEnabled: boolean;
  currentHizb: number;
  currentPhase: 'review' | 'new' | 'weekly_rest';
}

export interface QuranLog {
  _id: string;
  date: string;
  hizb: number;
  phase: string;
  durationMinutes: number;
  completedAt: string;
}

export interface QuranNextSuggestion {
  suggestedHizb?: string | number;
  hizb?: string | number;
  phase?: string;
  reason?: string;
  suggestion?: string;
  nextPhaseSuggestion?: string;
}

type FilterPhase = 'all' | 'review' | 'new' | 'weekly_rest';

const filterPills: { key: FilterPhase; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'review', label: 'مراجعة' },
  { key: 'new', label: 'حفظ جديد' },
  { key: 'weekly_rest', label: 'استراحة أسبوعية' },
];

const phaseOptions: { key: QuranPlan['currentPhase']; label: string }[] = [
  { key: 'review', label: 'مراجعة' },
  { key: 'new', label: 'حفظ جديد' },
  { key: 'weekly_rest', label: 'استراحة أسبوعية' },
];

function normalizePhase(phaseStr: string | undefined): QuranPlan['currentPhase'] {
  if (!phaseStr) return 'review';
  if (phaseStr === 'new' || phaseStr === 'new_daily') return 'new';
  if (phaseStr === 'weekly_rest' || phaseStr === 'new_weekly') return 'weekly_rest';
  return 'review';
}

function getPhaseDisplay(phase: string): { label: string; badgeBg: string; textColor: string; icon: keyof typeof Ionicons.glyphMap } {
  if (phase === 'review') {
    return { label: 'مراجعة', badgeBg: '#ECFDF5', textColor: '#047857', icon: 'refresh-outline' };
  }
  if (phase === 'new' || phase === 'new_daily') {
    return { label: 'حفظ جديد', badgeBg: '#EFF6FF', textColor: '#1D4ED8', icon: 'book-outline' };
  }
  if (phase === 'weekly_rest' || phase === 'new_weekly') {
    return { label: 'استراحة أسبوعية', badgeBg: '#FEF3C7', textColor: '#B45309', icon: 'cafe-outline' };
  }
  return { label: phase, badgeBg: '#F1F5F9', textColor: '#475569', icon: 'bookmark-outline' };
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function QuranScreen() {
  const navigation = useNavigation();

  const [plan, setPlan] = useState<QuranPlan | null>(null);
  const [logs, setLogs] = useState<QuranLog[]>([]);
  const [suggestion, setSuggestion] = useState<QuranNextSuggestion | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [filter, setFilter] = useState<FilterPhase>('all');

  // Edit Plan Modal States
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [planForm, setPlanForm] = useState<{
    reviewHizbs: string;
    dailyHizbs: string;
    weeklyRestEnabled: boolean;
    currentHizb: string;
    currentPhase: QuranPlan['currentPhase'];
  }>({
    reviewHizbs: '1',
    dailyHizbs: '1',
    weeklyRestEnabled: true,
    currentHizb: '1',
    currentPhase: 'review',
  });
  const [planFormError, setPlanFormError] = useState<string>('');
  const [savingPlan, setSavingPlan] = useState<boolean>(false);

  // Log Session Modal States
  const [logModalVisible, setLogModalVisible] = useState<boolean>(false);
  const [logForm, setLogForm] = useState<{
    hizb: string;
    phase: QuranPlan['currentPhase'];
    durationMinutes: string;
    date: string;
  }>({
    hizb: '1',
    phase: 'review',
    durationMinutes: '30',
    date: getTodayString(),
  });
  const [logFormError, setLogFormError] = useState<string>('');
  const [savingLog, setSavingLog] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [planRes, logsRes, suggRes] = await Promise.all([
        api.getQuranPlan().catch(() => null) as Promise<Record<string, unknown> | null>,
        api.getQuranLogs().catch(() => []),
        api.getQuranNextSuggestion().catch(() => null) as Promise<QuranNextSuggestion | null>,
      ]);

      if (planRes) {
        setPlan({
          reviewHizbs: Number(planRes.reviewHizbs ?? 1),
          dailyHizbs: Number(planRes.dailyHizbs ?? 1),
          weeklyRestEnabled: Boolean(planRes.weeklyRestEnabled),
          currentHizb: Number(planRes.currentHizb ?? 1),
          currentPhase: normalizePhase(typeof planRes.currentPhase === 'string' ? planRes.currentPhase : undefined),
        });
      }

      const rawLogs = Array.isArray(logsRes)
        ? logsRes
        : logsRes && typeof logsRes === 'object' && Array.isArray((logsRes as { items: unknown[] }).items)
        ? (logsRes as { items: unknown[] }).items
        : [];

      const parsedLogs: QuranLog[] = (rawLogs as Record<string, unknown>[]).map((item) => ({
        _id: String(item._id ?? Math.random().toString()),
        date: String(item.date ?? getTodayString()),
        hizb: Number(item.hizb ?? 1),
        phase: String(item.phase ?? 'review'),
        durationMinutes: Number(item.durationMinutes ?? 0),
        completedAt: String(item.completedAt ?? new Date().toISOString()),
      }));

      parsedLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLogs(parsedLogs);
      setSuggestion(suggRes);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  function openEditPlanModal() {
    if (plan) {
      setPlanForm({
        reviewHizbs: String(plan.reviewHizbs),
        dailyHizbs: String(plan.dailyHizbs),
        weeklyRestEnabled: plan.weeklyRestEnabled,
        currentHizb: String(plan.currentHizb),
        currentPhase: plan.currentPhase,
      });
    }
    setPlanFormError('');
    setEditModalVisible(true);
  }

  async function handleSavePlan() {
    const reviewHizbsNum = Number(planForm.reviewHizbs);
    const dailyHizbsNum = Number(planForm.dailyHizbs);
    const currentHizbNum = Number(planForm.currentHizb);

    if (isNaN(reviewHizbsNum) || reviewHizbsNum < 1) {
      setPlanFormError('يرجى إدخال عدد صحيح لأحزاب المراجعة (1 أو أكثر).');
      return;
    }
    if (isNaN(dailyHizbsNum) || dailyHizbsNum < 1) {
      setPlanFormError('يرجى إدخال عدد صحيح لأحزاب الحفظ الجديد (1 أو أكثر).');
      return;
    }
    if (isNaN(currentHizbNum) || currentHizbNum < 1 || currentHizbNum > 60) {
      setPlanFormError('الحزب الحالي يجب أن يكون بين 1 و 60.');
      return;
    }

    setSavingPlan(true);
    setPlanFormError('');
    try {
      await api.updateQuranPlan({
        reviewHizbs: reviewHizbsNum,
        dailyHizbs: dailyHizbsNum,
        weeklyRestEnabled: planForm.weeklyRestEnabled,
        currentHizb: currentHizbNum,
        currentPhase: planForm.currentPhase,
      });

      setEditModalVisible(false);
      setSuccessMessage('تم تحديث خطة القرآن بنجاح.');
      await loadData();
    } catch (err) {
      setPlanFormError(getApiErrorMessage(err));
    } finally {
      setSavingPlan(false);
    }
  }

  function openLogModal(prefillHizb?: number, prefillPhase?: QuranPlan['currentPhase']) {
    setLogForm({
      hizb: String(prefillHizb ?? suggestion?.suggestedHizb ?? suggestion?.hizb ?? plan?.currentHizb ?? 1),
      phase: prefillPhase ?? normalizePhase(String(suggestion?.phase ?? plan?.currentPhase ?? 'review')),
      durationMinutes: '30',
      date: getTodayString(),
    });
    setLogFormError('');
    setLogModalVisible(true);
  }

  async function handleSaveLog() {
    const hizbNum = Number(logForm.hizb);
    const durationNum = Number(logForm.durationMinutes);

    if (isNaN(hizbNum) || hizbNum < 1 || hizbNum > 60) {
      setLogFormError('رقم الحزب يجب أن يكون بين 1 و 60.');
      return;
    }
    if (isNaN(durationNum) || durationNum < 1) {
      setLogFormError('المدة بالدقائق يجب أن تكون رقماً أكبر من 0.');
      return;
    }
    if (!logForm.date.trim()) {
      setLogFormError('تاريخ الجلسة مطلوب.');
      return;
    }

    setSavingLog(true);
    setLogFormError('');
    try {
      await api.createQuranLog({
        hizb: hizbNum,
        phase: logForm.phase,
        durationMinutes: durationNum,
        date: logForm.date.trim(),
      });

      setLogModalVisible(false);
      setSuccessMessage('تم تسجيل جلسة القرآن بنجاح.');
      await loadData();
    } catch (err) {
      setLogFormError(getApiErrorMessage(err));
    } finally {
      setSavingLog(false);
    }
  }

  const filteredLogs = logs.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'review') return item.phase === 'review';
    if (filter === 'new') return item.phase === 'new' || item.phase === 'new_daily';
    if (filter === 'weekly_rest') return item.phase === 'weekly_rest' || item.phase === 'new_weekly';
    return true;
  });

  const suggestedHizb = Number(suggestion?.suggestedHizb ?? suggestion?.hizb ?? plan?.currentHizb ?? 1);
  const suggestedPhaseRaw = suggestion?.phase ?? suggestion?.nextPhaseSuggestion ?? plan?.currentPhase ?? 'review';
  const suggestedPhase = normalizePhase(String(suggestedPhaseRaw));
  const suggestedPhaseDisplay = getPhaseDisplay(suggestedPhaseRaw);
  const suggestionReason = suggestion?.reason ?? suggestion?.suggestion ?? 'الجلسة المقترحة وفق خطتك اليومية';

  const currentHizb = plan?.currentHizb ?? 1;
  const hizbPercent = Math.round((currentHizb / 60) * 100);

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.pageCategoryBadge}>العادات الروحية</Text>
            <Text style={styles.pageTitle}>القرآن الكريم</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="تسجيل جلسة"
              onPress={() => openLogModal()}
              style={({ pressed }) => [styles.addBtn, pressed && styles.btnPressed]}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addBtnText}>تسجيل جلسة</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="رجوع"
              onPress={() => goBackSafe(navigation)}
              style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
            >
              <Ionicons name="arrow-forward" size={17} color={palette.primary} />
              <Text style={styles.backBtnText}>رجوع</Text>
            </Pressable>
          </View>
        </View>

        {/* Global Success / Error Banners */}
        {successMessage ? (
          <View style={styles.alertSuccess} accessibilityRole="alert">
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={styles.alertSuccessText}>{successMessage}</Text>
            <Pressable onPress={() => setSuccessMessage('')}>
              <Ionicons name="close" size={16} color="#059669" />
            </Pressable>
          </View>
        ) : null}

        {error ? (
          <View style={styles.alertError} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={styles.alertErrorText}>{error}</Text>
          </View>
        ) : null}

        {/* Hero Progress Banner */}
        {plan ? (
          <LinearGradient
            colors={['#064E3B', '#047857', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTop}>
              <View style={styles.circleProgressTrack}>
                <Text style={styles.circleProgressNum}>{currentHizb}</Text>
                <Text style={styles.circleProgressSub}>من 60</Text>
              </View>

              <View style={styles.heroTexts}>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.heroPhaseBadge}>
                    <Ionicons name={getPhaseDisplay(plan.currentPhase).icon} size={14} color="#064E3B" />
                    <Text style={styles.heroPhaseBadgeText}>
                      المرحلة: {getPhaseDisplay(plan.currentPhase).label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.heroTitle}>خطة القرآن الكريم</Text>
                <Text style={styles.heroSubtitle}>
                  إنجاز {hizbPercent}% من المصحف الشريف
                </Text>
              </View>
            </View>

            {/* 3 Stats Boxes */}
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatBox}>
                <Ionicons name="bookmark-outline" size={18} color="#FFFFFF" />
                <Text style={styles.heroStatNum}>{plan.currentHizb}</Text>
                <Text style={styles.heroStatLabel}>الحزب الحالي</Text>
              </View>
              <View style={styles.heroStatBox}>
                <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                <Text style={styles.heroStatNum}>{plan.reviewHizbs}</Text>
                <Text style={styles.heroStatLabel}>أحزاب المراجعة</Text>
              </View>
              <View style={styles.heroStatBox}>
                <Ionicons name="book-outline" size={18} color="#FFFFFF" />
                <Text style={styles.heroStatNum}>{plan.dailyHizbs}</Text>
                <Text style={styles.heroStatLabel}>الحفظ اليومي</Text>
              </View>
            </View>

            {/* Edit Plan Button */}
            <Pressable
              accessibilityRole="button"
              onPress={openEditPlanModal}
              style={({ pressed }) => [styles.heroActionBtn, pressed && styles.btnPressed]}
            >
              <Ionicons name="settings-outline" size={16} color="#FFFFFF" />
              <Text style={styles.heroActionBtnText}>تعديل خطة الحفظ والمراجعة</Text>
            </Pressable>
          </LinearGradient>
        ) : null}

        {/* Smart AI Suggestion Card */}
        {suggestion ? (
          <View style={styles.suggestionCard}>
            <View style={styles.suggestionHeader}>
              <View style={styles.suggestionIconBox}>
                <Ionicons name="sparkles" size={20} color="#D97706" />
              </View>
              <View style={styles.suggestionTitleGroup}>
                <Text style={styles.suggestionTag}>الاقتراح الذكي التالي</Text>
                <Text style={styles.suggestionHeading}>
                  الحزب {suggestedHizb} ({suggestedPhaseDisplay.label})
                </Text>
              </View>
            </View>

            <Text style={styles.suggestionReason}>{suggestionReason}</Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => openLogModal(suggestedHizb, suggestedPhase)}
              style={({ pressed }) => [styles.suggestionBtn, pressed && styles.btnPressed]}
            >
              <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
              <Text style={styles.suggestionBtnText}>تسجيل هذا الاقتراح كجلسة</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Section Header: سجل الجلسات */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>سجل جلسات القرآن</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{filteredLogs.length} جلسة</Text>
          </View>
        </View>

        {/* Filter Pills Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          {filterPills.map((p) => {
            const isSelected = filter === p.key;
            return (
              <Pressable
                key={p.key}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setFilter(p.key)}
                style={[
                  styles.filterPill,
                  isSelected && styles.filterPillSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected && styles.filterPillTextSelected,
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Loading State */}
        {loading && logs.length === 0 ? (
          <LoadingState label="جارٍ تحميل سجلات القرآن..." />
        ) : null}

        {/* Empty Logs State */}
        {!loading && filteredLogs.length === 0 ? (
          <ScreenState
            title="لا توجد جلسات مسجلة بعد"
            message={
              filter === 'all'
                ? 'سجل جلستك القرآنية الأولى لتبدأ بتتبع تقدمك وتثبيت حفظك.'
                : 'لا توجد جلسات تطابق هذه التصفية.'
            }
            actionLabel="تسجيل جلسة الآن"
            onAction={() => openLogModal()}
          />
        ) : null}

        {/* Logs List */}
        {filteredLogs.map((log) => {
          const phaseInfo = getPhaseDisplay(log.phase);
          return (
            <View key={log._id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <View style={styles.logHizbBox}>
                  <Text style={styles.logHizbNum}>{log.hizb}</Text>
                  <Text style={styles.logHizbLabel}>حزب</Text>
                </View>

                <View style={styles.logInfo}>
                  <View style={styles.logPhaseRow}>
                    <View style={[styles.phaseBadge, { backgroundColor: phaseInfo.badgeBg }]}>
                      <Ionicons name={phaseInfo.icon} size={13} color={phaseInfo.textColor} />
                      <Text style={[styles.phaseBadgeText, { color: phaseInfo.textColor }]}>
                        {phaseInfo.label}
                      </Text>
                    </View>
                    <Text style={styles.logDate}>{formatDisplayDate(log.date)}</Text>
                  </View>

                  <View style={styles.logMetaRow}>
                    <Ionicons name="time-outline" size={14} color={palette.muted} />
                    <Text style={styles.logDuration}>
                      المدة: {log.durationMinutes} دقيقة
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Edit Plan Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.dialogScroll}>
            <View style={styles.dialog}>
              <View style={styles.dialogHeader}>
                <Text style={styles.dialogTitle}>تعديل خطة القرآن</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setEditModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الحزب الحالي (1 إلى 60)</Text>
                <TextInput
                  accessibilityLabel="الحزب الحالي"
                  keyboardType="number-pad"
                  value={planForm.currentHizb}
                  onChangeText={(v) => setPlanForm({ ...planForm, currentHizb: v })}
                  style={commonStyles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>المرحلة الحالية</Text>
                <View style={styles.phaseSelectorRow}>
                  {phaseOptions.map((opt) => {
                    const sel = planForm.currentPhase === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        accessibilityRole="button"
                        onPress={() => setPlanForm({ ...planForm, currentPhase: opt.key })}
                        style={[styles.phaseSelectBtn, sel && styles.phaseSelectBtnActive]}
                      >
                        <Text style={[styles.phaseSelectBtnText, sel && styles.phaseSelectBtnTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>أحزاب المراجعة اليومية</Text>
                <TextInput
                  accessibilityLabel="أحزاب المراجعة"
                  keyboardType="number-pad"
                  value={planForm.reviewHizbs}
                  onChangeText={(v) => setPlanForm({ ...planForm, reviewHizbs: v })}
                  style={commonStyles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>أحزاب الحفظ الجديد اليومية</Text>
                <TextInput
                  accessibilityLabel="أحزاب الحفظ الجديد"
                  keyboardType="number-pad"
                  value={planForm.dailyHizbs}
                  onChangeText={(v) => setPlanForm({ ...planForm, dailyHizbs: v })}
                  style={commonStyles.input}
                />
              </View>

              <View style={styles.switchRow}>
                <Switch
                  value={planForm.weeklyRestEnabled}
                  onValueChange={(val) => setPlanForm({ ...planForm, weeklyRestEnabled: val })}
                  trackColor={{ false: '#CBD5E1', true: '#059669' }}
                />
                <Text style={styles.switchLabel}>تفعيل يوم الاستراحة الأسبوعية</Text>
              </View>

              {planFormError ? (
                <View style={styles.alertError} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.alertErrorText}>{planFormError}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label={savingPlan ? 'جارٍ الحفظ...' : 'حفظ الخطة'}
                disabled={savingPlan}
                onPress={() => void handleSavePlan()}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Log Session Modal */}
      <Modal
        visible={logModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLogModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.dialogScroll}>
            <View style={styles.dialog}>
              <View style={styles.dialogHeader}>
                <Text style={styles.dialogTitle}>تسجيل جلسة قرآنية</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setLogModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>رقم الحزب (1 إلى 60)</Text>
                <TextInput
                  accessibilityLabel="رقم الحزب"
                  keyboardType="number-pad"
                  value={logForm.hizb}
                  onChangeText={(v) => setLogForm({ ...logForm, hizb: v })}
                  style={commonStyles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>نوع الجلسة</Text>
                <View style={styles.phaseSelectorRow}>
                  {phaseOptions.map((opt) => {
                    const sel = logForm.phase === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        accessibilityRole="button"
                        onPress={() => setLogForm({ ...logForm, phase: opt.key })}
                        style={[styles.phaseSelectBtn, sel && styles.phaseSelectBtnActive]}
                      >
                        <Text style={[styles.phaseSelectBtnText, sel && styles.phaseSelectBtnTextActive]}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>المدة بالدقائق</Text>
                <TextInput
                  accessibilityLabel="المدة بالدقائق"
                  keyboardType="number-pad"
                  value={logForm.durationMinutes}
                  onChangeText={(v) => setLogForm({ ...logForm, durationMinutes: v })}
                  style={commonStyles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>تاريخ الجلسة (YYYY-MM-DD)</Text>
                <TextInput
                  accessibilityLabel="تاريخ الجلسة"
                  value={logForm.date}
                  onChangeText={(v) => setLogForm({ ...logForm, date: v })}
                  style={commonStyles.input}
                />
              </View>

              {logFormError ? (
                <View style={styles.alertError} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.alertErrorText}>{logFormError}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label={savingLog ? 'جارٍ تسجيل الجلسة...' : 'تسجيل الجلسة'}
                disabled={savingLog}
                onPress={() => void handleSaveLog()}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleBox: {
    flex: 1,
    alignItems: 'flex-end',
  },
  pageCategoryBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 2,
    textAlign: 'right',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  headerActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  addBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  backBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtnText: {
    color: palette.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  heroCard: {
    borderRadius: 22,
    padding: 20,
    gap: 16,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
  },
  circleProgressTrack: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  circleProgressNum: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  circleProgressSub: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  heroTexts: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  heroBadgeRow: {
    flexDirection: 'row-reverse',
  },
  heroPhaseBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroPhaseBadgeText: {
    color: '#064E3B',
    fontSize: 11,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    textAlign: 'right',
  },
  heroStatsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroStatBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  heroStatNum: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  heroStatLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  heroActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  suggestionCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  suggestionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  suggestionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionTitleGroup: {
    flex: 1,
    alignItems: 'flex-end',
  },
  suggestionTag: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  suggestionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#78350F',
    textAlign: 'right',
  },
  suggestionReason: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 20,
    textAlign: 'right',
  },
  suggestionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#D97706',
    borderRadius: 14,
    paddingVertical: 10,
  },
  suggestionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  sectionHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  countBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  countBadgeText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingVertical: 4,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  filterPillSelected: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
  },
  filterPillTextSelected: {
    color: '#FFFFFF',
  },
  alertSuccess: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  alertSuccessText: {
    flex: 1,
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
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
  },
  alertErrorText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  logHizbBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logHizbNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065F46',
  },
  logHizbLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  logInfo: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 6,
  },
  logPhaseRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  phaseBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  phaseBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  logDate: {
    fontSize: 12,
    color: palette.muted,
  },
  logMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  logDuration: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  dialogScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  dialog: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    padding: 22,
    gap: 16,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  dialogHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
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
  phaseSelectorRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  phaseSelectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
  },
  phaseSelectBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  phaseSelectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  phaseSelectBtnTextActive: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  switchLabel: {
    fontSize: 14,
    color: palette.text,
    fontWeight: '600',
  },
});
