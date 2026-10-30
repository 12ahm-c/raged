import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import { commonStyles, LoadingState, palette, PrimaryButton, ScreenState } from '../../components/ui/States';
import { FormDialog } from '../tabs/TasksScreen';
import type { ProjectDTO, ProjectNodeDTO, TaskDTO } from '../../types/dto';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  ProjectHeader,
  SectionTitle,
  TinyAction,
  addDays,
  childrenOf,
  formatDateAr,
  readString,
  todayInputDate,
  useProjectNodes,
} from './projectUi';

export function CompetitionsProjectScreen({ project }: { project: ProjectDTO }) {
  const { nodes, loading, error, reload } = useProjectNodes(project._id);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [compFormVisible, setCompFormVisible] = useState(false);
  const [compTitle, setCompTitle] = useState('');
  const [compDate, setCompDate] = useState(todayInputDate());
  const [compDays, setCompDays] = useState('1');
  const [compError, setCompError] = useState('');
  const [savingComp, setSavingComp] = useState(false);

  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaError, setIdeaError] = useState('');
  const [savingIdea, setSavingIdea] = useState(false);

  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState(todayInputDate());
  const [taskError, setTaskError] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  const [rulesVisible, setRulesVisible] = useState(false);
  const [rulesTitle, setRulesTitle] = useState('القواعد العامة');
  const [rulesContent, setRulesContent] = useState('');
  const [rulesError, setRulesError] = useState('');
  const [savingRules, setSavingRules] = useState(false);

  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const loadTasks = useCallback(async () => {
    try {
      const result = await api.listTasks({ projectId: project._id, limit: 100 });
      setTasks(result.items);
      setTasksLoaded(true);
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    }
  }, [project._id]);

  useFocusEffect(
    useCallback(() => {
      void loadTasks();
    }, [loadTasks])
  );

  const competitions = nodes
    .filter((node) => node.type === 'card' && !node.parentId)
    .map((node) => ({ node, date: readString(node.data, 'date') ?? '' }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const today = todayInputDate();
  const upcoming = competitions.filter((item) => item.date >= today);
  const past = competitions.filter((item) => item.date < today);
  const rulesNote = nodes.find((node) => node.type === 'note' && readString(node.data, 'fixed') === 'rules');

  const selected = selectedId ? nodes.find((node) => node._id === selectedId) ?? null : null;

  async function addCompetition() {
    if (!compTitle.trim()) {
      setCompError('اسم المسابقة مطلوب.');
      return;
    }
    const days = Number(compDays);
    if (!Number.isInteger(days) || days < 1) {
      setCompError('المدة بالأيام يجب أن تكون عددًا صحيحًا أكبر من 0.');
      return;
    }
    setSavingComp(true);
    setCompError('');
    try {
      const node = await api.createProjectNode(project._id, {
        type: 'card',
        title: compTitle.trim(),
        order: competitions.length,
        data: {
          date: compDate,
          days,
          endDate: addDays(compDate, days - 1).toISOString().slice(0, 10),
        },
      });
      await api.createProjectNode(project._id, {
        type: 'note',
        parentId: node._id,
        title: 'فكرة أولية للمسابقة',
        order: 0,
        data: { addedAt: todayInputDate() },
      });
      setCompTitle('');
      setCompDays('1');
      setCompFormVisible(false);
      setSuccess('أُضيفت المسابقة إلى الروزنامة.');
      await reload();
    } catch (requestError) {
      setCompError(getApiErrorMessage(requestError));
    } finally {
      setSavingComp(false);
    }
  }

  async function addIdea() {
    if (!selected) return;
    if (!ideaTitle.trim()) {
      setIdeaError('اكتب عنوان الفكرة المرشحة.');
      return;
    }
    setSavingIdea(true);
    setIdeaError('');
    try {
      await api.createProjectNode(project._id, {
        type: 'note',
        parentId: selected._id,
        title: ideaTitle.trim(),
        order: childrenOf(nodes, selected._id).length,
        data: { addedAt: todayInputDate() },
      });
      setIdeaTitle('');
      setSuccess('أُضيفت الفكرة للمسابقة.');
      await reload();
    } catch (requestError) {
      setIdeaError(getApiErrorMessage(requestError));
    } finally {
      setSavingIdea(false);
    }
  }

  async function addCompetitionTask() {
    if (!selected) return;
    if (!taskTitle.trim()) {
      setTaskError('عنوان المهمة مطلوب.');
      return;
    }
    setSavingTask(true);
    setTaskError('');
    try {
      await api.createTask({
        title: taskTitle.trim(),
        type: 'project',
        projectId: project._id,
        nodeId: selected._id,
        date: `${taskDate}T00:00:00.000Z`,
        priority: 'medium',
      });
      setTaskTitle('');
      setSuccess('أُضيفت مهمة المسابقة وتظهر الآن في يومي.');
      await loadTasks();
    } catch (requestError) {
      setTaskError(getApiErrorMessage(requestError));
    } finally {
      setSavingTask(false);
    }
  }

  async function toggleCompetitionTask(task: TaskDTO) {
    try {
      await api.updateTaskStatus(task._id, { status: task.status === 'done' ? 'todo' : 'done' });
      await loadTasks();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    }
  }

  async function removeCompetitionTask(task: TaskDTO) {
    try {
      await api.deleteTask(task._id);
      await loadTasks();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    }
  }

  async function saveRules() {
    if (!rulesContent.trim()) {
      setRulesError('اكتب القوانين أو الاستراتيجيات.');
      return;
    }
    setSavingRules(true);
    setRulesError('');
    try {
      const payload = {
        type: 'note' as const,
        title: rulesTitle.trim() || 'القواعد العامة',
        status: 'todo' as const,
        data: { fixed: 'rules', content: rulesContent.trim(), addedAt: new Date().toISOString() },
      };
      if (rulesNote) await api.updateProjectNode(rulesNote._id, payload);
      else await api.createProjectNode(project._id, payload);
      setRulesVisible(false);
      setSuccess('حُفظت القواعد العامة للمسابقات.');
      await reload();
    } catch (requestError) {
      setRulesError(getApiErrorMessage(requestError));
    } finally {
      setSavingRules(false);
    }
  }

  if (loading && nodes.length === 0) return <LoadingState label="جارٍ تحميل صفحة المسابقات..." />;

  const selectedTasks = selected ? tasks.filter((task) => task.nodeId === selected._id) : [];
  const selectedIdeas = selected ? childrenOf(nodes, selected._id) : [];

  const renderCompetition = (item: { node: ProjectNodeDTO; date: string }) => {
    const compDaysNum = Number(item.node.data?.days ?? 1);
    return (
      <View key={item.node._id} style={styles.compCard}>
        <View style={styles.compHeaderRow}>
          <View style={styles.compIconBox}>
            <Ionicons name="trophy-outline" size={20} color="#D97706" />
          </View>
          <View style={styles.compInfoGroup}>
            <Text style={styles.compTitle}>{item.node.title}</Text>
            <View style={styles.compMetaRow}>
              <View style={styles.dateBadge}>
                <Ionicons name="calendar-outline" size={12} color="#D97706" />
                <Text style={styles.dateBadgeText}>{formatDateAr(item.date)}</Text>
              </View>
              {compDaysNum > 1 ? (
                <View style={styles.daysBadge}>
                  <Text style={styles.daysBadgeText}>{compDaysNum} أيام</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.compActionsRow}>
          <TinyAction
            label="فتح (أفكار ومهام)"
            icon="folder-open-outline"
            onPress={() => {
              setSelectedId(item.node._id);
              setIdeaError('');
              setTaskError('');
            }}
          />
          <TinyAction
            label="حذف"
            icon="trash-outline"
            danger
            onPress={() => {
              void api.deleteProjectNode(item.node._id).then(reload).catch((err) => setActionError(getApiErrorMessage(err)));
            }}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={commonStyles.content}>
        <ProjectHeader project={project} subtitle="روزنامة زمنية للمسابقات مع أفكارها ومهامها وقواعدها" />

        {error ? (
          <ScreenState
            title="تعذر تحميل المشروع"
            message={error}
            actionLabel="إعادة المحاولة"
            onAction={() => void reload()}
          />
        ) : null}

        {actionError ? (
          <View style={styles.alertError} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.alertErrorText}>{actionError}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={styles.alertSuccess} accessibilityRole="alert">
            <Ionicons name="checkmark-circle" size={16} color="#059669" />
            <Text style={styles.alertSuccessText}>{success}</Text>
          </View>
        ) : null}

        {/* Upcoming Competitions */}
        <SectionTitle
          title="المسابقات القادمة"
          badge={upcoming.length}
          action={
            <TinyAction
              label="+ مسابقة جديدة"
              icon="add"
              onPress={() => {
                setCompError('');
                setCompFormVisible(true);
              }}
            />
          }
        />
        {upcoming.length === 0 ? <Text style={commonStyles.body}>لا توجد مسابقات قادمة مسجلة في الروزنامة.</Text> : null}
        {upcoming.map(renderCompetition)}

        {/* Past Competitions */}
        <SectionTitle title="المسابقات السابقة" badge={past.length} />
        {past.length === 0 ? <Text style={commonStyles.body}>لا توجد مسابقات سابقة بعد.</Text> : null}
        {past.map(renderCompetition)}

        {/* General Rules */}
        <SectionTitle
          title="القواعد والاستراتيجيات العامة"
          action={
            <TinyAction
              label={rulesNote ? 'تعديل القواعد' : '+ إضافة قواعد'}
              icon="create-outline"
              onPress={() => {
                setRulesContent(rulesNote ? String(rulesNote.data?.content ?? '') : '');
                setRulesError('');
                setRulesVisible(true);
              }}
            />
          }
        />
        {rulesNote ? (
          <View style={styles.rulesCard}>
            <View style={styles.rulesHeader}>
              <Ionicons name="document-text-outline" size={20} color="#D97706" />
              <Text style={styles.rulesTitle}>{rulesNote.title}</Text>
            </View>
            <Text style={styles.rulesContent}>{String(rulesNote.data?.content ?? '')}</Text>
          </View>
        ) : (
          <Text style={commonStyles.body}>لم تُسجّل القواعد العامة بعد (القوانين والاستراتيجيات قبل وأثناء المسابقة).</Text>
        )}
      </ScrollView>

      {/* COMPETITION DETAIL MODAL */}
      <Modal visible={Boolean(selected)} animationType="slide" onRequestClose={() => setSelectedId(null)}>
        <View style={commonStyles.screen}>
          <ScrollView contentContainerStyle={commonStyles.content}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalCategoryBadge}>تفاصيل المسابقة</Text>
                <Text style={styles.modalMainTitle}>🏆 {selected?.title ?? ''}</Text>
              </View>
              <Pressable onPress={() => setSelectedId(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={palette.text} />
              </Pressable>
            </View>

            {/* Candidate Ideas Card */}
            <View style={styles.detailCard}>
              <SectionTitle title="الأفكار المرشحة (Notes)" badge={selectedIdeas.length} />
              {selectedIdeas.length === 0 ? <Text style={commonStyles.body}>لا أفكار مسجلة بعد لهذه المسابقة.</Text> : null}
              {selectedIdeas.map((idea) => (
                <View key={idea._id} style={styles.ideaItem}>
                  <Ionicons name="bulb-outline" size={16} color="#D97706" />
                  <Text style={styles.ideaText}>{idea.title}</Text>
                  <Pressable
                    onPress={() => {
                      void api.deleteProjectNode(idea._id).then(reload).catch((err) => setActionError(getApiErrorMessage(err)));
                    }}
                    style={styles.deleteIconBtn}
                  >
                    <Ionicons name="trash-outline" size={15} color={palette.danger} />
                  </Pressable>
                </View>
              ))}

              <View style={styles.addMiniRow}>
                <TextInput
                  accessibilityLabel="فكرة جديدة"
                  placeholder="أضف فكرة مرشحة للمسابقة…"
                  placeholderTextColor={palette.muted}
                  style={[commonStyles.input, { flex: 1 }]}
                  value={ideaTitle}
                  onChangeText={setIdeaTitle}
                />
                <Pressable
                  disabled={savingIdea}
                  onPress={() => void addIdea()}
                  style={styles.miniPrimaryBtn}
                >
                  <Text style={styles.miniPrimaryBtnText}>{savingIdea ? '...' : 'إضافة'}</Text>
                </Pressable>
              </View>
              {ideaError ? <Text accessibilityRole="alert" style={commonStyles.error}>{ideaError}</Text> : null}
            </View>

            {/* Tasks Card */}
            <View style={styles.detailCard}>
              <SectionTitle title="مهام المسابقة" badge={selectedTasks.length} />
              {!tasksLoaded ? <LoadingState label="جارٍ تحميل المهام..." /> : null}
              {tasksLoaded && selectedTasks.length === 0 ? (
                <Text style={commonStyles.body}>لا توجد مهام لهذه المسابقة بعد.</Text>
              ) : null}
              {selectedTasks.map((task) => {
                const isDone = task.status === 'done';
                return (
                  <View key={task._id} style={styles.taskItem}>
                    <Pressable
                      onPress={() => void toggleCompetitionTask(task)}
                      style={[styles.checkCircle, isDone && styles.checkCircleDone]}
                    >
                      {isDone ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>{task.title}</Text>
                      <Text style={styles.taskDateText}>
                        {formatDateAr(task.date)} · {task.status === 'done' ? 'منجزة ✓' : 'قيد الانتظار'}
                      </Text>
                    </View>
                    <Pressable onPress={() => void removeCompetitionTask(task)} style={styles.deleteIconBtn}>
                      <Ionicons name="trash-outline" size={15} color={palette.danger} />
                    </Pressable>
                  </View>
                );
              })}

              <View style={styles.addTaskBox}>
                <Text style={commonStyles.label}>إضافة مهمة مرتبطة بالمسابقة</Text>
                <TextInput
                  accessibilityLabel="عنوان مهمة المسابقة"
                  placeholder="عنوان المهمة..."
                  placeholderTextColor={palette.muted}
                  style={commonStyles.input}
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                />
                <TextInput
                  accessibilityLabel="تاريخ مهمة المسابقة"
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={palette.muted}
                  style={commonStyles.input}
                  value={taskDate}
                  onChangeText={setTaskDate}
                />
                {taskError ? <Text accessibilityRole="alert" style={commonStyles.error}>{taskError}</Text> : null}
                <PrimaryButton label={savingTask ? 'جارٍ الحفظ...' : 'إضافة المهمة للروزنامة'} disabled={savingTask} onPress={() => void addCompetitionTask()} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* CREATE COMPETITION MODAL */}
      <Modal visible={compFormVisible} transparent animationType="slide" onRequestClose={() => setCompFormVisible(false)}>
        <FormDialog title="إضافة مسابقة جديدة" onClose={() => setCompFormVisible(false)}>
          <View style={styles.fieldGroup}>
            <Text style={commonStyles.label}>اسم المسابقة *</Text>
            <TextInput
              accessibilityLabel="اسم المسابقة"
              placeholder="مثال: هاكاثون الابتكار..."
              placeholderTextColor={palette.muted}
              style={commonStyles.input}
              value={compTitle}
              onChangeText={setCompTitle}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={commonStyles.label}>تاريخ البداية (YYYY-MM-DD)</Text>
            <TextInput
              accessibilityLabel="تاريخ البداية"
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.muted}
              style={commonStyles.input}
              value={compDate}
              onChangeText={setCompDate}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={commonStyles.label}>المدة بالأيام</Text>
            <TextInput
              accessibilityLabel="المدة بالأيام"
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={palette.muted}
              style={commonStyles.input}
              value={compDays}
              onChangeText={setCompDays}
            />
          </View>
          {compError ? <Text accessibilityRole="alert" style={commonStyles.error}>{compError}</Text> : null}
          <PrimaryButton label={savingComp ? 'جارٍ الحفظ...' : 'حفظ المسابقة'} disabled={savingComp} onPress={() => void addCompetition()} />
        </FormDialog>
      </Modal>

      {/* RULES MODAL */}
      <Modal visible={rulesVisible} transparent animationType="slide" onRequestClose={() => setRulesVisible(false)}>
        <FormDialog title="القواعد والاستراتيجيات العامة" onClose={() => setRulesVisible(false)}>
          <View style={styles.fieldGroup}>
            <Text style={commonStyles.label}>العنوان</Text>
            <TextInput style={commonStyles.input} value={rulesTitle} onChangeText={setRulesTitle} />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={commonStyles.label}>القوانين والاستراتيجيات (قبل وأثناء المسابقة)</Text>
            <TextInput
              style={[commonStyles.input, styles.rulesInput]}
              multiline
              placeholder="اكتب القواعد، التحضيرات، توزيع الأدوار..."
              placeholderTextColor={palette.muted}
              value={rulesContent}
              onChangeText={setRulesContent}
            />
          </View>
          {rulesError ? <Text accessibilityRole="alert" style={commonStyles.error}>{rulesError}</Text> : null}
          <PrimaryButton label={savingRules ? 'جارٍ الحفظ...' : 'حفظ القواعد'} disabled={savingRules} onPress={() => void saveRules()} />
        </FormDialog>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  compCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  compHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  compIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compInfoGroup: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  compTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  compMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  dateBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  daysBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  daysBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: palette.muted,
  },
  compActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  rulesCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  rulesHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  rulesTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
  },
  rulesContent: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 22,
    textAlign: 'right',
  },
  rulesInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modalTitleGroup: {
    alignItems: 'flex-end',
  },
  modalCategoryBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
    marginBottom: 2,
  },
  modalMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ideaItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  ideaText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
    textAlign: 'right',
  },
  taskItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'right',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: palette.muted,
  },
  taskDateText: {
    fontSize: 11,
    color: palette.muted,
    textAlign: 'right',
  },
  deleteIconBtn: {
    padding: 4,
  },
  addMiniRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  miniPrimaryBtn: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  miniPrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  addTaskBox: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    marginTop: 6,
  },
  fieldGroup: {
    gap: 6,
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
});
