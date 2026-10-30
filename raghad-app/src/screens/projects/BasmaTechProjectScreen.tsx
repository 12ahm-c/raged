import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import { commonStyles, LoadingState, palette, PrimaryButton, ScreenState } from '../../components/ui/States';
import { FormDialog } from '../tabs/TasksScreen';
import type { ProjectDTO, ProjectNodeDTO } from '../../types/dto';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  ProjectHeader,
  SectionTitle,
  TinyAction,
  childrenOf,
  formatDateAr,
  readString,
  statusAr,
  todayInputDate,
  useProjectNodes,
} from './projectUi';

type SectionKey = 'goals' | 'ideas' | 'marketing' | 'persuasion';

const SECTIONS: { key: SectionKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'goals', label: 'الأهداف', icon: 'locate-outline' },
  { key: 'ideas', label: 'أفكار التطوير', icon: 'bulb-outline' },
  { key: 'marketing', label: 'التسويق', icon: 'megaphone-outline' },
  { key: 'persuasion', label: 'الإقناع', icon: 'git-branch-outline' },
];

export function BasmaTechProjectScreen({ project }: { project: ProjectDTO }) {
  const { nodes, loading, error, reload } = useProjectNodes(project._id);
  const [section, setSection] = useState<SectionKey>('goals');
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  const [goalFormVisible, setGoalFormVisible] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalError, setGoalError] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  const [taskForGoalId, setTaskForGoalId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskError, setTaskError] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  const [noteFormVisible, setNoteFormVisible] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteStage, setNoteStage] = useState('1');
  const [noteError, setNoteError] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const goals = nodes.filter((node) => node.type === 'goal' && !node.parentId);
  const notesFor = (category: string) =>
    nodes.filter((node) => node.type === 'note' && readString(node.data, 'category') === category);

  const categoryForSection: Record<Exclude<SectionKey, 'goals'>, string> = {
    ideas: 'idea',
    marketing: 'marketing',
    persuasion: 'persuasion',
  };

  const sectionHint: Record<SectionKey, string> = {
    goals: 'أهداف المؤسسة، ولكل هدف مهامه المطلوبة لتحقيقه.',
    ideas: 'كل فكرة مع تفصيلها وتاريخ كتابتها.',
    marketing: 'قواعد التسويق معروضة بشكل مرتب.',
    persuasion: 'مراحل الإقناع مرتّبة تباعًا.',
  };

  async function addGoal() {
    if (!goalTitle.trim()) {
      setGoalError('عنوان الهدف مطلوب.');
      return;
    }
    setSavingGoal(true);
    setGoalError('');
    try {
      await api.createProjectNode(project._id, {
        type: 'goal',
        title: goalTitle.trim(),
        order: goals.length,
        status: 'todo',
      });
      setGoalTitle('');
      setGoalFormVisible(false);
      setSuccess('أُضيف الهدف بنجاح.');
      await reload();
    } catch (requestError) {
      setGoalError(getApiErrorMessage(requestError));
    } finally {
      setSavingGoal(false);
    }
  }

  async function addTaskToGoal() {
    if (!taskForGoalId) return;
    if (!taskTitle.trim()) {
      setTaskError('عنوان المهمة مطلوب.');
      return;
    }
    setSavingTask(true);
    setTaskError('');
    try {
      const created = await api.createProjectNode(project._id, {
        type: 'leaf',
        parentId: taskForGoalId,
        title: taskTitle.trim(),
        order: childrenOf(nodes, taskForGoalId).length,
        status: 'todo',
        data: { addedAt: todayInputDate() },
      });
      await api.createTask({
        title: taskTitle.trim(),
        type: 'project',
        projectId: project._id,
        nodeId: created._id,
        date: `${todayInputDate()}T00:00:00.000Z`,
        priority: 'medium',
      });
      setTaskTitle('');
      setTaskForGoalId(null);
      setSuccess('أُضيفت المهمة إلى الهدف وتظهر الآن في قائمة المهام والروزنامة.');
      await reload();
    } catch (requestError) {
      setTaskError(getApiErrorMessage(requestError));
    } finally {
      setSavingTask(false);
    }
  }

  async function toggleGoalTask(task: ProjectNodeDTO) {
    try {
      await api.updateProjectNodeStatus(task._id, task.status === 'done' ? 'todo' : 'done');
      await reload();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    }
  }

  async function addNote() {
    if (!noteTitle.trim()) {
      setNoteError('العنوان مطلوب.');
      return;
    }
    if (!noteContent.trim()) {
      setNoteError('اكتب التفصيل أو القاعدة.');
      return;
    }
    setSavingNote(true);
    setNoteError('');
    try {
      const category = categoryForSection[section as Exclude<SectionKey, 'goals'>];
      await api.createProjectNode(project._id, {
        type: 'note',
        title: noteTitle.trim(),
        order: notesFor(category).length,
        data: {
          category,
          content: noteContent.trim(),
          addedAt: new Date().toISOString(),
          ...(category === 'persuasion' && /^\d+$/.test(noteStage) ? { stage: Number(noteStage) } : {}),
        },
      });
      setNoteTitle('');
      setNoteContent('');
      setNoteFormVisible(false);
      setSuccess('أُضيفت الملاحظة بنجاح.');
      await reload();
    } catch (requestError) {
      setNoteError(getApiErrorMessage(requestError));
    } finally {
      setSavingNote(false);
    }
  }

  async function removeNode(node: ProjectNodeDTO) {
    try {
      await api.deleteProjectNode(node._id);
      setSuccess('حُذف العنصر بنجاح.');
      await reload();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    }
  }

  if (loading && nodes.length === 0) return <LoadingState label="جارٍ تحميل مشروع بصمة تك..." />;

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={commonStyles.content}>
        <ProjectHeader project={project} subtitle={sectionHint[section]} />

        {/* Section Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {SECTIONS.map((item) => {
            const isSelected = section === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setSection(item.key)}
                style={[styles.tabPill, isSelected && styles.tabPillSelected]}
              >
                <Ionicons
                  name={item.icon}
                  size={15}
                  color={isSelected ? '#FFFFFF' : palette.muted}
                />
                <Text style={[styles.tabPillText, isSelected && styles.tabPillTextSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Alerts */}
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

        {/* SECTION: GOALS */}
        {section === 'goals' ? (
          <>
            <SectionTitle
              title="الأهداف المطلوب تحقيقها"
              badge={goals.length}
              action={
                <TinyAction
                  label="+ هدف جديد"
                  icon="add"
                  onPress={() => {
                    setGoalError('');
                    setGoalFormVisible(true);
                  }}
                />
              }
            />
            {goals.length === 0 ? (
              <ScreenState title="لا أهداف بعد" message="أضف هدفًا ثم أرفق به المهام التي تحققه." />
            ) : (
              goals.map((goal) => {
                const goalTasks = childrenOf(nodes, goal._id);
                const done = goalTasks.filter((task) => task.status === 'done').length;
                const percent = goalTasks.length > 0 ? Math.round((done / goalTasks.length) * 100) : 0;
                const expanded = expandedGoalId === goal._id;

                return (
                  <View key={goal._id} style={styles.goalCard}>
                    <View style={styles.goalHeaderRow}>
                      <View style={styles.goalIconBox}>
                        <Ionicons name="flag-outline" size={20} color={palette.primary} />
                      </View>
                      <View style={styles.goalTitleGroup}>
                        <Text style={styles.goalTitle}>{goal.title}</Text>
                        <Text style={styles.goalMetaText}>
                          {goalTasks.length ? `${done} من ${goalTasks.length} مهام منجزة (${percent}%)` : 'لا توجد مهام ملحقة بعد'}
                        </Text>
                      </View>
                      <View style={styles.goalBadge}>
                        <Text style={styles.goalBadgeText}>{statusAr(goal.status)}</Text>
                      </View>
                    </View>

                    {/* Goal Progress bar */}
                    {goalTasks.length > 0 ? (
                      <View style={styles.goalProgressTrack}>
                        <View style={[styles.goalProgressFill, { width: `${percent}%` }]} />
                      </View>
                    ) : null}

                    {/* Actions row */}
                    <View style={styles.goalActionsRow}>
                      <TinyAction
                        label={expanded ? 'إخفاء المهام ▲' : `عرض المهام (${goalTasks.length}) ▼`}
                        onPress={() => setExpandedGoalId(expanded ? null : goal._id)}
                      />
                      <TinyAction
                        label="+ مهمة للهدف"
                        icon="add"
                        onPress={() => {
                          setTaskForGoalId(goal._id);
                          setTaskError('');
                        }}
                      />
                      <TinyAction
                        label="حذف"
                        icon="trash-outline"
                        danger
                        onPress={() => void removeNode(goal)}
                      />
                    </View>

                    {/* Expanded Tasks List */}
                    {expanded ? (
                      <View style={styles.tasksContainer}>
                        {goalTasks.length === 0 ? (
                          <Text style={styles.emptyTasksText}>لا توجد مهام لهذا الهدف حتى الآن.</Text>
                        ) : (
                          goalTasks.map((task) => {
                            const isDone = task.status === 'done';
                            return (
                              <View key={task._id} style={styles.taskItem}>
                                <Pressable
                                  onPress={() => void toggleGoalTask(task)}
                                  style={[styles.checkCircle, isDone && styles.checkCircleDone]}
                                >
                                  {isDone ? (
                                    <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                                  ) : null}
                                </Pressable>
                                <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>
                                  {task.title}
                                </Text>
                                <Pressable
                                  onPress={() => void removeNode(task)}
                                  style={styles.taskDeleteBtn}
                                >
                                  <Ionicons name="trash-outline" size={15} color={palette.danger} />
                                </Pressable>
                              </View>
                            );
                          })
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </>
        ) : null}

        {/* SECTION: IDEAS, MARKETING, PERSUASION */}
        {section !== 'goals'
          ? (() => {
              const category = categoryForSection[section as Exclude<SectionKey, 'goals'>];
              const items = notesFor(category);
              const title =
                section === 'ideas' ? 'أفكار تطوير العمل' : section === 'marketing' ? 'قواعد التسويق' : 'مراحل الإقناع';
              const ordered = [...items].sort((a, b) => {
                const stageA = typeof a.data?.stage === 'number' ? a.data.stage : Number.MAX_SAFE_INTEGER;
                const stageB = typeof b.data?.stage === 'number' ? b.data.stage : Number.MAX_SAFE_INTEGER;
                return stageA - stageB;
              });

              return (
                <>
                  <SectionTitle
                    title={title}
                    badge={ordered.length}
                    action={
                      <TinyAction
                        label="+ إضافة"
                        icon="add"
                        onPress={() => {
                          setNoteError('');
                          setNoteFormVisible(true);
                        }}
                      />
                    }
                  />

                  {ordered.length === 0 ? (
                    <ScreenState title="لا محتوى بعد" message="أضف أول عنصر في هذا القسم لتوثيقه." />
                  ) : (
                    ordered.map((note) => {
                      const content = readString(note.data, 'content');
                      const addedAt = readString(note.data, 'addedAt');
                      const stage = typeof note.data?.stage === 'number' ? note.data.stage : undefined;

                      return (
                        <View key={note._id} style={styles.noteCard}>
                          <View style={styles.noteCardHeader}>
                            <View style={styles.noteTitleGroup}>
                              {section === 'persuasion' && stage !== undefined ? (
                                <View style={styles.stageBadge}>
                                  <Text style={styles.stageBadgeText}>المرحلة {stage}</Text>
                                </View>
                              ) : null}
                              <Text style={styles.noteTitle}>{note.title}</Text>
                            </View>

                            <Pressable onPress={() => void removeNode(note)} style={styles.taskDeleteBtn}>
                              <Ionicons name="trash-outline" size={16} color={palette.danger} />
                            </Pressable>
                          </View>

                          {content ? <Text style={styles.noteContent}>{content}</Text> : null}

                          {addedAt ? (
                            <View style={styles.noteFooter}>
                              <Ionicons name="calendar-outline" size={12} color={palette.muted} />
                              <Text style={styles.noteDate}>كُتبت في {formatDateAr(addedAt)}</Text>
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  )}
                </>
              );
            })()
          : null}
      </ScrollView>

      {/* MODALS */}
      <Modal visible={goalFormVisible} transparent animationType="slide" onRequestClose={() => setGoalFormVisible(false)}>
        <FormDialog title="هدف جديد لبصمة تك" onClose={() => setGoalFormVisible(false)}>
          <TextInput
            accessibilityLabel="عنوان الهدف"
            placeholder="عنوان الهدف..."
            placeholderTextColor={palette.muted}
            style={commonStyles.input}
            value={goalTitle}
            onChangeText={setGoalTitle}
          />
          {goalError ? <Text accessibilityRole="alert" style={commonStyles.error}>{goalError}</Text> : null}
          <PrimaryButton label={savingGoal ? 'جارٍ الحفظ...' : 'حفظ الهدف'} disabled={savingGoal} onPress={() => void addGoal()} />
        </FormDialog>
      </Modal>

      <Modal visible={Boolean(taskForGoalId)} transparent animationType="slide" onRequestClose={() => setTaskForGoalId(null)}>
        <FormDialog title="مهمة لتحقيق الهدف" onClose={() => setTaskForGoalId(null)}>
          <TextInput
            accessibilityLabel="عنوان المهمة"
            placeholder="عنوان المهمة المطلوبة..."
            placeholderTextColor={palette.muted}
            style={commonStyles.input}
            value={taskTitle}
            onChangeText={setTaskTitle}
          />
          {taskError ? <Text accessibilityRole="alert" style={commonStyles.error}>{taskError}</Text> : null}
          <PrimaryButton label={savingTask ? 'جارٍ الإضافة...' : 'إضافة المهمة'} disabled={savingTask} onPress={() => void addTaskToGoal()} />
        </FormDialog>
      </Modal>

      <Modal visible={noteFormVisible} transparent animationType="slide" onRequestClose={() => setNoteFormVisible(false)}>
        <FormDialog
          title={section === 'ideas' ? 'فكرة تطوير جديدة' : section === 'marketing' ? 'قاعدة تسويق جديدة' : 'مرحلة إقناع جديدة'}
          onClose={() => setNoteFormVisible(false)}
        >
          <TextInput
            accessibilityLabel="العنوان"
            placeholder="العنوان الرئيسي..."
            placeholderTextColor={palette.muted}
            style={commonStyles.input}
            value={noteTitle}
            onChangeText={setNoteTitle}
          />
          <TextInput
            accessibilityLabel="التفصيل"
            placeholder={section === 'marketing' ? 'القاعدة التسويقية وشرحها...' : 'التفاصيل والشرح...'}
            placeholderTextColor={palette.muted}
            style={[commonStyles.input, styles.noteInput]}
            multiline
            value={noteContent}
            onChangeText={setNoteContent}
          />
          {section === 'persuasion' ? (
            <>
              <Text style={commonStyles.label}>ترتيب رقم المرحلة</Text>
              <TextInput
                accessibilityLabel="رقم المرحلة"
                keyboardType="number-pad"
                style={commonStyles.input}
                value={noteStage}
                onChangeText={setNoteStage}
              />
            </>
          ) : null}
          {noteError ? <Text accessibilityRole="alert" style={commonStyles.error}>{noteError}</Text> : null}
          <PrimaryButton label={savingNote ? 'جارٍ الحفظ...' : 'حفظ'} disabled={savingNote} onPress={() => void addNote()} />
        </FormDialog>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingVertical: 4,
  },
  tabPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  tabPillSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
  },
  tabPillTextSelected: {
    color: '#FFFFFF',
  },
  goalCard: {
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
  goalHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  goalIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTitleGroup: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  goalMetaText: {
    fontSize: 12,
    color: palette.muted,
    textAlign: 'right',
  },
  goalBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  goalBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.text,
  },
  goalProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    backgroundColor: palette.primary,
    borderRadius: 3,
  },
  goalActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tasksContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  emptyTasksText: {
    fontSize: 12,
    color: palette.muted,
    textAlign: 'center',
    paddingVertical: 4,
  },
  taskItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
    textAlign: 'right',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: palette.muted,
  },
  taskDeleteBtn: {
    padding: 4,
  },
  noteCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  noteCardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteTitleGroup: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  stageBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  stageBadgeText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  noteTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  noteContent: {
    fontSize: 13,
    color: palette.muted,
    lineHeight: 20,
    textAlign: 'right',
  },
  noteFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  noteDate: {
    fontSize: 11,
    color: palette.muted,
  },
  noteInput: {
    minHeight: 90,
    textAlignVertical: 'top',
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
