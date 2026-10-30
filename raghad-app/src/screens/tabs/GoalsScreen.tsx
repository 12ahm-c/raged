import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  PrimaryButton,
  ScreenState,
} from '../../components/ui/States';
import type {
  GoalCreateRequestDTO,
  GoalDTO,
  ProjectDTO,
} from '../../types/dto';
import type { RootStackParamList } from '../../navigation/types';
import { getApiErrorMessage } from '../../utils/apiError';

type GoalWithProgress = GoalDTO & { progressPercent: number };

function formatArabicDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ar-MR', {
    day: 'numeric',
    month: 'long',
  });
}

function getGoalIcon(title: string, scope: GoalDTO['scope']): {
  icon: keyof typeof Ionicons.glyphMap;
  isAmber: boolean;
} {
  const t = title.toLowerCase();
  if (t.includes('قرآن') || t.includes('قراءة') || t.includes('كتاب') || t.includes('حفظ')) {
    return { icon: 'book-outline', isAmber: false };
  }
  if (scope === 'project' || t.includes('مشروع') || t.includes('تطبيق') || t.includes('برمجة') || t.includes('إطلاق')) {
    return { icon: 'folder-outline', isAmber: true };
  }
  if (t.includes('جري') || t.includes('رياضة') || t.includes('وزن') || t.includes('صحة') || t.includes('مشي')) {
    return { icon: 'pulse-outline', isAmber: false };
  }
  if (t.includes('مال') || t.includes('ادخار') || t.includes('دخل')) {
    return { icon: 'wallet-outline', isAmber: true };
  }
  return { icon: 'radio-button-on-outline', isAmber: false };
}

export function GoalsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'achieved'>('all');
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<GoalDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GoalDTO | null>(null);
  const [detailGoal, setDetailGoal] = useState<GoalWithProgress | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);
  const [scopeFilterVisible, setScopeFilterVisible] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'project'>('all');

  const [form, setForm] = useState({
    title: '',
    scope: 'global' as GoalDTO['scope'],
    projectId: '',
    target: '',
    current: '',
    deadline: '',
    status: 'active' as GoalDTO['status'],
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await api.listGoals({
        scope: scopeFilter === 'all' ? undefined : scopeFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      const withProgress = await Promise.all(
        result.map(async (goal) => {
          const detail = await api.getGoal(goal._id);
          return { ...detail.goal, progressPercent: detail.progressPercent };
        })
      );
      setGoals(withProgress);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scopeFilter, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      api
        .listProjects({ page: 1, limit: 100 })
        .then((result) => {
          if (!cancelled) setProjects(result.items);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const activeGoals = useMemo(
    () => goals.filter((g) => g.status === 'active'),
    [goals]
  );
  const achievedGoals = useMemo(
    () => goals.filter((g) => g.status === 'achieved'),
    [goals]
  );
  const projectGoals = useMemo(
    () => goals.filter((g) => g.scope === 'project' || Boolean(g.projectId)),
    [goals]
  );

  const averageProgress = useMemo(() => {
    if (goals.length === 0) return 0;
    const sum = goals.reduce((acc, g) => acc + (g.progressPercent || 0), 0);
    return Math.round(sum / goals.length);
  }, [goals]);

  function openCreate() {
    setEditing(null);
    setFormError('');
    setForm({
      title: '',
      scope: 'global',
      projectId: '',
      target: '100',
      current: '0',
      deadline: '',
      status: 'active',
    });
    setFormVisible(true);
  }

  function openEdit(goal: GoalDTO) {
    setEditing(goal);
    setFormError('');
    setForm({
      title: goal.title,
      scope: goal.scope,
      projectId: goal.projectId ?? '',
      target: String(goal.target),
      current: String(goal.current),
      deadline: goal.deadline?.slice(0, 10) ?? '',
      status: goal.status,
    });
    setFormVisible(true);
  }

  async function saveGoal() {
    const title = form.title.trim();
    const target = Number(form.target);
    const current = Number(form.current || 0);
    if (!title) {
      setFormError('عنوان الهدف مطلوب.');
      return;
    }
    if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(current) || current < 0) {
      setFormError('أدخل قيماً رقمية صحيحة للمستهدف والقيمة الحالية.');
      return;
    }
    if (form.scope === 'project' && !form.projectId.trim()) {
      setFormError('يرجى اختيار المشروع المرتبط بالهدف.');
      return;
    }
    const deadline = form.deadline.trim()
      ? `${form.deadline.slice(0, 10)}T00:00:00.000Z`
      : null;
    if (deadline && Number.isNaN(new Date(deadline).getTime())) {
      setFormError('أدخل تاريخاً صالحاً بصيغة YYYY-MM-DD.');
      return;
    }

    const payload: GoalCreateRequestDTO = {
      title,
      scope: form.scope,
      projectId: form.scope === 'project' ? form.projectId.trim() : null,
      target,
      current,
      deadline,
      status: form.status,
    };

    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await api.updateGoal(editing._id, payload);
        setSuccess('تم تحديث الهدف بنجاح.');
      } else {
        await api.createGoal(payload);
        setSuccess('تمت إضافة الهدف بنجاح.');
      }
      setFormVisible(false);
      await load(true);
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteGoal() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.deleteGoal(deleteTarget._id);
      setDeleteTarget(null);
      setDetailGoal(null);
      setSuccess('تم حذف الهدف بنجاح.');
      await load(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  }

  async function quickUpdateProgress(goal: GoalWithProgress, delta: number) {
    const nextCurrent = Math.max(0, goal.current + delta);
    const isNowAchieved = nextCurrent >= goal.target;
    try {
      await api.updateGoal(goal._id, {
        current: nextCurrent,
        status: isNowAchieved ? 'achieved' : 'active',
      });
      const nextPercent = Math.round((nextCurrent / (goal.target || 1)) * 100);
      setDetailGoal({
        ...goal,
        current: nextCurrent,
        status: isNowAchieved ? 'achieved' : 'active',
        progressPercent: nextPercent,
      });
      await load(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  if (loading && goals.length === 0) {
    return <LoadingState label="جارٍ تحميل الأهداف..." />;
  }

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
        {/* Header Row: Title on right, Add Goal button on left (matching the screenshot) */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.pageTitle}>الأهداف</Text>
            <Text style={styles.pageSubtitle}>
              {goals.length} أهداف • {activeGoals.length} نشاط
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إضافة هدف جديد"
            onPress={openCreate}
            style={({ pressed }) => [
              styles.addGoalBtn,
              pressed && styles.addGoalBtnPressed,
            ]}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addGoalBtnText}>إضافة هدف</Text>
          </Pressable>
        </View>

        {/* Hero Progress Card (matching screenshot) */}
        <LinearGradient
          colors={['#1E40AF', '#2563EB', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTopRow}>
            {/* Circular Ring on the left in RTL */}
            <View style={styles.circleOuter}>
              <View style={styles.circleTrack}>
                <View style={styles.indicatorDot} />
                <Text style={styles.circlePercentText}>%{averageProgress}</Text>
              </View>
            </View>

            {/* Texts on the right in RTL */}
            <View style={styles.heroTexts}>
              <Text style={styles.heroTitle}>متوسط التقدم</Text>
              <Text style={styles.heroSubtitle}>
                {activeGoals.length} أهداف قيد التنفيذ
              </Text>
            </View>
          </View>

          {/* 3 Translucent Stats Boxes at bottom of Hero Card */}
          <View style={styles.statsRow}>
            {/* Box 1 (Right): نشطة */}
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{activeGoals.length}</Text>
              <Text style={styles.statLabel}>نشطة</Text>
            </View>

            {/* Box 2 (Center): متحققة */}
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{achievedGoals.length}</Text>
              <Text style={styles.statLabel}>متحققة</Text>
            </View>

            {/* Box 3 (Left): مشاريع */}
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{projectGoals.length}</Text>
              <Text style={styles.statLabel}>مشاريع</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Filter Controls Row (matching screenshot) */}
        <View style={styles.filterBarRow}>
          {/* Filter options icon button on left */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="خيارات التصفية"
            onPress={() => setScopeFilterVisible(true)}
            style={[
              styles.sliderBtn,
              scopeFilter !== 'all' && styles.sliderBtnActive,
            ]}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={scopeFilter !== 'all' ? palette.primary : palette.muted}
            />
          </Pressable>

          {/* Segmented Filter Pills on right: الكل / نشطة / متحققة */}
          <View style={styles.filterPillsContainer}>
            <Pressable
              onPress={() => setStatusFilter('all')}
              style={[
                styles.filterPill,
                statusFilter === 'all' && styles.filterPillActive,
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  statusFilter === 'all' && styles.filterPillTextActive,
                ]}
              >
                الكل
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setStatusFilter('active')}
              style={[
                styles.filterPill,
                statusFilter === 'active' && styles.filterPillActive,
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  statusFilter === 'active' && styles.filterPillTextActive,
                ]}
              >
                نشطة
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setStatusFilter('achieved')}
              style={[
                styles.filterPill,
                statusFilter === 'achieved' && styles.filterPillActive,
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  statusFilter === 'achieved' && styles.filterPillTextActive,
                ]}
              >
                متحققة
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Feedback alerts */}
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

        {/* Goal Cards List (exact screenshot layout) */}
        {goals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="radio-button-on-outline" size={38} color={palette.muted} />
            <Text style={styles.emptyTitle}>لا توجد أهداف مطابقة حاليًا</Text>
            <Text style={styles.emptySubtitle}>أضف هدفًا جديدًا للبدء في تتبعه.</Text>
            <Pressable style={styles.emptyAddBtn} onPress={openCreate}>
              <Text style={styles.emptyAddBtnText}>+ إضافة هدف</Text>
            </Pressable>
          </View>
        ) : (
          goals.map((goal) => {
            const { icon, isAmber } = getGoalIcon(goal.title, goal.scope);
            const isProjectScope = goal.scope === 'project' || Boolean(goal.projectId);
            const deadlineText = formatArabicDate(goal.deadline);

            return (
              <Pressable
                key={goal._id}
                accessibilityRole="button"
                accessibilityLabel={`هدف ${goal.title}`}
                onPress={() => setDetailGoal(goal)}
                style={({ pressed }) => [
                  styles.goalCard,
                  pressed && styles.goalCardPressed,
                ]}
              >
                {/* Top Row: Icon + Title + Tags on right, Percentage on left */}
                <View style={styles.goalCardTop}>
                  {/* Right side: Icon + Texts */}
                  <View style={styles.goalIdentity}>
                    <View
                      style={[
                        styles.goalIconContainer,
                        isAmber ? styles.goalIconContainerAmber : styles.goalIconContainerBlue,
                      ]}
                    >
                      <Ionicons
                        name={icon}
                        size={22}
                        color={isAmber ? '#D97706' : palette.primary}
                      />
                    </View>

                    <View style={styles.goalTextsContainer}>
                      <Text style={styles.goalTitleText} numberOfLines={1}>
                        {goal.title}
                      </Text>

                      <View style={styles.goalSubRow}>
                        {/* Scope pill: عامة / مشروع */}
                        <View
                          style={[
                            styles.scopeBadge,
                            isProjectScope
                              ? styles.scopeBadgeAmber
                              : styles.scopeBadgeBlue,
                          ]}
                        >
                          <Text
                            style={[
                              styles.scopeBadgeText,
                              isProjectScope
                                ? styles.scopeBadgeTextAmber
                                : styles.scopeBadgeTextBlue,
                            ]}
                          >
                            {isProjectScope ? 'مشروع' : 'عامة'}
                          </Text>
                        </View>

                        {/* Deadline text */}
                        {deadlineText ? (
                          <Text style={styles.deadlineSubText}>
                            حتى {deadlineText}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {/* Left side: Percentage */}
                  <Text
                    style={[
                      styles.percentText,
                      isAmber ? styles.percentTextAmber : styles.percentTextBlue,
                    ]}
                  >
                    %{goal.progressPercent}
                  </Text>
                </View>

                {/* Progress Bar (exact 2-tone rounded bar) */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      isAmber ? styles.progressBarFillAmber : styles.progressBarFillBlue,
                      { width: `${Math.max(0, Math.min(100, goal.progressPercent))}%` },
                    ]}
                  />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Goal Details & Quick Update Modal Sheet */}
      <Modal
        visible={detailGoal !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailGoal(null)}
      >
        {detailGoal ? (
          <View style={styles.modalBackdrop}>
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalContent}
            >
              {/* Header */}
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setDetailGoal(null)} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={palette.text} />
                </Pressable>
                <Text style={styles.modalTitle}>تفاصيل ومتابعة الهدف</Text>
              </View>

              {/* Goal Detail Card */}
              <View style={styles.detailHeroCard}>
                <View style={styles.detailCardTop}>
                  <View style={styles.detailIconBox}>
                    <Ionicons
                      name={getGoalIcon(detailGoal.title, detailGoal.scope).icon}
                      size={26}
                      color={palette.primary}
                    />
                  </View>
                  <View style={styles.detailTitleBox}>
                    <Text style={styles.detailTitleText}>{detailGoal.title}</Text>
                    <Text style={styles.detailSubtitleText}>
                      {detailGoal.scope === 'global' ? 'هدف عام' : 'هدف مرتبط بمشروع'}
                      {detailGoal.deadline ? ` · حتى ${formatArabicDate(detailGoal.deadline)}` : ''}
                    </Text>
                  </View>
                </View>

                {/* 3 Metric Stats */}
                <View style={styles.detailStatsRow}>
                  <View style={styles.detailStatBox}>
                    <Text style={styles.detailStatNumber}>{detailGoal.current}</Text>
                    <Text style={styles.detailStatLabel}>القيمة الحالية</Text>
                  </View>
                  <View style={styles.detailStatBox}>
                    <Text style={styles.detailStatNumber}>{detailGoal.target}</Text>
                    <Text style={styles.detailStatLabel}>المستهدف</Text>
                  </View>
                  <View style={styles.detailStatBox}>
                    <Text style={[styles.detailStatNumber, { color: palette.primary }]}>
                      %{detailGoal.progressPercent}
                    </Text>
                    <Text style={styles.detailStatLabel}>نسبة الإنجاز</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      styles.progressBarFillBlue,
                      { width: `${Math.max(0, Math.min(100, detailGoal.progressPercent))}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Quick Update Progress Box */}
              <View style={styles.quickCard}>
                <Text style={styles.quickTitle}>تحديث نسبة التقدم السريع</Text>
                <Text style={styles.quickDesc}>
                  أضف إلى القيمة الحالية مباشرة لتحديث تقدم الهدف وحفظه:
                </Text>
                <View style={styles.quickButtonsRow}>
                  <Pressable
                    onPress={() => void quickUpdateProgress(detailGoal, 1)}
                    style={styles.quickBtn}
                  >
                    <Ionicons name="add" size={15} color={palette.primary} />
                    <Text style={styles.quickBtnText}>+1</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void quickUpdateProgress(detailGoal, 5)}
                    style={styles.quickBtn}
                  >
                    <Ionicons name="add" size={15} color={palette.primary} />
                    <Text style={styles.quickBtnText}>+5</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void quickUpdateProgress(detailGoal, 10)}
                    style={styles.quickBtn}
                  >
                    <Ionicons name="add" size={15} color={palette.primary} />
                    <Text style={styles.quickBtnText}>+10</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void quickUpdateProgress(detailGoal, -1)}
                    style={styles.quickBtnMuted}
                  >
                    <Text style={styles.quickBtnMutedText}>-1</Text>
                  </Pressable>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <PrimaryButton
                  label="تعديل بيانات الهدف"
                  onPress={() => {
                    const g = detailGoal;
                    setDetailGoal(null);
                    openEdit(g);
                  }}
                />
                <Pressable
                  onPress={() => {
                    const g = detailGoal;
                    setDetailGoal(null);
                    setDeleteTarget(g);
                  }}
                  style={styles.deleteActionBtn}
                >
                  <Text style={styles.deleteActionBtnText}>حذف الهدف</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        ) : null}
      </Modal>

      {/* Add / Edit Goal Modal Form (Formulaire) */}
      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setFormVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={palette.text} />
              </Pressable>
              <Text style={styles.modalTitle}>
                {editing ? 'تعديل الهدف' : 'إضافة هدف جديد'}
              </Text>
            </View>

            {/* Form Fields */}
            <View style={styles.formCard}>
              <Text style={styles.formSectionHeading}>بيانات الهدف</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>عنوان الهدف *</Text>
                <TextInput
                  accessibilityLabel="عنوان الهدف"
                  placeholder="مثال: ختم القرآن الكريم، إطلاق التطبيق..."
                  placeholderTextColor={palette.muted}
                  value={form.title}
                  onChangeText={(title) => setForm({ ...form, title })}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>نطاق الهدف</Text>
                <View style={styles.segmentedRow}>
                  <Pressable
                    onPress={() => setForm({ ...form, scope: 'global' })}
                    style={[
                      styles.segmentedItem,
                      form.scope === 'global' && styles.segmentedItemActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentedText,
                        form.scope === 'global' && styles.segmentedTextActive,
                      ]}
                    >
                      عامة
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setForm({ ...form, scope: 'project' })}
                    style={[
                      styles.segmentedItem,
                      form.scope === 'project' && styles.segmentedItemActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentedText,
                        form.scope === 'project' && styles.segmentedTextActive,
                      ]}
                    >
                      مشروع
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Project selector if scope is project */}
              {form.scope === 'project' ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>المشروع المرتبط</Text>
                  <Pressable
                    onPress={() => setProjectPickerVisible(true)}
                    style={styles.dropdownInput}
                  >
                    <Text style={styles.dropdownInputText}>
                      {projects.find((p) => p._id === form.projectId)?.name ?? 'اختر المشروع المرتبط...'}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={palette.muted} />
                  </Pressable>
                </View>
              ) : null}

              {/* Target & Current values */}
              <View style={styles.inlineInputsRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>المستهدف (الرقم) *</Text>
                  <TextInput
                    accessibilityLabel="القيمة المستهدفة"
                    placeholder="مثال: 100"
                    placeholderTextColor={palette.muted}
                    keyboardType="numeric"
                    value={form.target}
                    onChangeText={(target) => setForm({ ...form, target })}
                    style={styles.formInput}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>المحقق حاليًا</Text>
                  <TextInput
                    accessibilityLabel="القيمة الحالية"
                    placeholder="مثال: 0"
                    placeholderTextColor={palette.muted}
                    keyboardType="numeric"
                    value={form.current}
                    onChangeText={(current) => setForm({ ...form, current })}
                    style={styles.formInput}
                  />
                </View>
              </View>

              {/* Deadline */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الموعد النهائي (اختياري)</Text>
                <TextInput
                  accessibilityLabel="الموعد النهائي"
                  placeholder="YYYY-MM-DD (مثال: 2026-12-31)"
                  placeholderTextColor={palette.muted}
                  value={form.deadline}
                  onChangeText={(deadline) => setForm({ ...form, deadline })}
                  style={styles.formInput}
                />
              </View>
            </View>

            {formError ? (
              <View style={styles.alertError}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.alertErrorText}>{formError}</Text>
              </View>
            ) : null}

            {/* Actions */}
            <View style={styles.modalActions}>
              <PrimaryButton
                label={saving ? 'جارٍ الحفظ...' : editing ? 'تحديث الهدف' : 'حفظ الهدف'}
                disabled={saving}
                onPress={() => void saveGoal()}
              />
              <Pressable
                onPress={() => setFormVisible(false)}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Project Selector Modal */}
      <Modal
        visible={projectPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProjectPickerVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setProjectPickerVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={palette.text} />
              </Pressable>
              <Text style={styles.modalTitle}>اختر المشروع</Text>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {projects.map((p) => (
                <Pressable
                  key={p._id}
                  onPress={() => {
                    setForm({ ...form, projectId: p._id });
                    setProjectPickerVisible(false);
                  }}
                  style={[
                    styles.pickerItem,
                    form.projectId === p._id && styles.pickerItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      form.projectId === p._id && styles.pickerItemTextActive,
                    ]}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Scope Filter Modal (Sliders action) */}
      <Modal
        visible={scopeFilterVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScopeFilterVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setScopeFilterVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={palette.text} />
              </Pressable>
              <Text style={styles.modalTitle}>تصفية نطاق الأهداف</Text>
            </View>

            <View style={styles.scopeOptionsList}>
              <Pressable
                onPress={() => {
                  setScopeFilter('all');
                  setScopeFilterVisible(false);
                }}
                style={[
                  styles.pickerItem,
                  scopeFilter === 'all' && styles.pickerItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    scopeFilter === 'all' && styles.pickerItemTextActive,
                  ]}
                >
                  كل الأهداف (عامة ومشاريع)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setScopeFilter('global');
                  setScopeFilterVisible(false);
                }}
                style={[
                  styles.pickerItem,
                  scopeFilter === 'global' && styles.pickerItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    scopeFilter === 'global' && styles.pickerItemTextActive,
                  ]}
                >
                  الأهداف العامة فقط
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setScopeFilter('project');
                  setScopeFilterVisible(false);
                }}
                style={[
                  styles.pickerItem,
                  scopeFilter === 'project' && styles.pickerItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    scopeFilter === 'project' && styles.pickerItemTextActive,
                  ]}
                >
                  أهداف المشاريع فقط
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={Boolean(deleteTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconBox}>
              <Ionicons name="trash-outline" size={28} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>حذف الهدف؟</Text>
            <Text style={styles.confirmBody}>
              هل أنت متأكد من حذف «{deleteTarget?.title}»؟
            </Text>
            <View style={styles.confirmButtons}>
              <Pressable
                onPress={() => void deleteGoal()}
                style={styles.confirmDeleteBtn}
              >
                <Text style={styles.confirmDeleteBtnText}>نعم، احذف</Text>
              </Pressable>
              <Pressable
                onPress={() => setDeleteTarget(null)}
                style={styles.confirmCancelBtn}
              >
                <Text style={styles.confirmCancelBtnText}>إلغاء</Text>
              </Pressable>
            </View>
          </View>
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
  addGoalBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.primary,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  addGoalBtnPressed: {
    opacity: 0.88,
  },
  addGoalBtnText: {
    color: '#FFFFFF',
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
    marginBottom: 16,
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
  circlePercentText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 18,
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
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  filterBarRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sliderBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBtnActive: {
    borderColor: palette.primary,
    backgroundColor: '#EFF6FF',
  },
  filterPillsContainer: {
    flex: 1,
    flexDirection: 'row-reverse',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    padding: 3,
    gap: 4,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  filterPillActive: {
    backgroundColor: palette.primary,
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
  goalCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  goalCardPressed: {
    borderColor: palette.primaryBorder,
  },
  goalCardTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalIdentity: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  goalIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalIconContainerBlue: {
    backgroundColor: '#EFF6FF',
  },
  goalIconContainerAmber: {
    backgroundColor: '#FFFBEB',
  },
  goalTextsContainer: {
    alignItems: 'flex-end',
    flex: 1,
    gap: 4,
  },
  goalTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  goalSubRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  scopeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scopeBadgeBlue: {
    backgroundColor: '#EFF6FF',
  },
  scopeBadgeAmber: {
    backgroundColor: '#FEF3C7',
  },
  scopeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scopeBadgeTextBlue: {
    color: palette.primary,
  },
  scopeBadgeTextAmber: {
    color: '#D97706',
  },
  deadlineSubText: {
    fontSize: 12,
    color: palette.muted,
  },
  percentText: {
    fontSize: 20,
    fontWeight: '900',
  },
  percentTextBlue: {
    color: palette.primary,
  },
  percentTextAmber: {
    color: '#D97706',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressBarFillBlue: {
    backgroundColor: palette.primary,
  },
  progressBarFillAmber: {
    backgroundColor: '#F59E0B',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.muted,
  },
  emptyAddBtn: {
    marginTop: 8,
    backgroundColor: palette.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: palette.background,
  },
  modalScrollView: {
    flex: 1,
  },
  modalContent: {
    padding: 20,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
  detailHeroCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    gap: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  detailCardTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  detailIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitleBox: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  detailTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  detailSubtitleText: {
    fontSize: 13,
    color: palette.muted,
  },
  detailStatsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  detailStatBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailStatNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
  },
  detailStatLabel: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  quickCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  quickTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  quickDesc: {
    fontSize: 13,
    color: palette.muted,
    textAlign: 'right',
  },
  quickButtonsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 4,
  },
  quickBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  quickBtnText: {
    color: palette.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  quickBtnMuted: {
    width: 50,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBtnMutedText: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  modalActions: {
    gap: 10,
    marginTop: 6,
  },
  deleteActionBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteActionBtnText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  formSectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
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
  formInput: {
    minHeight: 48,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: palette.text,
    backgroundColor: '#F8FAFC',
    textAlign: 'right',
    fontSize: 15,
  },
  segmentedRow: {
    flexDirection: 'row-reverse',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentedText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.muted,
  },
  segmentedTextActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  dropdownInput: {
    minHeight: 48,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownInputText: {
    fontSize: 15,
    color: palette.text,
  },
  inlineInputsRow: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  cancelBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: palette.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 12,
  },
  scopeOptionsList: {
    gap: 6,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerItemActive: {
    backgroundColor: '#EFF6FF',
  },
  pickerItemText: {
    fontSize: 15,
    color: palette.text,
    textAlign: 'right',
    fontWeight: '600',
  },
  pickerItemTextActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    gap: 14,
  },
  confirmIconBox: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: palette.text,
  },
  confirmBody: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row-reverse',
    gap: 12,
    width: '100%',
    marginTop: 6,
  },
  confirmDeleteBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelBtnText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
