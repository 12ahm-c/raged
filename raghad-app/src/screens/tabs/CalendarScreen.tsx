import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
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
  CalendarEventCreateRequestDTO,
  CalendarEventDTO,
  ProjectDTO,
} from '../../types/dto';
import type { RootStackParamList } from '../../navigation/types';
import { getApiErrorMessage } from '../../utils/apiError';

type ViewMode = 'month' | 'week';

const eventTypes: CalendarEventDTO['type'][] = [
  'task',
  'habit',
  'project',
  'goal',
  'reminder',
  'custom',
];

const eventTypeLabels: Record<CalendarEventDTO['type'], string> = {
  task: 'مهمة',
  habit: 'عادة',
  project: 'مشروع',
  goal: 'هدف',
  reminder: 'تذكير',
  custom: 'مخصص',
};

const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const dateIso = (date: Date) => `${dateKey(date)}T00:00:00.000Z`;

function formatSelectedDate(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('ar-MR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function CalendarScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [mode, setMode] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [projectPickerVisible, setProjectPickerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<CalendarEventDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEventDTO | null>(null);
  const [detailEvent, setDetailEvent] = useState<CalendarEventDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [form, setForm] = useState({
    title: '',
    date: selectedDate,
    endDate: '',
    type: 'custom' as CalendarEventDTO['type'],
    note: '',
    projectId: '',
    refId: '',
  });

  const range = useMemo(() => {
    if (mode === 'month') {
      return {
        from: dateIso(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
        to: dateIso(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)),
      };
    }
    const start = new Date(anchor);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: dateIso(start), to: dateIso(end) };
  }, [anchor, mode]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.getCalendarMain(
        range.from,
        range.to,
        projectFilter || undefined
      );
      setEvents(
        [...result.past, ...result.upcoming].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, projectFilter]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    let cancelled = false;
    void api
      .listProjects({ limit: 100 })
      .then((result) => {
        if (!cancelled) setProjects(result.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const monthDays = useMemo(() => {
    if (mode !== 'month') return [];
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const offset = first.getDay();
    const count = new Date(
      anchor.getFullYear(),
      anchor.getMonth() + 1,
      0
    ).getDate();
    const cells: (Date | null)[] = Array.from({ length: offset }, () => null);
    for (let day = 1; day <= count; day += 1) {
      cells.push(new Date(anchor.getFullYear(), anchor.getMonth(), day));
    }
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [anchor, mode]);

  const weekDays = useMemo(() => {
    if (mode !== 'week') return [];
    const start = new Date(anchor);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [anchor, mode]);

  const selectedEvents = useMemo(
    () => events.filter((e) => dateKey(new Date(e.date)) === selectedDate),
    [events, selectedDate]
  );

  function moveRange(direction: number) {
    const next = new Date(anchor);
    if (mode === 'month') next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * 7);
    setAnchor(next);
    setSelectedDate(dateKey(next));
  }

  function openCreate() {
    setEditing(null);
    setFormError('');
    setForm({
      title: '',
      date: selectedDate,
      endDate: '',
      type: 'custom',
      note: '',
      projectId: projectFilter || '',
      refId: '',
    });
    setFormVisible(true);
  }

  function openEdit(event: CalendarEventDTO) {
    setEditing(event);
    setFormError('');
    setForm({
      title: event.title,
      date: dateKey(new Date(event.date)),
      endDate: event.endDate ? dateKey(new Date(event.endDate)) : '',
      type: event.type,
      note: event.note ?? '',
      projectId: event.projectId ?? '',
      refId: event.refId ?? '',
    });
    setFormVisible(true);
  }

  async function saveEvent() {
    if (!form.title.trim()) {
      setFormError('عنوان الحدث مطلوب.');
      return;
    }
    if (Number.isNaN(new Date(`${form.date.slice(0, 10)}T00:00:00.000Z`).getTime())) {
      setFormError('أدخل تاريخاً صالحاً.');
      return;
    }
    const input: CalendarEventCreateRequestDTO = {
      title: form.title.trim(),
      date: `${form.date.slice(0, 10)}T00:00:00.000Z`,
      ...(form.endDate.trim() ? { endDate: `${form.endDate.slice(0, 10)}T00:00:00.000Z` } : {}),
      type: form.type,
      ...(form.projectId.trim() ? { projectId: form.projectId.trim() } : {}),
      ...(form.refId.trim() ? { refId: form.refId.trim() } : {}),
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    };
    setSaving(true);
    setFormError('');
    try {
      if (editing) await api.updateCalendarEvent(editing._id, input);
      else await api.createCalendarEvent(input);
      setFormVisible(false);
      setSuccess(editing ? 'تم تحديث الحدث بنجاح.' : 'تمت إضافة الحدث بنجاح.');
      await load();
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.deleteCalendarEvent(deleteTarget._id);
      setDeleteTarget(null);
      setDetailEvent(null);
      setSuccess('تم حذف الحدث بنجاح.');
      await load();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  }

  const rangeTitle =
    mode === 'month'
      ? anchor.toLocaleDateString('ar-MR', { month: 'long', year: 'numeric' })
      : `${range.from.slice(0, 10)} — ${range.to.slice(0, 10)}`;

  const activeProjectName =
    projects.find((p) => p._id === projectFilter)?.name ??
    'كل المشاريع (الرزنامة العامة)';

  return (
    <View style={commonStyles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Row (matching Image 1) */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>الرزنامة</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إضافة حدث جديد"
            onPress={openCreate}
            style={({ pressed }) => [
              styles.addEventButton,
              pressed && styles.addEventButtonPressed,
            ]}
          >
            <Ionicons name="add" size={19} color="#FFFFFF" />
            <Text style={styles.addEventButtonText}>إضافة حدث</Text>
          </Pressable>
        </View>

        {/* Month Navigation & Switcher Row (matching Image 1) */}
        <View style={styles.monthNavRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => moveRange(1)}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>التالي</Text>
          </Pressable>

          <Text style={styles.currentMonthText}>{rangeTitle}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => moveRange(-1)}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>السابق</Text>
          </Pressable>
        </View>

        {/* Segmented View Row: شهري / أسبوعي + Grid Icon (matching Image 1) */}
        <View style={styles.viewToggleRow}>
          <View style={styles.segmentedContainer}>
            <Pressable
              onPress={() => setMode('week')}
              style={[
                styles.segmentedOption,
                mode === 'week' && styles.segmentedOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentedOptionText,
                  mode === 'week' && styles.segmentedOptionTextActive,
                ]}
              >
                أسبوعي
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setMode('month')}
              style={[
                styles.segmentedOption,
                mode === 'month' && styles.segmentedOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentedOptionText,
                  mode === 'month' && styles.segmentedOptionTextActive,
                ]}
              >
                شهري
              </Text>
            </Pressable>
          </View>

          <View style={styles.gridToggleIconBox}>
            <Ionicons name="grid-outline" size={18} color={palette.primary} />
          </View>
        </View>

        {/* Project Filter Dropdown (matching Image 1) */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setProjectPickerVisible(true)}
          style={styles.projectDropdown}
        >
          <View style={styles.dropdownLeft}>
            <Ionicons name="chevron-down" size={16} color={palette.text} />
            <Text style={styles.dropdownLeftText}>{activeProjectName}</Text>
          </View>
          <Text style={styles.dropdownLabel}>رزنامة المشروع</Text>
        </Pressable>

        {/* Calendar Grid Box (matching Image 1) */}
        <View style={styles.calendarCard}>
          {/* Weekday Labels (ح, ن, ث, ر, خ, ج, س) */}
          <View style={styles.weekdaysRow}>
            {['س', 'ج', 'خ', 'ر', 'ث', 'ن', 'ح'].map((day) => (
              <View key={day} style={styles.weekdayCol}>
                <Text style={styles.weekdayLabel}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Month Days Grid */}
          {mode === 'month' ? (
            <View style={styles.daysGrid}>
              {monthDays.map((day, index) => {
                const key = day ? dateKey(day) : `blank-${index}`;
                const isSelected = selectedDate === key;
                const hasEvent =
                  !!day &&
                  events.some(
                    (event) => dateKey(new Date(event.date)) === key
                  );

                if (!day) {
                  return <View key={key} style={styles.dayCellEmpty} />;
                }

                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    onPress={() => setSelectedDate(key)}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        isSelected && styles.dayNumberSelected,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                    {hasEvent ? (
                      <View
                        style={[
                          styles.eventDot,
                          isSelected && styles.eventDotSelected,
                        ]}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            /* Weekly View Grid */
            <View style={styles.weekDaysGrid}>
              {weekDays.map((day) => {
                const key = dateKey(day);
                const isSelected = selectedDate === key;
                const hasEvent = events.some(
                  (event) => dateKey(new Date(event.date)) === key
                );

                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    onPress={() => setSelectedDate(key)}
                    style={[
                      styles.weekDayCell,
                      isSelected && styles.dayCellSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.weekDayName,
                        isSelected && styles.dayNumberSelected,
                      ]}
                    >
                      {day.toLocaleDateString('ar-MR', { weekday: 'short' })}
                    </Text>
                    <Text
                      style={[
                        styles.dayNumber,
                        isSelected && styles.dayNumberSelected,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                    {hasEvent ? (
                      <View
                        style={[
                          styles.eventDot,
                          isSelected && styles.eventDotSelected,
                        ]}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Selected Date Section Heading (matching Image 1) */}
        <Text style={styles.selectedDateHeading}>
          {formatSelectedDate(selectedDate)}
        </Text>

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

        {/* Selected Day's Events List / Empty State (matching Image 1) */}
        {selectedEvents.length === 0 ? (
          <View style={styles.emptyDashedCard}>
            <View style={styles.diamondIconBox}>
              <Ionicons name="diamond-outline" size={24} color={palette.primary} />
            </View>
            <Text style={styles.emptyTitle}>لا توجد أحداث في هذا اليوم</Text>
            <Text style={styles.emptySubtitle}>اختر يوماً آخر أو أضف حدثاً جديداً</Text>
          </View>
        ) : (
          selectedEvents.map((event) => (
            <View key={event._id} style={styles.eventCard}>
              <View style={styles.eventCardTop}>
                <View style={styles.eventIdentity}>
                  <View style={styles.eventIconBox}>
                    <Ionicons name="calendar" size={18} color={palette.primary} />
                  </View>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                </View>

                <View style={styles.eventTypePill}>
                  <Text style={styles.eventTypePillText}>
                    {eventTypeLabels[event.type]}
                  </Text>
                </View>
              </View>

              {event.note ? (
                <Text style={styles.eventNoteText}>{event.note}</Text>
              ) : null}

              {/* Event Actions */}
              <View style={styles.eventActionsRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setDetailEvent(event)}
                  style={styles.detailsBtn}
                >
                  <Text style={styles.detailsBtnText}>التفاصيل</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => openEdit(event)}
                  style={styles.iconBtn}
                >
                  <Ionicons name="pencil-outline" size={17} color="#475569" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setDeleteTarget(event)}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="trash-outline" size={17} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add / Edit Event Form Modal (Formulaire) */}
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
                {editing ? 'تعديل الحدث' : 'إضافة حدث جديد'}
              </Text>
            </View>

            {/* Form Fields Card */}
            <View style={styles.formCard}>
              <Text style={styles.formSectionHeading}>بيانات الحدث</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>عنوان الحدث *</Text>
                <TextInput
                  accessibilityLabel="عنوان الحدث"
                  placeholder="مثال: تسليم المشروع، اجتماع مراجعة..."
                  placeholderTextColor={palette.muted}
                  value={form.title}
                  onChangeText={(title) => setForm({ ...form, title })}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.inlineInputsRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>التاريخ *</Text>
                  <TextInput
                    accessibilityLabel="تاريخ الحدث"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={palette.muted}
                    value={form.date}
                    onChangeText={(date) => setForm({ ...form, date })}
                    style={styles.formInput}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>تاريخ الانتهاء (اختياري)</Text>
                  <TextInput
                    accessibilityLabel="تاريخ الانتهاء"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={palette.muted}
                    value={form.endDate}
                    onChangeText={(endDate) => setForm({ ...form, endDate })}
                    style={styles.formInput}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>نوع الحدث</Text>
                <View style={styles.chipsWrap}>
                  {eventTypes.map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setForm({ ...form, type })}
                      style={[
                        styles.selectChip,
                        form.type === type && styles.selectChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectChipText,
                          form.type === type && styles.selectChipTextActive,
                        ]}
                      >
                        {eventTypeLabels[type]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {projects.length > 0 ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>ربط بمشروع (اختياري)</Text>
                  <View style={styles.chipsWrap}>
                    <Pressable
                      onPress={() => setForm({ ...form, projectId: '' })}
                      style={[
                        styles.selectChip,
                        !form.projectId && styles.selectChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectChipText,
                          !form.projectId && styles.selectChipTextActive,
                        ]}
                      >
                        بدون مشروع
                      </Text>
                    </Pressable>
                    {projects.map((p) => (
                      <Pressable
                        key={p._id}
                        onPress={() => setForm({ ...form, projectId: p._id })}
                        style={[
                          styles.selectChip,
                          form.projectId === p._id && styles.selectChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.selectChipText,
                            form.projectId === p._id && styles.selectChipTextActive,
                          ]}
                        >
                          {p.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ملاحظات إضافية (اختياري)</Text>
                <TextInput
                  accessibilityLabel="ملاحظات الحدث"
                  placeholder="اكتب أي تفاصيل أو متطلبات للحدث..."
                  placeholderTextColor={palette.muted}
                  multiline
                  numberOfLines={3}
                  value={form.note}
                  onChangeText={(note) => setForm({ ...form, note })}
                  style={[styles.formInput, styles.textArea]}
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
                label={saving ? 'جارٍ الحفظ...' : editing ? 'تحديث الحدث' : 'حفظ الحدث'}
                disabled={saving}
                onPress={() => void saveEvent()}
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

      {/* Event Details Sheet (الصفحة الداخلية للحدث) */}
      <Modal
        visible={detailEvent !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailEvent(null)}
      >
        {detailEvent ? (
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setDetailEvent(null)} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={palette.text} />
                </Pressable>
                <Text style={styles.modalTitle}>تفاصيل الحدث</Text>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.detailEventTitle}>{detailEvent.title}</Text>
                <Text style={styles.detailEventDate}>
                  📅 {formatSelectedDate(dateKey(new Date(detailEvent.date)))}
                </Text>

                <View style={styles.tagsRow}>
                  <View style={styles.tagBlue}>
                    <Text style={styles.tagBlueText}>
                      نوع الحدث: {eventTypeLabels[detailEvent.type]}
                    </Text>
                  </View>
                  {detailEvent.projectId ? (
                    <View style={styles.tagAmber}>
                      <Text style={styles.tagAmberText}>
                        مشروع: {projects.find((p) => p._id === detailEvent.projectId)?.name ?? 'مرتبط'}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {detailEvent.note ? (
                  <View style={styles.detailNoteBox}>
                    <Text style={styles.detailNoteText}>{detailEvent.note}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.modalActions}>
                <PrimaryButton
                  label="تعديل الحدث"
                  onPress={() => {
                    const e = detailEvent;
                    setDetailEvent(null);
                    openEdit(e);
                  }}
                />
                <Pressable
                  onPress={() => {
                    const e = detailEvent;
                    setDetailEvent(null);
                    setDeleteTarget(e);
                  }}
                  style={styles.deleteActionBtn}
                >
                  <Text style={styles.deleteActionBtnText}>حذف الحدث</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </Modal>

      {/* Project Picker Modal */}
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
              <Text style={styles.modalTitle}>اختر رزنامة المشروع</Text>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              <Pressable
                onPress={() => {
                  setProjectFilter('');
                  setProjectPickerVisible(false);
                }}
                style={[
                  styles.pickerItem,
                  !projectFilter && styles.pickerItemActive,
                ]}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    !projectFilter && styles.pickerItemTextActive,
                  ]}
                >
                  كل المشاريع (الرزنامة العامة)
                </Text>
              </Pressable>

              {projects.map((p) => (
                <Pressable
                  key={p._id}
                  onPress={() => {
                    setProjectFilter(p._id);
                    setProjectPickerVisible(false);
                  }}
                  style={[
                    styles.pickerItem,
                    projectFilter === p._id && styles.pickerItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      projectFilter === p._id && styles.pickerItemTextActive,
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
            <Text style={styles.confirmTitle}>حذف الحدث؟</Text>
            <Text style={styles.confirmBody}>
              هل أنت متأكد من رغبتك في حذف «{deleteTarget?.title}» من الروزنامة؟
            </Text>
            <View style={styles.confirmButtons}>
              <Pressable
                onPress={() => void deleteEvent()}
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
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  addEventButton: {
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
  addEventButtonPressed: {
    opacity: 0.88,
  },
  addEventButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  monthNavRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  navButton: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
  },
  currentMonthText: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
  },
  viewToggleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  segmentedContainer: {
    flex: 1,
    flexDirection: 'row-reverse',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 3,
    gap: 4,
  },
  segmentedOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  segmentedOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
  },
  segmentedOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.muted,
  },
  segmentedOptionTextActive: {
    color: palette.primary,
    fontWeight: '800',
  },
  gridToggleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectDropdown: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  dropdownLabel: {
    fontSize: 13,
    color: palette.muted,
    fontWeight: '600',
  },
  dropdownLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  dropdownLeftText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  weekdaysRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  weekdayCol: {
    width: 40,
    alignItems: 'center',
  },
  weekdayLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
  },
  daysGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: 8,
  },
  dayCellEmpty: {
    width: 40,
    height: 40,
  },
  dayCell: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#F8FAFC',
    borderColor: '#F1F5F9',
    borderWidth: 1,
  },
  dayCellSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
  eventDot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#F59E0B',
  },
  eventDotSelected: {
    backgroundColor: '#FFFFFF',
  },
  weekDaysGrid: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
  },
  weekDayCell: {
    width: 42,
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#F1F5F9',
    borderWidth: 1,
    gap: 2,
  },
  weekDayName: {
    fontSize: 10,
    fontWeight: '600',
    color: palette.muted,
  },
  selectedDateHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
    marginBottom: 12,
  },
  emptyDashedCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#BFDBFE',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  diamondIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: palette.muted,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  eventCardTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventIdentity: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  eventIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    flex: 1,
    textAlign: 'right',
  },
  eventTypePill: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  eventTypePillText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  eventNoteText: {
    fontSize: 13,
    color: palette.muted,
    textAlign: 'right',
    lineHeight: 19,
  },
  eventActionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  detailsBtn: {
    flex: 1,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsBtnText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  textArea: {
    minHeight: 80,
    paddingVertical: 12,
  },
  inlineInputsRow: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  chipsWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectChip: {
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
  detailEventTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  detailEventDate: {
    fontSize: 14,
    color: palette.muted,
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
    paddingVertical: 4,
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
    paddingVertical: 4,
  },
  tagAmberText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '700',
  },
  detailNoteBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  detailNoteText: {
    fontSize: 14,
    color: palette.text,
    textAlign: 'right',
    lineHeight: 21,
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
