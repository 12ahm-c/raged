import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiClientError } from '../../api/client';
import {
  commonStyles,
  LoadingState,
  palette,
  PrimaryButton,
  ScreenState,
} from '../../components/ui/States';
import { getApiErrorMessage } from '../../utils/apiError';
import { goBackSafe } from '../../utils/goBackSafe';

export type EnglishSkill = 'reading' | 'writing' | 'listening' | 'speaking';
export type LevelStatus = 'locked' | 'unlocked' | 'completed';

export interface EnglishLevel {
  _id: string;
  index: number;
  skill: EnglishSkill;
  title: string;
  status: LevelStatus;
  contentRef?: string;
}

export interface EnglishProgress {
  skill: string;
  currentLevel: number;
  completedLevels: number;
  score: number;
}

export interface EnglishWeeklyTarget {
  target: number;
  completed: number;
  remaining: number;
}

interface SkillConfig {
  key: EnglishSkill;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  description: string;
}

const SKILLS: SkillConfig[] = [
  { key: 'reading', label: 'القراءة', iconName: 'book-outline', description: 'تطوير مهارات القراءة والاستيعاب' },
  { key: 'writing', label: 'الكتابة', iconName: 'create-outline', description: 'بناء التراكيب وقواعد الكتابة' },
  { key: 'listening', label: 'الاستماع', iconName: 'headset-outline', description: 'فهم النصوص الصوتية والمحادثات' },
  { key: 'speaking', label: 'التحدث', iconName: 'mic-outline', description: 'إتقان النطق والمحادثة اليومية' },
];

function normalizeLevels(raw: unknown): EnglishLevel[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown[] }).items)) {
    list = (raw as { items: unknown[] }).items;
  }

  return list
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      _id: String(item._id ?? ''),
      index: Number(item.index ?? 1),
      skill: (item.skill as EnglishSkill) || 'reading',
      title: String(item.title ?? `المستوى ${item.index ?? ''}`),
      status: (item.status as LevelStatus) || 'locked',
      contentRef: typeof item.contentRef === 'string' ? item.contentRef : undefined,
    }))
    .sort((a, b) => a.index - b.index);
}

function normalizeProgress(raw: unknown): Record<EnglishSkill, EnglishProgress> {
  const initial: Record<EnglishSkill, EnglishProgress> = {
    reading: { skill: 'reading', currentLevel: 1, completedLevels: 0, score: 0 },
    writing: { skill: 'writing', currentLevel: 1, completedLevels: 0, score: 0 },
    listening: { skill: 'listening', currentLevel: 1, completedLevels: 0, score: 0 },
    speaking: { skill: 'speaking', currentLevel: 1, completedLevels: 0, score: 0 },
  };

  if (!raw || typeof raw !== 'object') {
    return initial;
  }

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object' && typeof item.skill === 'string') {
        const skillKey = item.skill as EnglishSkill;
        if (initial[skillKey]) {
          initial[skillKey] = {
            skill: skillKey,
            currentLevel: Number(item.currentLevel ?? 1),
            completedLevels: Number(item.completedLevels ?? 0),
            score: Number(item.score ?? 0),
          };
        }
      }
    }
    return initial;
  }

  const rec = raw as Record<string, unknown>;
  for (const skill of ['reading', 'writing', 'listening', 'speaking'] as EnglishSkill[]) {
    if (rec[skill] && typeof rec[skill] === 'object') {
      const data = rec[skill] as Record<string, unknown>;
      initial[skill] = {
        skill,
        currentLevel: Number(data.currentLevel ?? 1),
        completedLevels: Number(data.completedLevels ?? 0),
        score: Number(data.score ?? 0),
      };
    }
  }

  return initial;
}

function normalizeWeekly(raw: unknown): EnglishWeeklyTarget {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const target = Number(obj.target ?? 3);
    const completed = Number(obj.completed ?? 0);
    const remaining = typeof obj.remaining === 'number' ? obj.remaining : Math.max(0, target - completed);
    return { target, completed, remaining };
  }
  return { target: 3, completed: 0, remaining: 3 };
}

function StatusBadge({ status }: { status: LevelStatus }) {
  if (status === 'completed') {
    return (
      <View style={styles.badgeCompleted}>
        <Ionicons name="checkmark-circle" size={13} color="#059669" />
        <Text style={styles.badgeCompletedText}>مكتمل ✓</Text>
      </View>
    );
  }
  if (status === 'unlocked') {
    return (
      <View style={styles.badgeUnlocked}>
        <Ionicons name="play-circle" size={13} color="#2563EB" />
        <Text style={styles.badgeUnlockedText}>متاح للتعلم</Text>
      </View>
    );
  }
  return (
    <View style={styles.badgeLocked}>
      <Ionicons name="lock-closed" size={13} color="#64748B" />
      <Text style={styles.badgeLockedText}>مقفل 🔒</Text>
    </View>
  );
}

export function EnglishScreen() {
  const navigation = useNavigation();

  const [selectedSkill, setSelectedSkill] = useState<EnglishSkill>('reading');
  const [levels, setLevels] = useState<EnglishLevel[]>([]);
  const [progress, setProgress] = useState<Record<EnglishSkill, EnglishProgress>>({
    reading: { skill: 'reading', currentLevel: 1, completedLevels: 0, score: 0 },
    writing: { skill: 'writing', currentLevel: 1, completedLevels: 0, score: 0 },
    listening: { skill: 'listening', currentLevel: 1, completedLevels: 0, score: 0 },
    speaking: { skill: 'speaking', currentLevel: 1, completedLevels: 0, score: 0 },
  });
  const [weekly, setWeekly] = useState<EnglishWeeklyTarget>({ target: 3, completed: 0, remaining: 3 });

  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingLevels, setLoadingLevels] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [levelsError, setLevelsError] = useState('');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string>('');
  const [detailsModalLevel, setDetailsModalLevel] = useState<EnglishLevel | null>(null);

  const loadProgress = useCallback(async () => {
    setLoadingOverview(true);
    setOverviewError('');
    try {
      const progRes = await api.getEnglishProgress();
      setProgress(normalizeProgress(progRes));
      if (progRes && typeof progRes === 'object') {
        const obj = progRes as Record<string, unknown>;
        if (obj.weeklyTarget || obj.weekly) {
          setWeekly(normalizeWeekly(obj.weeklyTarget ?? obj.weekly));
        }
      }
    } catch (err) {
      setOverviewError(getApiErrorMessage(err));
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadLevels = useCallback(async (skill: EnglishSkill) => {
    setLoadingLevels(true);
    setLevelsError('');
    try {
      const res = await api.getEnglishLevels(skill);
      setLevels(normalizeLevels(res));
    } catch (err) {
      setLevelsError(getApiErrorMessage(err));
    } finally {
      setLoadingLevels(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
    }, [loadProgress])
  );

  useFocusEffect(
    useCallback(() => {
      void loadLevels(selectedSkill);
    }, [loadLevels, selectedSkill])
  );

  const handleSkillChange = (skill: EnglishSkill) => {
    if (skill === selectedSkill) return;
    setSelectedSkill(skill);
    setCardErrors({});
    void loadLevels(skill);
  };

  const handleCompleteLevel = async (level: EnglishLevel) => {
    const levelId = level._id;
    setCompletingId(levelId);
    setCardErrors((prev) => ({ ...prev, [levelId]: '' }));

    try {
      await api.completeEnglishLevel(levelId);
      setToastMessage(`تم إكمال ${level.title} بنجاح!`);
      if (detailsModalLevel?._id === levelId) {
        setDetailsModalLevel(null);
      }
      await Promise.all([loadLevels(selectedSkill), loadProgress()]);
    } catch (err) {
      const isLocked =
        (err instanceof ApiClientError && err.code === 'LEVEL_LOCKED') ||
        (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'LEVEL_LOCKED');

      const message = isLocked
        ? 'يجب إكمال المستوى السابق أولاً'
        : getApiErrorMessage(err);

      setCardErrors((prev) => ({ ...prev, [levelId]: message }));
    } finally {
      setCompletingId(null);
    }
  };

  const totalCompleted = Object.values(progress).reduce(
    (sum, item) => sum + item.completedLevels,
    0
  );
  const totalScore = Object.values(progress).reduce(
    (sum, item) => sum + item.score,
    0
  );

  const activeSkillConfig = SKILLS.find((s) => s.key === selectedSkill) ?? SKILLS[0];
  const weeklyPercent = Math.min(100, Math.round((weekly.completed / Math.max(1, weekly.target)) * 100));

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.pageCategoryBadge}>العادات الدراسية</Text>
            <Text style={styles.pageTitle}>اللغة الإنجليزية</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="الرجوع"
            onPress={() => goBackSafe(navigation)}
            style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
          >
            <Ionicons name="arrow-forward" size={17} color={palette.primary} />
            <Text style={styles.backBtnText}>رجوع</Text>
          </Pressable>
        </View>

        {/* Success Alert Banner */}
        {toastMessage ? (
          <View style={styles.alertSuccess} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={styles.alertSuccessText}>{toastMessage}</Text>
            <Pressable onPress={() => setToastMessage('')}>
              <Ionicons name="close" size={16} color="#059669" />
            </Pressable>
          </View>
        ) : null}

        {/* Hero Progress Banner */}
        <LinearGradient
          colors={['#1E3A8A', '#2563EB', '#4F46E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <View style={styles.circleProgressTrack}>
              <Text style={styles.circleProgressNum}>{totalCompleted}</Text>
              <Text style={styles.circleProgressSub}>مستوى</Text>
            </View>

            <View style={styles.heroTexts}>
              <Text style={styles.heroTitle}>مسار الإنجليزية (A1 → C1)</Text>
              <Text style={styles.heroSubtitle}>
                30 مستوى لكل مهارة · الجدول كل يومين وعطلة الأحد
              </Text>
            </View>
          </View>

          {/* 3 Stats Boxes */}
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatBox}>
              <Ionicons name="trophy-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{totalScore}</Text>
              <Text style={styles.heroStatLabel}>مجموع النقاط</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Ionicons name="checkmark-done-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{totalCompleted}</Text>
              <Text style={styles.heroStatLabel}>مستويات منجزة</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{weekly.completed} / {weekly.target}</Text>
              <Text style={styles.heroStatLabel}>هدف الأسبوع</Text>
            </View>
          </View>

          {/* Weekly Target Bar */}
          <View style={styles.weeklyBox}>
            <View style={styles.weeklyLabelsRow}>
              <Text style={styles.weeklyPercentText}>{weeklyPercent}%</Text>
              <Text style={styles.weeklyLabelText}>الهدف الأسبوعي (3 مستويات)</Text>
            </View>
            <View style={styles.weeklyBarTrack}>
              <View style={[styles.weeklyBarFill, { width: `${weeklyPercent}%` }]} />
            </View>
            <Text style={styles.weeklyHintText}>
              {weekly.remaining > 0
                ? `متبقي ${weekly.remaining} مستويات هذا الأسبوع للحفاظ على المعدل المطلوب.`
                : 'رائع جداً! أتممت هدف هذا الأسبوع بالكامل 👏'}
            </Text>
          </View>
        </LinearGradient>

        {/* Skill Selector Tabs */}
        <View style={styles.skillsSelectorRow}>
          {SKILLS.map((skill) => {
            const skillProg = progress[skill.key];
            const isSelected = selectedSkill === skill.key;
            return (
              <Pressable
                key={skill.key}
                accessibilityRole="button"
                onPress={() => handleSkillChange(skill.key)}
                style={({ pressed }) => [
                  styles.skillTab,
                  isSelected && styles.skillTabSelected,
                  pressed && styles.btnPressed,
                ]}
              >
                <Ionicons
                  name={skill.iconName}
                  size={20}
                  color={isSelected ? '#FFFFFF' : palette.primary}
                />
                <Text style={[styles.skillTabLabel, isSelected && styles.skillTabLabelSelected]}>
                  {skill.label}
                </Text>
                <View style={[styles.skillTabCountBadge, isSelected && styles.skillTabCountBadgeSelected]}>
                  <Text style={[styles.skillTabCountText, isSelected && styles.skillTabCountTextSelected]}>
                    {skillProg.completedLevels}/30
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            مستويات {activeSkillConfig.label}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{levels.length} مستويات</Text>
          </View>
        </View>

        {/* Loading Levels */}
        {loadingLevels ? (
          <LoadingState label={`جارٍ تحميل مستويات ${activeSkillConfig.label}...`} />
        ) : null}

        {/* Error State */}
        {levelsError ? (
          <ScreenState
            title="تعذر تحميل المستويات"
            message={levelsError}
            actionLabel="إعادة المحاولة"
            onAction={() => void loadLevels(selectedSkill)}
          />
        ) : null}

        {/* Empty Levels State */}
        {!loadingLevels && !levelsError && levels.length === 0 ? (
          <ScreenState
            title="لا توجد مستويات"
            message={`لم يتم العثور على أي مستويات لمهارة ${activeSkillConfig.label} حالياً.`}
          />
        ) : null}

        {/* Level Cards List */}
        {!loadingLevels &&
          !levelsError &&
          levels.map((level) => {
            const isCompleting = completingId === level._id;
            const inlineError = cardErrors[level._id];
            const isCompleted = level.status === 'completed';
            const isUnlocked = level.status === 'unlocked';
            const isLocked = level.status === 'locked';

            return (
              <View
                key={level._id}
                style={[
                  styles.levelCard,
                  isCompleted && styles.cardCompleted,
                  isLocked && styles.cardLocked,
                ]}
              >
                <View style={styles.levelCardHeader}>
                  <View style={styles.levelTitleGroup}>
                    <Text style={styles.levelCardTitle}>
                      المستوى {level.index}: {level.title}
                    </Text>
                    {level.contentRef ? (
                      <Text style={styles.contentRefText}>المرجع: {level.contentRef}</Text>
                    ) : null}
                  </View>
                  <StatusBadge status={level.status} />
                </View>

                {inlineError ? (
                  <View style={styles.alertError} accessibilityRole="alert">
                    <Ionicons name="alert-circle" size={15} color="#EF4444" />
                    <Text style={styles.alertErrorText}>{inlineError}</Text>
                  </View>
                ) : null}

                <View style={styles.levelCardFooter}>
                  {isUnlocked ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isCompleting}
                      onPress={() => void handleCompleteLevel(level)}
                      style={({ pressed }) => [
                        styles.completeBtn,
                        isCompleting && styles.btnDisabled,
                        pressed && !isCompleting && styles.btnPressed,
                      ]}
                    >
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      <Text style={styles.completeBtnText}>
                        {isCompleting ? 'جارٍ الإكمال...' : 'إكمال المستوى'}
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDetailsModalLevel(level)}
                    style={styles.detailsBtn}
                  >
                    <Text style={styles.detailsBtnText}>عرض التفاصيل</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
      </ScrollView>

      {/* Details & Info Modal */}
      <Modal
        visible={detailsModalLevel !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsModalLevel(null)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.dialogScroll}>
            <View style={styles.dialog}>
              <View style={styles.dialogHeader}>
                <Text style={styles.dialogTitle}>
                  المستوى {detailsModalLevel?.index}: {detailsModalLevel?.title}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setDetailsModalLevel(null)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>المهارة</Text>
                <Text style={styles.fieldValue}>
                  {SKILLS.find((s) => s.key === detailsModalLevel?.skill)?.label ?? detailsModalLevel?.skill}
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الحالة</Text>
                <View style={styles.modalBadgeRow}>
                  {detailsModalLevel ? <StatusBadge status={detailsModalLevel.status} /> : null}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>المحتوى / المرجع</Text>
                <Text style={styles.fieldValue}>
                  {detailsModalLevel?.contentRef || 'لا يوجد مرجع إضافي مسجل لهذا المستوى.'}
                </Text>
              </View>

              {detailsModalLevel && cardErrors[detailsModalLevel._id] ? (
                <View style={styles.alertError} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={15} color="#EF4444" />
                  <Text style={styles.alertErrorText}>{cardErrors[detailsModalLevel._id]}</Text>
                </View>
              ) : null}

              {detailsModalLevel?.status === 'unlocked' ? (
                <PrimaryButton
                  label={completingId === detailsModalLevel._id ? 'جارٍ الإكمال...' : 'إكمال هذا المستوى ✓'}
                  disabled={completingId === detailsModalLevel._id}
                  onPress={() => void handleCompleteLevel(detailsModalLevel)}
                />
              ) : null}
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
    color: palette.primary,
    marginBottom: 2,
    textAlign: 'right',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
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
    shadowColor: palette.primary,
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
  weeklyBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  weeklyLabelsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weeklyLabelText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '700',
  },
  weeklyPercentText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  weeklyBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
  },
  weeklyBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  weeklyHintText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    textAlign: 'right',
  },
  skillsSelectorRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  skillTab: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  skillTabSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    shadowColor: palette.primary,
    shadowOpacity: 0.25,
    elevation: 3,
  },
  skillTabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.text,
  },
  skillTabLabelSelected: {
    color: '#FFFFFF',
  },
  skillTabCountBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  skillTabCountBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  skillTabCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.primary,
  },
  skillTabCountTextSelected: {
    color: '#FFFFFF',
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
  levelCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardCompleted: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  cardLocked: {
    backgroundColor: '#F8FAFC',
    opacity: 0.85,
  },
  levelCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  levelTitleGroup: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  levelCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  contentRefText: {
    fontSize: 12,
    color: palette.muted,
    textAlign: 'right',
  },
  levelCardFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  badgeCompleted: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeCompletedText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeUnlocked: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeUnlockedText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeLocked: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeLockedText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  completeBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  detailsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  detailsBtnText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.5,
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
    maxWidth: 540,
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
    fontSize: 18,
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
    gap: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'right',
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.text,
    textAlign: 'right',
  },
  modalBadgeRow: {
    flexDirection: 'row-reverse',
  },
});
