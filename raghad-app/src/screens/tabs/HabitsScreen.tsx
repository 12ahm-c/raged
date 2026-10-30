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
import type { NavigationProp } from '@react-navigation/native';
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
  HabitCreateRequestDTO,
  HabitDTO,
  HabitUpdateRequestDTO,
} from '../../types/dto';
import type { RootStackParamList } from '../../navigation/types';
import { getApiErrorMessage } from '../../utils/apiError';
import { openHabitPage, specialPageFor } from '../../utils/habitSpecialRoutes';

const categories: HabitDTO['category'][] = [
  'spiritual',
  'health',
  'study',
  'social',
  'financial',
  'other',
];
const timeSlots: HabitDTO['timeSlot'][] = ['morning', 'evening', 'allTime', 'flexible'];
const specials: HabitDTO['config']['special'][] = [
  'none',
  'quran',
  'reading',
  'english',
  'exercise',
  'brotherhood',
  'family',
  'pockets',
  'programs',
  'money',
  'beek',
];

const categoryNames: Record<HabitDTO['category'], string> = {
  spiritual: 'روحي',
  health: 'صحي',
  study: 'دراسة',
  social: 'اجتماعي',
  financial: 'مالي',
  other: 'أخرى',
};

const categoryIcons: Record<HabitDTO['category'], keyof typeof Ionicons.glyphMap> = {
  spiritual: 'sparkles-outline',
  health: 'fitness-outline',
  study: 'book-outline',
  social: 'people-outline',
  financial: 'wallet-outline',
  other: 'grid-outline',
};

const timeNames: Record<HabitDTO['timeSlot'], string> = {
  morning: 'صباحاً',
  evening: 'مساءً',
  allTime: 'طوال اليوم',
  flexible: 'مرن',
};

const specialNames: Record<HabitDTO['config']['special'], string> = {
  none: 'لا توجد',
  quran: 'القرآن',
  reading: 'القراءة',
  english: 'الإنجليزية',
  exercise: 'الرياضة',
  brotherhood: 'الأخوة',
  family: 'العائلة',
  pockets: 'المصروف',
  programs: 'البرامج',
  money: 'المال',
  beek: 'البيك',
};

function getHabitIcon(habit: HabitDTO): keyof typeof Ionicons.glyphMap {
  const name = habit.name.toLowerCase();
  if (name.includes('ليل') || name.includes('قيام')) return 'moon-outline';
  if (name.includes('استيقاظ') || name.includes('فجر') || name.includes('صباح')) return 'sunny-outline';
  if (name.includes('دعاء') || name.includes('ذكر') || name.includes('أذكار')) return 'heart-outline';
  if (name.includes('مسجد') || name.includes('صلاة')) return 'business-outline';
  if (name.includes('رياضة') || habit.category === 'health' || habit.config?.special === 'exercise') return 'barbell-outline';
  if (name.includes('قرآن') || habit.config?.special === 'quran') return 'book-outline';
  if (name.includes('قراءة') || habit.config?.special === 'reading') return 'bookmarks-outline';
  if (name.includes('إنجليز') || habit.config?.special === 'english') return 'language-outline';
  if (habit.category === 'social' || habit.config?.special === 'brotherhood' || habit.config?.special === 'family') return 'people-outline';
  if (habit.category === 'financial' || habit.config?.special === 'money') return 'cash-outline';
  return categoryIcons[habit.category] || 'checkmark-circle-outline';
}

function getCategoryPillColors(category: HabitDTO['category']) {
  switch (category) {
    case 'spiritual':
      return { bg: '#E0F2FE', text: '#0284C7' };
    case 'health':
      return { bg: '#DCFCE7', text: '#15803D' };
    case 'study':
      return { bg: '#F3E8FF', text: '#7E22CE' };
    case 'social':
      return { bg: '#FFE4E6', text: '#BE123C' };
    case 'financial':
      return { bg: '#FEF9C3', text: '#A16207' };
    default:
      return { bg: '#F1F5F9', text: '#475569' };
  }
}

interface HabitFormState extends HabitCreateRequestDTO {
  suggestedTimeText: string;
}

const initialForm: HabitFormState = {
  name: '',
  type: 'daily',
  category: 'other',
  timeSlot: 'flexible',
  isHobby: false,
  suggestedTimeText: '',
  config: { special: 'none' },
};

export function HabitsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [habits, setHabits] = useState<HabitDTO[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState<'all' | HabitDTO['type']>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | HabitDTO['category']>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | HabitDTO['timeSlot']>('all');
  const [hobbyFilter, setHobbyFilter] = useState<'all' | boolean>('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<HabitDTO | null>(null);
  const [form, setForm] = useState<HabitFormState>(initialForm);
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<HabitDTO | null>(null);
  const [success, setSuccess] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const loadHabits = useCallback(async (targetPage = 1, searchOverride?: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await api.listHabits({
        page: targetPage,
        limit: 20,
        type: typeFilter === 'all' ? undefined : typeFilter,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        timeSlot: timeFilter === 'all' ? undefined : timeFilter,
        isHobby: hobbyFilter === 'all' ? undefined : hobbyFilter,
        search: (searchOverride ?? appliedSearch).trim() || undefined,
        active: true,
      });
      setHabits(result.items);
      setPage(result.meta.page);
      setTotal(result.meta.total);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, categoryFilter, hobbyFilter, timeFilter, typeFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadHabits(1);
    }, [loadHabits])
  );

  function openCreate() {
    setEditing(null);
    setForm(initialForm);
    setFieldError('');
    setFormVisible(true);
  }

  function openEdit(habit: HabitDTO) {
    setEditing(habit);
    setForm({
      name: habit.name,
      type: habit.type,
      category: habit.category,
      timeSlot: habit.timeSlot,
      isHobby: habit.isHobby,
      suggestedTimeText: habit.suggestedTime ?? '',
      config: habit.config,
    });
    setFieldError('');
    setFormVisible(true);
  }

  async function saveHabit() {
    setFieldError('');
    if (form.name.trim().length < 2 || form.name.trim().length > 100) {
      setFieldError('يجب أن يكون اسم العادة بين حرفين و100 حرف.');
      return;
    }
    if (
      form.suggestedTimeText &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(form.suggestedTimeText)
    ) {
      setFieldError('اكتب الوقت بصيغة ساعة:دقيقة، مثل 05:30.');
      return;
    }

    const payload: HabitCreateRequestDTO = {
      name: form.name.trim(),
      type: form.type,
      category: form.category,
      timeSlot: form.timeSlot,
      isHobby: form.isHobby,
      config: form.config,
      ...(form.suggestedTimeText ? { suggestedTime: form.suggestedTimeText } : {}),
    };
    setSaving(true);
    try {
      if (editing) {
        const changes: HabitUpdateRequestDTO = {};
        for (const key of ['name', 'type', 'category', 'timeSlot', 'isHobby', 'config'] as const) {
          if (JSON.stringify(payload[key]) !== JSON.stringify(editing[key])) {
            Object.assign(changes, { [key]: payload[key] });
          }
        }
        if (payload.suggestedTime !== editing.suggestedTime) {
          if (payload.suggestedTime) {
            Object.assign(changes, { suggestedTime: payload.suggestedTime });
          } else if (editing.suggestedTime) {
            setFieldError('لا يمكن مسح الوقت المقترح عبر الحقول الموثقة في عقد API الحالي.');
            return;
          }
        }
        await api.updateHabit(editing._id, changes);
        setSuccess('تم تحديث العادة بنجاح.');
      } else {
        await api.createHabit(payload);
        setSuccess('تمت إضافة العادة بنجاح.');
      }
      setFormVisible(false);
      await loadHabits(1);
    } catch (requestError) {
      setFieldError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.deleteHabit(deleting._id);
      setDeleting(null);
      setSuccess('تم حذف العادة بنجاح.');
      await loadHabits(1);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setDeleting(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={commonStyles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Row: Title on right, Add Habit button on left */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.pageTitle}>عاداتي</Text>
            <Text style={styles.pageSubtitle}>{total} عادة</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إضافة عادة جديدة"
            onPress={openCreate}
            style={({ pressed }) => [
              styles.addHabitButton,
              pressed && styles.addHabitButtonPressed,
            ]}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addHabitButtonText}>إضافة عادة</Text>
          </Pressable>
        </View>

        {/* Search & Filter Bar */}
        <View style={styles.searchRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="تصفية متقدمة"
            onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
            style={[
              styles.filterIconButton,
              showAdvancedFilters && styles.filterIconButtonActive,
            ]}
          >
            <Ionicons
              name={showAdvancedFilters ? 'close-outline' : 'options-outline'}
              size={20}
              color={showAdvancedFilters ? palette.primary : palette.muted}
            />
          </Pressable>

          <View style={styles.searchInputContainer}>
            <Ionicons name="search-outline" size={19} color={palette.muted} />
            <TextInput
              accessibilityLabel="ابحث عن عادة"
              placeholder="ابحث عن عادة"
              placeholderTextColor={palette.muted}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => {
                setAppliedSearch(search);
                void loadHabits(1, search);
              }}
              returnKeyType="search"
              style={styles.searchInput}
            />
            {search ? (
              <Pressable
                onPress={() => {
                  setSearch('');
                  setAppliedSearch('');
                  void loadHabits(1, '');
                }}
              >
                <Ionicons name="close-circle" size={18} color={palette.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Filter Pills Row 1: النوع (الكل، يومية، موسمية) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          <FilterPill
            label="الكل"
            active={typeFilter === 'all'}
            onPress={() => {
              setTypeFilter('all');
            }}
          />
          <FilterPill
            label="يومية"
            active={typeFilter === 'daily'}
            onPress={() => {
              setTypeFilter('daily');
            }}
          />
          <FilterPill
            label="موسمية"
            active={typeFilter === 'seasonal'}
            onPress={() => {
              setTypeFilter('seasonal');
            }}
          />
        </ScrollView>

        {/* Filter Pills Row 2: التصنيف (الكل، روحي، صحي، دراسة، اجتماعي، مالي، أخرى) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          <FilterPill
            label="الكل"
            active={categoryFilter === 'all'}
            onPress={() => setCategoryFilter('all')}
          />
          {categories.map((cat) => (
            <FilterPill
              key={cat}
              label={categoryNames[cat]}
              active={categoryFilter === cat}
              onPress={() => setCategoryFilter(cat)}
            />
          ))}
        </ScrollView>

        {/* Optional Advanced Filters dropdown */}
        {showAdvancedFilters ? (
          <View style={styles.advancedFiltersCard}>
            <Text style={styles.filterSectionTitle}>فترة التنفيذ</Text>
            <View style={styles.chipsWrap}>
              <FilterPill
                label="الكل"
                active={timeFilter === 'all'}
                onPress={() => setTimeFilter('all')}
              />
              {timeSlots.map((slot) => (
                <FilterPill
                  key={slot}
                  label={timeNames[slot]}
                  active={timeFilter === slot}
                  onPress={() => setTimeFilter(slot)}
                />
              ))}
            </View>

            <Text style={[styles.filterSectionTitle, { marginTop: 10 }]}>نوع النشاط</Text>
            <View style={styles.chipsWrap}>
              <FilterPill
                label="الكل"
                active={hobbyFilter === 'all'}
                onPress={() => setHobbyFilter('all')}
              />
              <FilterPill
                label="أساسية"
                active={hobbyFilter === false}
                onPress={() => setHobbyFilter(false)}
              />
              <FilterPill
                label="هواية"
                active={hobbyFilter === true}
                onPress={() => setHobbyFilter(true)}
              />
            </View>
          </View>
        ) : null}

        {/* Yellow/Amber Points Rule Card */}
        <View style={styles.pointsRuleCard}>
          <Text style={styles.pointsRuleText}>
            قاعدة النقاط: +1 عند تنفيذ العادة و - 1 إذا لم تُنفّذ قبل 23:00. يتغير الروتين وُفق وقتها.
          </Text>
          <View style={styles.starBadge}>
            <Ionicons name="star" size={18} color="#D97706" />
          </View>
        </View>

        {/* Feedback Alerts */}
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

        {loading ? <LoadingState label="جارٍ تحميل العادات..." /> : null}

        {!loading && habits.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="list-outline" size={38} color={palette.muted} />
            <Text style={styles.emptyTitle}>لا توجد عادات مطابقة</Text>
            <Text style={styles.emptySubtitle}>جرب تغيير الفلاتر أو أضف عادة جديدة.</Text>
            <Pressable style={styles.emptyAddBtn} onPress={openCreate}>
              <Text style={styles.emptyAddBtnText}>+ إضافة عادة</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Habits Cards List */}
        {habits.map((habit) => {
          const habitIcon = getHabitIcon(habit);
          const categoryColors = getCategoryPillColors(habit.category);
          const hasSpecialPage = habit.config && habit.config.special !== 'none' && specialPageFor(habit.config.special);

          return (
            <View key={habit._id} style={styles.habitCard}>
              {/* Top Row: Habit Name + Icon on right, Time Badge on left */}
              <View style={styles.habitCardTop}>
                <View style={styles.habitIdentity}>
                  <View style={styles.habitIconContainer}>
                    <Ionicons name={habitIcon} size={22} color={palette.primary} />
                  </View>
                  <Text style={styles.habitCardTitle}>{habit.name}</Text>
                </View>

                {habit.suggestedTime ? (
                  <View style={styles.timeBadge}>
                    <Text style={styles.timeBadgeText}>{habit.suggestedTime}</Text>
                  </View>
                ) : null}
              </View>

              {/* Tags Row */}
              <View style={styles.tagsRow}>
                {/* Time slot tag */}
                <View style={styles.tagAmber}>
                  <Text style={styles.tagAmberText}>{timeNames[habit.timeSlot]}</Text>
                </View>

                {/* Category tag */}
                <View style={[styles.tagCustom, { backgroundColor: categoryColors.bg }]}>
                  <Text style={[styles.tagCustomText, { color: categoryColors.text }]}>
                    {categoryNames[habit.category]}
                  </Text>
                </View>

                {/* Type tag */}
                <View style={styles.tagBlue}>
                  <Text style={styles.tagBlueText}>
                    {habit.type === 'daily' ? 'يومية' : 'موسمية'}
                  </Text>
                </View>

                {/* Special page tag if linked */}
                {hasSpecialPage ? (
                  <Pressable
                    onPress={() => openHabitPage(navigation, habit._id, habit.config?.special)}
                    style={styles.tagSpecial}
                  >
                    <Ionicons name="link-outline" size={13} color={palette.primary} />
                    <Text style={styles.tagSpecialText}>
                      صفحة خاصة: {specialNames[habit.config.special]}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Actions Row: Details pill, Edit icon, Delete icon */}
              <View style={styles.actionsRow}>
                {/* Details Button */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`تفاصيل ${habit.name}`}
                  onPress={() => navigation.navigate('HabitDetail', { id: habit._id })}
                  style={({ pressed }) => [
                    styles.detailsButton,
                    pressed && styles.detailsButtonPressed,
                  ]}
                >
                  <Text style={styles.detailsButtonText}>التفاصيل</Text>
                </Pressable>

                {/* Edit Button */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`تعديل ${habit.name}`}
                  onPress={() => openEdit(habit)}
                  style={({ pressed }) => [
                    styles.iconActionButton,
                    pressed && styles.iconActionButtonPressed,
                  ]}
                >
                  <Ionicons name="pencil-outline" size={18} color="#475569" />
                </Pressable>

                {/* Delete Button */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`حذف ${habit.name}`}
                  onPress={() => setDeleting(habit)}
                  style={({ pressed }) => [
                    styles.deleteIconButton,
                    pressed && styles.deleteIconButtonPressed,
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          );
        })}

        {/* Pagination Controls */}
        {!loading && total > 20 ? (
          <View style={styles.paginationRow}>
            <Pressable
              disabled={page <= 1}
              onPress={() => void loadHabits(page - 1)}
              style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
            >
              <Text style={styles.pageBtnText}>السابق</Text>
            </Pressable>
            <Text style={styles.pageInfoText}>
              صفحة {page} من {Math.ceil(total / 20)}
            </Text>
            <Pressable
              disabled={page * 20 >= total}
              onPress={() => void loadHabits(page + 1)}
              style={[styles.pageBtn, page * 20 >= total && styles.pageBtnDisabled]}
            >
              <Text style={styles.pageBtnText}>التالي</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* Add / Edit Habit Modal (Formulaire) */}
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
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
                onPress={() => setFormVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={palette.text} />
              </Pressable>
              <Text style={styles.modalTitle}>
                {editing ? 'تعديل العادة' : 'إضافة عادة جديدة'}
              </Text>
            </View>

            {/* Section 1: Basic Information */}
            <View style={styles.formCard}>
              <Text style={styles.formSectionHeading}>المعلومات الأساسية</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>اسم العادة *</Text>
                <TextInput
                  accessibilityLabel="اسم العادة"
                  placeholder="مثال: الاستيقاظ المبكر، صلاة الفجر..."
                  placeholderTextColor={palette.muted}
                  maxLength={100}
                  value={form.name}
                  onChangeText={(name) => setForm({ ...form, name })}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>نوع العادة</Text>
                <View style={styles.segmentedRow}>
                  <Pressable
                    onPress={() => setForm({ ...form, type: 'daily' })}
                    style={[
                      styles.segmentedItem,
                      form.type === 'daily' && styles.segmentedItemActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentedText,
                        form.type === 'daily' && styles.segmentedTextActive,
                      ]}
                    >
                      يومية
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setForm({ ...form, type: 'seasonal' })}
                    style={[
                      styles.segmentedItem,
                      form.type === 'seasonal' && styles.segmentedItemActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentedText,
                        form.type === 'seasonal' && styles.segmentedTextActive,
                      ]}
                    >
                      موسمية
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Hobby switch */}
              <View style={styles.switchRow}>
                <View style={styles.switchTexts}>
                  <Text style={styles.switchTitle}>تصنيف العادة كهواية</Text>
                  <Text style={styles.switchSubtitle}>
                    تُنفّذ بعد تمام الأساسيات ولا تُخصم نقاطها إذا لم تُنجز.
                  </Text>
                </View>
                <Switch
                  value={form.isHobby}
                  onValueChange={(isHobby) => setForm({ ...form, isHobby })}
                  trackColor={{ false: '#E2E8F0', true: palette.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Section 2: Category and Timing */}
            <View style={styles.formCard}>
              <Text style={styles.formSectionHeading}>التصنيف والموعد</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>التصنيف</Text>
                <View style={styles.chipsWrap}>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setForm({ ...form, category: cat })}
                      style={[
                        styles.selectChip,
                        form.category === cat && styles.selectChipActive,
                      ]}
                    >
                      <Ionicons
                        name={categoryIcons[cat]}
                        size={16}
                        color={form.category === cat ? '#FFFFFF' : palette.text}
                      />
                      <Text
                        style={[
                          styles.selectChipText,
                          form.category === cat && styles.selectChipTextActive,
                        ]}
                      >
                        {categoryNames[cat]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>فترة اليوم المفضلة</Text>
                <View style={styles.chipsWrap}>
                  {timeSlots.map((slot) => (
                    <Pressable
                      key={slot}
                      onPress={() => setForm({ ...form, timeSlot: slot })}
                      style={[
                        styles.selectChip,
                        form.timeSlot === slot && styles.selectChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectChipText,
                          form.timeSlot === slot && styles.selectChipTextActive,
                        ]}
                      >
                        {timeNames[slot]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الوقت المقترح (ساعة:دقيقة)</Text>
                <View style={styles.timeInputBox}>
                  <Ionicons name="time-outline" size={19} color={palette.muted} />
                  <TextInput
                    accessibilityLabel="الوقت المقترح"
                    placeholder="مثال: 05:30 أو 21:00"
                    placeholderTextColor={palette.muted}
                    value={form.suggestedTimeText}
                    onChangeText={(suggestedTimeText) => setForm({ ...form, suggestedTimeText })}
                    style={styles.timeInput}
                  />
                </View>
              </View>
            </View>

            {/* Section 3: Special Integration */}
            <View style={styles.formCard}>
              <Text style={styles.formSectionHeading}>ربط بصفحة خاصة وميزات متقدمة</Text>
              <Text style={styles.formSectionSubtitle}>
                يمكنك ربط العادة بصفحتها المخصصة في التطبيق لسهولة المتابعة.
              </Text>

              <View style={styles.chipsWrap}>
                {specials.map((spec) => (
                  <Pressable
                    key={spec}
                    onPress={() => setForm({ ...form, config: { special: spec } })}
                    style={[
                      styles.selectChip,
                      form.config.special === spec && styles.selectChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectChipText,
                        form.config.special === spec && styles.selectChipTextActive,
                      ]}
                    >
                      {specialNames[spec]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {fieldError ? (
              <View style={styles.alertError}>
                <Ionicons name="alert-circle" size={18} color="#EF4444" />
                <Text style={styles.alertErrorText}>{fieldError}</Text>
              </View>
            ) : null}

            {/* Submit / Cancel Buttons */}
            <View style={styles.modalActions}>
              <PrimaryButton
                label={saving ? 'جارٍ الحفظ...' : editing ? 'تحديث العادة' : 'حفظ العادة'}
                disabled={saving}
                onPress={() => void saveHabit()}
              />
              <Pressable
                onPress={() => setFormVisible(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>إلغاء</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={Boolean(deleting)}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleting(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconContainer}>
              <Ionicons name="trash-outline" size={28} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>حذف العادة؟</Text>
            <Text style={styles.confirmBody}>
              هل أنت متأكد من حذف «{deleting?.name}»؟ سيتم إخفاؤها من جدول اليوم مع الحفاظ على سجلها السابق.
            </Text>
            <View style={styles.confirmButtons}>
              <Pressable
                onPress={() => void confirmDelete()}
                style={styles.confirmDeleteBtn}
              >
                <Text style={styles.confirmDeleteBtnText}>نعم، احذف</Text>
              </Pressable>
              <Pressable
                onPress={() => setDeleting(null)}
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

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.filterPill, active && styles.filterPillActive]}
    >
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
        {label}
      </Text>
    </Pressable>
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
  addHabitButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.primary,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  addHabitButtonPressed: {
    opacity: 0.88,
  },
  addHabitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 46,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: palette.text,
    height: '100%',
  },
  filterIconButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconButtonActive: {
    borderColor: palette.primary,
    backgroundColor: '#EFF6FF',
  },
  filterPillsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingBottom: 10,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
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
  advancedFiltersCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'right',
    marginBottom: 8,
  },
  pointsRuleCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  starBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsRuleText: {
    flex: 1,
    fontSize: 13,
    color: '#78350F',
    textAlign: 'right',
    lineHeight: 20,
    fontWeight: '500',
  },
  habitCard: {
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
  },
  habitCardTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  habitIdentity: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  habitIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
    flex: 1,
  },
  timeBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  timeBadgeText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
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
  tagCustom: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagCustomText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tagSpecial: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagSpecialText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailsButton: {
    flex: 1,
    height: 40,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButtonPressed: {
    backgroundColor: '#DBEAFE',
  },
  detailsButtonText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  iconActionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActionButtonPressed: {
    backgroundColor: '#E2E8F0',
  },
  deleteIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIconButtonPressed: {
    backgroundColor: '#FEE2E2',
  },
  paginationRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.primary,
  },
  pageInfoText: {
    fontSize: 14,
    color: palette.muted,
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
  formSectionSubtitle: {
    fontSize: 13,
    color: palette.muted,
    textAlign: 'right',
    marginTop: -8,
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
  switchRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  switchTexts: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 10,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'right',
  },
  switchSubtitle: {
    fontSize: 12,
    color: palette.muted,
    textAlign: 'right',
    marginTop: 2,
  },
  chipsWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  selectChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  selectChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
  selectChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  timeInputBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 8,
  },
  timeInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 15,
    color: palette.text,
    height: '100%',
  },
  modalActions: {
    gap: 10,
    marginTop: 6,
  },
  cancelButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
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
  confirmCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  confirmIconContainer: {
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
