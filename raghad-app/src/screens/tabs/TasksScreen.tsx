import { useCallback, useEffect, useState } from 'react';
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
  ProjectDTO,
  ProjectNodeDTO,
  TaskCreateRequestDTO,
  TaskDTO,
} from '../../types/dto';
import type { RootStackParamList } from '../../navigation/types';
import { getApiErrorMessage } from '../../utils/apiError';
import { goBackSafe } from '../../utils/goBackSafe';

const taskTypes: TaskDTO['type'][] = ['manual', 'project', 'study', 'work', 'islamic'];
const priorities: TaskDTO['priority'][] = ['low', 'medium', 'high'];
const statuses: TaskDTO['status'][] = ['todo', 'done', 'deferred'];

const typeLabels: Record<TaskDTO['type'], string> = {
  manual: 'يدوية',
  project: 'مشروع',
  study: 'دراسة',
  work: 'عمل',
  islamic: 'إسلامية',
};

const priorityLabels: Record<TaskDTO['priority'], string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
};

const statusLabels: Record<TaskDTO['status'], string> = {
  todo: 'قيد الانتظار',
  done: 'مكتملة',
  deferred: 'مؤجلة',
};

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00.000Z`;
};

export function TasksScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<TaskDTO[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'all' | TaskDTO['status']>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | TaskDTO['type']>('all');
  const [appliedDate, setAppliedDate] = useState(today().slice(0, 10));
  const [formVisible, setFormVisible] = useState(false);
  const [editing, setEditing] = useState<TaskDTO | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskDTO | null>(null);
  const [formError, setFormError] = useState('');
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [nodes, setNodes] = useState<ProjectNodeDTO[]>([]);
  const [picker, setPicker] = useState<'project' | 'node' | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    date: today().slice(0, 10),
    startTime: '',
    type: 'manual' as TaskDTO['type'],
    priority: 'medium' as TaskDTO['priority'],
    pointsReward: '0',
    projectId: '',
    nodeId: '',
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await api.listTasks({
        date: `${appliedDate.slice(0, 10)}T00:00:00.000Z`,
        status: filter === 'all' ? undefined : filter,
        type: typeFilter === 'all' ? undefined : typeFilter,
        page,
        limit: 20,
      });
      setItems(result.items);
      setTotal(result.meta.total);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appliedDate, filter, page, typeFilter]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    let cancelled = false;
    api
      .listProjects({ limit: 100 })
      .then((res) => {
        if (!cancelled) setProjects(res.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSelectProject(projectId: string) {
    setForm((current) => ({ ...current, projectId, nodeId: '' }));
    setPicker(null);
    if (!projectId) {
      setNodes([]);
      return;
    }
    try {
      const detail = await api.getProject(projectId);
      setNodes(detail.nodes);
    } catch {
      setNodes([]);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormError('');
    setForm({
      title: '',
      description: '',
      date: appliedDate,
      startTime: '',
      type: 'manual',
      priority: 'medium',
      pointsReward: '0',
      projectId: '',
      nodeId: '',
    });
    setFormVisible(true);
  }

  function openEdit(task: TaskDTO) {
    setEditing(task);
    setFormError('');
    setForm({
      title: task.title,
      description: task.description ?? '',
      date: task.date.slice(0, 10),
      startTime: task.startTime ?? '',
      type: task.type,
      priority: task.priority,
      pointsReward: String(task.pointsReward ?? 0),
      projectId: task.projectId ?? '',
      nodeId: task.nodeId ?? '',
    });
    if (task.projectId) {
      void api
        .getProject(task.projectId)
        .then((detail) => setNodes(detail.nodes))
        .catch(() => setNodes([]));
    } else {
      setNodes([]);
    }
    setFormVisible(true);
  }

  async function saveTask() {
    const title = form.title.trim();
    if (!title) {
      setFormError('عنوان المهمة مطلوب.');
      return;
    }
    const reward = Number(form.pointsReward);
    if (!Number.isFinite(reward) || reward < 0) {
      setFormError('أدخل نقاط مكافأة صحيحة غير سالبة.');
      return;
    }

    const payload: TaskCreateRequestDTO = {
      title,
      description: form.description.trim() || undefined,
      type: form.type,
      priority: form.priority,
      date: `${form.date.slice(0, 10)}T00:00:00.000Z`,
      startTime: form.startTime.trim() || undefined,
      pointsReward: reward,
      projectId: form.projectId.trim() || undefined,
      nodeId: form.nodeId.trim() || undefined,
    };

    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await api.updateTask(editing._id, payload);
        setSuccess('تم تحديث المهمة بنجاح.');
      } else {
        await api.createTask(payload);
        setSuccess('تمت إضافة المهمة بنجاح.');
      }
      setFormVisible(false);
      await load(true);
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(task: TaskDTO, newStatus: TaskDTO['status']) {
    setBusyId(task._id);
    setSuccess('');
    setError('');
    // التحديث المتفائل
    setItems((current) =>
      current.map((item) =>
        item._id === task._id ? { ...item, status: newStatus } : item
      )
    );
    try {
      await api.updateTaskStatus(task._id, { status: newStatus });
      setSuccess('تم تحديث حالة المهمة.');
      await load(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      await load(true);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await api.deleteTask(deleteTarget._id);
      setDeleteTarget(null);
      setSuccess('تم حذف المهمة بنجاح.');
      await load(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={commonStyles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            colors={[palette.primary]}
            tintColor={palette.primary}
          />
        }
      >
        {/* Navigation / Header */}
        <View style={styles.topNavRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => goBackSafe(navigation)}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-forward" size={18} color={palette.primary} />
            <Text style={styles.backBtnText}>العودة</Text>
          </Pressable>

          <View style={styles.titleInfo}>
            <Text style={styles.pageTitle}>المهام اليومية</Text>
            <Text style={styles.pageSubtitle}>{total} مهام مسجلة</Text>
          </View>
        </View>

        {/* Action & Filter Bar */}
        <View style={styles.actionsBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowFilters(!showFilters)}
            style={[
              styles.filterToggleBtn,
              showFilters && styles.filterToggleBtnActive,
            ]}
          >
            <Ionicons
              name={showFilters ? 'close-outline' : 'options-outline'}
              size={18}
              color={showFilters ? palette.primary : palette.muted}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={openCreate}
            style={({ pressed }) => [
              styles.addTaskBtn,
              pressed && styles.addTaskBtnPressed,
            ]}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addTaskBtnText}>إضافة مهمة</Text>
          </Pressable>
        </View>

        {/* Filter Pills: Status */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          <FilterPill
            label="الكل"
            active={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <FilterPill
            label="قيد الانتظار"
            active={filter === 'todo'}
            onPress={() => setFilter('todo')}
          />
          <FilterPill
            label="مكتملة ✓"
            active={filter === 'done'}
            onPress={() => setFilter('done')}
          />
          <FilterPill
            label="مؤجلة"
            active={filter === 'deferred'}
            onPress={() => setFilter('deferred')}
          />
        </ScrollView>

        {/* Advanced Filters Dropdown */}
        {showFilters ? (
          <View style={styles.advancedFiltersCard}>
            <Text style={styles.filterSectionHeading}>تصفية حسب نوع المهمة</Text>
            <View style={styles.chipsWrap}>
              <FilterPill
                label="كل الأنواع"
                active={typeFilter === 'all'}
                onPress={() => setTypeFilter('all')}
              />
              {taskTypes.map((t) => (
                <FilterPill
                  key={t}
                  label={typeLabels[t]}
                  active={typeFilter === t}
                  onPress={() => setTypeFilter(t)}
                />
              ))}
            </View>

            <Text style={[styles.filterSectionHeading, { marginTop: 10 }]}>تاريخ المهام</Text>
            <View style={styles.dateFilterRow}>
              <TextInput
                placeholder="YYYY-MM-DD"
                placeholderTextColor={palette.muted}
                value={appliedDate}
                onChangeText={setAppliedDate}
                style={styles.dateInput}
              />
              <Pressable
                onPress={() => void load(true)}
                style={styles.applyDateBtn}
              >
                <Text style={styles.applyDateBtnText}>تطبيق التاريخ</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

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

        {loading ? <LoadingState label="جارٍ تحميل المهام..." /> : null}

        {!loading && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkbox-outline" size={38} color={palette.muted} />
            <Text style={styles.emptyTitle}>لا توجد مهام لهذا اليوم</Text>
            <Text style={styles.emptySubtitle}>أضف مهمة جديدة لتنظيم يومك وزيادة إنتاجيتك.</Text>
            <Pressable style={styles.emptyAddBtn} onPress={openCreate}>
              <Text style={styles.emptyAddBtnText}>+ إضافة مهمة</Text>
            </Pressable>
          </View>
        ) : (
          items.map((task) => {
            const isDone = task.status === 'done';
            const isBusy = busyId === task._id;
            return (
              <View key={task._id} style={styles.taskCard}>
                {/* Top Row: Title + Checkbox */}
                <View style={styles.taskCardTop}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isBusy}
                    onPress={() =>
                      updateStatus(task, isDone ? 'todo' : 'done')
                    }
                    style={[
                      styles.checkCircle,
                      isDone && styles.checkCircleComplete,
                      isBusy && styles.checkCircleBusy,
                    ]}
                  >
                    {isDone ? (
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    ) : (
                      <Ionicons name="checkmark" size={16} color="#93C5FD" />
                    )}
                  </Pressable>

                  <View style={styles.taskTitleContainer}>
                    <Text
                      style={[
                        styles.taskTitleText,
                        isDone && styles.taskTitleTextDone,
                      ]}
                      numberOfLines={1}
                    >
                      {task.title}
                    </Text>

                    <View style={styles.tagsRow}>
                      <View style={styles.tagBlue}>
                        <Text style={styles.tagBlueText}>{typeLabels[task.type]}</Text>
                      </View>

                      <View
                        style={[
                          styles.tagPriority,
                          task.priority === 'high' && styles.tagPriorityHigh,
                          task.priority === 'medium' && styles.tagPriorityMedium,
                        ]}
                      >
                        <Text
                          style={[
                            styles.tagPriorityText,
                            task.priority === 'high' && styles.tagPriorityTextHigh,
                            task.priority === 'medium' && styles.tagPriorityTextMedium,
                          ]}
                        >
                          أولوية {priorityLabels[task.priority]}
                        </Text>
                      </View>

                      {task.startTime ? (
                        <View style={styles.tagTime}>
                          <Ionicons name="time-outline" size={12} color={palette.primary} />
                          <Text style={styles.tagTimeText}>{task.startTime}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>

                {task.description ? (
                  <Text style={styles.taskDescription} numberOfLines={2}>
                    {task.description}
                  </Text>
                ) : null}

                {/* Bottom Actions Row */}
                <View style={styles.taskActionsRow}>
                  <Pressable
                    disabled={isBusy}
                    onPress={() =>
                      updateStatus(task, isDone ? 'todo' : 'done')
                    }
                    style={styles.taskStatusActionBtn}
                  >
                    <Text style={styles.taskStatusActionBtnText}>
                      {isDone ? 'إعادة الفتح' : 'إنجاز المهمة'}
                    </Text>
                  </Pressable>

                  {task.status !== 'deferred' ? (
                    <Pressable
                      disabled={isBusy}
                      onPress={() => updateStatus(task, 'deferred')}
                      style={styles.taskDeferBtn}
                    >
                      <Text style={styles.taskDeferBtnText}>تأجيل</Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openEdit(task)}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="pencil-outline" size={16} color="#475569" />
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDeleteTarget(task)}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        {/* Pagination */}
        {!loading && total > 20 ? (
          <View style={styles.paginationRow}>
            <Pressable
              disabled={page <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
            >
              <Text style={styles.pageBtnText}>السابق</Text>
            </Pressable>
            <Text style={styles.pageInfoText}>
              صفحة {page} من {Math.ceil(total / 20)}
            </Text>
            <Pressable
              disabled={page * 20 >= total}
              onPress={() => setPage((p) => p + 1)}
              style={[styles.pageBtn, page * 20 >= total && styles.pageBtnDisabled]}
            >
              <Text style={styles.pageBtnText}>التالي</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* Add / Edit Task Modal (Formulaire) */}
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
                {editing ? 'تعديل المهمة' : 'مهمة جديدة'}
              </Text>
            </View>

            {/* Form Fields */}
            <View style={styles.formCard}>
              <Text style={styles.formSectionHeading}>بيانات المهمة</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>عنوان المهمة *</Text>
                <TextInput
                  accessibilityLabel="عنوان المهمة"
                  placeholder="مثال: مراجعة الكود، قراءة التقرير..."
                  placeholderTextColor={palette.muted}
                  value={form.title}
                  onChangeText={(title) => setForm({ ...form, title })}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الوصف (اختياري)</Text>
                <TextInput
                  accessibilityLabel="الوصف"
                  placeholder="أضف تفاصيل إضافية حول المهمة..."
                  placeholderTextColor={palette.muted}
                  multiline
                  numberOfLines={2}
                  value={form.description}
                  onChangeText={(description) => setForm({ ...form, description })}
                  style={[styles.formInput, styles.textArea]}
                />
              </View>

              <View style={styles.inlineInputsRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>التاريخ *</Text>
                  <TextInput
                    accessibilityLabel="التاريخ"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={palette.muted}
                    value={form.date}
                    onChangeText={(date) => setForm({ ...form, date })}
                    style={styles.formInput}
                  />
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>وقت البدء (اختياري)</Text>
                  <TextInput
                    accessibilityLabel="وقت البدء"
                    placeholder="09:00"
                    placeholderTextColor={palette.muted}
                    value={form.startTime}
                    onChangeText={(startTime) => setForm({ ...form, startTime })}
                    style={styles.formInput}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>نوع المهمة</Text>
                <View style={styles.chipsWrap}>
                  {taskTypes.map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setForm({ ...form, type: t })}
                      style={[
                        styles.selectChip,
                        form.type === t && styles.selectChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectChipText,
                          form.type === t && styles.selectChipTextActive,
                        ]}
                      >
                        {typeLabels[t]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الأولوية</Text>
                <View style={styles.segmentedRow}>
                  {priorities.map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setForm({ ...form, priority: p })}
                      style={[
                        styles.segmentedItem,
                        form.priority === p && styles.segmentedItemActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentedText,
                          form.priority === p && styles.segmentedTextActive,
                        ]}
                      >
                        {priorityLabels[p]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Project selector */}
              {projects.length > 0 ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>ربط بمشروع (اختياري)</Text>
                  <Pressable
                    onPress={() => setPicker('project')}
                    style={styles.dropdownInput}
                  >
                    <Text style={styles.dropdownInputText}>
                      {projects.find((p) => p._id === form.projectId)?.name ?? 'بدون مشروع (مهمة مستقلة)'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={palette.muted} />
                  </Pressable>
                </View>
              ) : null}
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
                label={saving ? 'جارٍ الحفظ...' : editing ? 'تحديث المهمة' : 'حفظ المهمة'}
                disabled={saving}
                onPress={() => void saveTask()}
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

      {/* Project Picker Modal */}
      <Modal
        visible={picker === 'project'}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.pickerCard}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setPicker(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={palette.text} />
              </Pressable>
              <Text style={styles.modalTitle}>اختر المشروع</Text>
            </View>
            <ScrollView style={{ maxHeight: 280 }}>
              <Pressable
                onPress={() => void onSelectProject('')}
                style={[styles.pickerItem, !form.projectId && styles.pickerItemActive]}
              >
                <Text style={styles.pickerItemText}>بدون مشروع (مستقلة)</Text>
              </Pressable>
              {projects.map((p) => (
                <Pressable
                  key={p._id}
                  onPress={() => void onSelectProject(p._id)}
                  style={[
                    styles.pickerItem,
                    form.projectId === p._id && styles.pickerItemActive,
                  ]}
                >
                  <Text style={styles.pickerItemText}>{p.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation */}
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
            <Text style={styles.confirmTitle}>حذف المهمة؟</Text>
            <Text style={styles.confirmBody}>هل أنت متأكد من حذف «{deleteTarget?.title}»؟</Text>
            <View style={styles.confirmButtons}>
              <Pressable onPress={() => void confirmDelete()} style={styles.confirmDeleteBtn}>
                <Text style={styles.confirmDeleteBtnText}>نعم، احذف</Text>
              </Pressable>
              <Pressable onPress={() => setDeleteTarget(null)} style={styles.confirmCancelBtn}>
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

// Keeping legacy dialog components exported for compatibility
export function FormDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <View style={styles.legacyOverlay}>
      <ScrollView contentContainerStyle={styles.legacyDialogScroll}>
        <View style={styles.legacyDialog}>
          <View style={commonStyles.inlineRow}>
            <Text style={styles.legacyDialogTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={palette.text} />
            </Pressable>
          </View>
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

export function ConfirmDialog({
  visible,
  title,
  message,
  busy,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmBody}>{message}</Text>
          <View style={styles.confirmButtons}>
            <Pressable disabled={busy} onPress={onConfirm} style={styles.confirmDeleteBtn}>
              <Text style={styles.confirmDeleteBtnText}>{busy ? 'جارٍ...' : 'حذف'}</Text>
            </Pressable>
            <Pressable onPress={onCancel} style={styles.confirmCancelBtn}>
              <Text style={styles.confirmCancelBtnText}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
    gap: 12,
  },
  topNavRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
    fontSize: 13,
    fontWeight: '700',
  },
  titleInfo: {
    alignItems: 'flex-end',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.text,
  },
  pageSubtitle: {
    fontSize: 13,
    color: palette.muted,
  },
  actionsBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  addTaskBtn: {
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
  addTaskBtnPressed: {
    opacity: 0.88,
  },
  addTaskBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  filterToggleBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: palette.primary,
  },
  filterPillsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingVertical: 4,
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
  advancedFiltersCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  filterSectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'right',
  },
  dateFilterRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    alignItems: 'center',
  },
  dateInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    color: palette.text,
    fontSize: 14,
    textAlign: 'right',
  },
  applyDateBtn: {
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyDateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    gap: 10,
  },
  taskCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  taskTitleContainer: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  taskTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'right',
  },
  taskTitleTextDone: {
    textDecorationLine: 'line-through',
    color: palette.muted,
  },
  tagsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBlue: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagBlueText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  tagPriority: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagPriorityMedium: {
    backgroundColor: '#FEF3C7',
  },
  tagPriorityHigh: {
    backgroundColor: '#FEE2E2',
  },
  tagPriorityText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.muted,
  },
  tagPriorityTextMedium: {
    color: '#D97706',
  },
  tagPriorityTextHigh: {
    color: '#DC2626',
  },
  tagTime: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
  },
  tagTimeText: {
    fontSize: 12,
    color: palette.primary,
    fontWeight: '600',
  },
  taskDescription: {
    fontSize: 13,
    color: palette.muted,
    textAlign: 'right',
    lineHeight: 19,
  },
  taskActionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  taskStatusActionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskStatusActionBtnText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  taskDeferBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskDeferBtnText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  pageInfoText: {
    color: palette.muted,
    fontSize: 13,
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
    minHeight: 74,
    paddingVertical: 10,
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
    fontSize: 14,
    color: palette.text,
  },
  modalActions: {
    gap: 10,
    marginTop: 6,
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
  legacyOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  legacyDialogScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  legacyDialog: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    padding: 20,
    gap: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  legacyDialogTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
  },
});
