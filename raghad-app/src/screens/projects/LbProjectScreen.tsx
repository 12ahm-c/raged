import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import { commonStyles, LoadingState, palette, PrimaryButton, ScreenState } from '../../components/ui/States';
import { ConfirmDialog, FormDialog } from '../tabs/TasksScreen';
import type { ProjectDTO, TaskDTO } from '../../types/dto';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  ProjectHeader,
  SectionTitle,
  TinyAction,
  childrenOf,
  formatDateAr,
  readString,
  todayInputDate,
  useProjectNodes,
} from './projectUi';

export function LbProjectScreen({ project }: { project: ProjectDTO }) {
  const { nodes, loading, error, reload } = useProjectNodes(project._id);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);

  const [fileFormVisible, setFileFormVisible] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileFormError, setFileFormError] = useState('');
  const [savingFile, setSavingFile] = useState(false);

  const [openFileId, setOpenFileId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteFormError, setNoteFormError] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);

  const [taskFormVisible, setTaskFormVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState(todayInputDate());
  const [taskFormError, setTaskFormError] = useState('');
  const [savingTask, setSavingTask] = useState(false);

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

  async function refreshAll() {
    await Promise.all([reload(), loadTasks()]);
  }

  async function addFile() {
    if (!fileName.trim()) {
      setFileFormError('اسم الملف مطلوب.');
      return;
    }
    setSavingFile(true);
    setFileFormError('');
    try {
      await api.createProjectNode(project._id, {
        type: 'file',
        title: fileName.trim(),
        order: files.length,
      });
      setFileName('');
      setFileFormVisible(false);
      setSuccess('أُنشئ الملف.');
      await reload();
    } catch (requestError) {
      setFileFormError(getApiErrorMessage(requestError));
    } finally {
      setSavingFile(false);
    }
  }

  async function addNote() {
    if (!openFileId) return;
    if (!noteTitle.trim()) {
      setNoteFormError('عنوان الملاحظة مطلوب.');
      return;
    }
    setSavingNote(true);
    setNoteFormError('');
    try {
      await api.createProjectNode(project._id, {
        type: 'note',
        parentId: openFileId,
        title: noteTitle.trim(),
        order: notes.length,
        data: { content: noteContent.trim(), addedAt: todayInputDate() },
      });
      setNoteTitle('');
      setNoteContent('');
      setSuccess('أُضيفت الملاحظة.');
      await reload();
    } catch (requestError) {
      setNoteFormError(getApiErrorMessage(requestError));
    } finally {
      setSavingNote(false);
    }
  }

  async function confirmDeleteNote() {
    if (!deleteNoteId) return;
    try {
      await api.deleteProjectNode(deleteNoteId);
      setDeleteNoteId(null);
      setSuccess('حُذفت الملاحظة.');
      await reload();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
      setDeleteNoteId(null);
    }
  }

  async function addTask() {
    if (!taskTitle.trim()) {
      setTaskFormError('عنوان المهمة مطلوب.');
      return;
    }
    setSavingTask(true);
    setTaskFormError('');
    try {
      await api.createTask({
        title: taskTitle.trim(),
        type: 'project',
        projectId: project._id,
        date: `${taskDate}T00:00:00.000Z`,
        priority: 'medium',
      });
      setTaskTitle('');
      setTaskFormVisible(false);
      setSuccess('أُضيفت المهمة إلى لوحة المشروع وتظهر في الروزنامة.');
      await loadTasks();
    } catch (requestError) {
      setTaskFormError(getApiErrorMessage(requestError));
    } finally {
      setSavingTask(false);
    }
  }

  async function cycleTaskStatus(task: TaskDTO) {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await api.updateTaskStatus(task._id, { status: nextStatus });
      await loadTasks();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    }
  }

  async function deferTask(task: TaskDTO) {
    try {
      await api.updateTaskStatus(task._id, { status: 'deferred' });
      await loadTasks();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    }
  }

  function removeTask(task: TaskDTO) {
    void api.deleteTask(task._id).then(loadTasks).catch((err) => setActionError(getApiErrorMessage(err)));
  }

  const files = nodes.filter((node) => node.type === 'file' && !node.parentId);
  const openFile = openFileId ? files.find((file) => file._id === openFileId) ?? null : null;
  const notes = openFileId ? childrenOf(nodes, openFileId) : [];
  const columns: { key: TaskDTO['status']; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; items: TaskDTO[] }[] = [
    { key: 'todo', label: 'للمشاركة / الانتظار', icon: 'clipboard-outline', color: '#2563EB', items: tasks.filter((task) => task.status === 'todo') },
    { key: 'deferred', label: 'مؤجلة', icon: 'time-outline', color: '#D97706', items: tasks.filter((task) => task.status === 'deferred') },
    { key: 'done', label: 'منجزة', icon: 'checkmark-circle-outline', color: '#059669', items: tasks.filter((task) => task.status === 'done') },
  ];

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={commonStyles.content}>
        <ProjectHeader project={project} subtitle="ملفات بنمط Notes + لوحة مهام معتمدة على نموذج Trello" />

        {error ? (
          <ScreenState
            title="تعذر تحميل المشروع"
            message={error}
            actionLabel="إعادة المحاولة"
            onAction={() => void refreshAll()}
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

        {/* SECTION: FILES (iOS Notes style) */}
        <SectionTitle
          title="ملفات المشروع (Notes)"
          badge={files.length}
          action={
            <TinyAction
              label="+ ملف جديد"
              icon="add"
              onPress={() => {
                setFileFormError('');
                setFileFormVisible(true);
              }}
            />
          }
        />

        {files.length === 0 ? (
          <ScreenState title="لا توجد ملفات بعد" message="أنشئ ملفًا مثل «الأهداف» أو «الخطط» وأضف ملاحظاته." />
        ) : (
          <View style={styles.filesGrid}>
            {files.map((file) => {
              const fileNotes = childrenOf(nodes, file._id);
              return (
                <Pressable
                  key={file._id}
                  accessibilityRole="button"
                  accessibilityLabel={`فتح ملف ${file.title}`}
                  onPress={() => {
                    setOpenFileId(file._id);
                    setNoteFormError('');
                  }}
                  style={({ pressed }) => [styles.fileCard, pressed && styles.cardPressed]}
                >
                  <View style={styles.fileIconBox}>
                    <Ionicons name="folder" size={26} color="#3B82F6" />
                  </View>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName}>{file.title}</Text>
                    <Text style={styles.fileCount}>{fileNotes.length} ملاحظات</Text>
                  </View>
                  <Ionicons name="chevron-back" size={16} color={palette.muted} />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* SECTION: TRELLO TASKS BOARD */}
        <SectionTitle
          title="لوحة مهام المشروع (Trello)"
          badge={tasks.length}
          action={
            <TinyAction
              label="+ مهمة جديدة"
              icon="add"
              onPress={() => {
                setTaskFormError('');
                setTaskFormVisible(true);
              }}
            />
          }
        />

        {!tasksLoaded && !actionError ? <LoadingState label="جارٍ تحميل المهام..." /> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.board}>
          {columns.map((column) => (
            <View key={column.key} style={styles.column}>
              <View style={styles.columnHeader}>
                <Ionicons name={column.icon} size={16} color={column.color} />
                <Text style={styles.columnTitle}>{column.label}</Text>
                <View style={styles.columnCountBadge}>
                  <Text style={styles.columnCountText}>{column.items.length}</Text>
                </View>
              </View>

              <ScrollView style={styles.columnScroll}>
                {column.items.length === 0 ? (
                  <Text style={styles.emptyColumnText}>لا مهام هنا</Text>
                ) : (
                  column.items.map((task) => (
                    <View key={task._id} style={styles.taskCard}>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      <View style={styles.taskDateRow}>
                        <Ionicons name="calendar-outline" size={11} color={palette.muted} />
                        <Text style={styles.taskDateText}>{formatDateAr(task.date)}</Text>
                      </View>

                      <View style={styles.taskActionsRow}>
                        <TinyAction
                          label={task.status === 'done' ? 'إعادة فتح' : '✓ إنجاز'}
                          onPress={() => void cycleTaskStatus(task)}
                        />
                        {task.status !== 'deferred' ? (
                          <TinyAction label="تأجيل" onPress={() => void deferTask(task)} />
                        ) : null}
                        <TinyAction label="حذف" danger onPress={() => removeTask(task)} />
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      </ScrollView>

      {/* CREATE FILE MODAL */}
      <Modal visible={fileFormVisible} transparent animationType="slide" onRequestClose={() => setFileFormVisible(false)}>
        <FormDialog title="إنشاء ملف جديد" onClose={() => setFileFormVisible(false)}>
          <View style={styles.fieldGroup}>
            <Text style={commonStyles.label}>اسم الملف *</Text>
            <TextInput
              accessibilityLabel="اسم الملف"
              placeholder="مثال: الخطط المستقبلية، الأهداف..."
              placeholderTextColor={palette.muted}
              style={commonStyles.input}
              value={fileName}
              onChangeText={setFileName}
            />
          </View>
          {fileFormError ? <Text accessibilityRole="alert" style={commonStyles.error}>{fileFormError}</Text> : null}
          <PrimaryButton label={savingFile ? 'جارٍ الحفظ...' : 'إنشاء الملف'} disabled={savingFile} onPress={() => void addFile()} />
        </FormDialog>
      </Modal>

      {/* OPEN FILE NOTES MODAL */}
      <Modal visible={Boolean(openFile)} animationType="slide" onRequestClose={() => setOpenFileId(null)}>
        <View style={commonStyles.screen}>
          <ScrollView contentContainerStyle={commonStyles.content}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalCategoryBadge}>ملاحظات الملف</Text>
                <Text style={styles.modalMainTitle}>📁 {openFile?.title ?? ''}</Text>
              </View>
              <Pressable onPress={() => setOpenFileId(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={palette.text} />
              </Pressable>
            </View>

            {/* Notes List Card */}
            <View style={styles.detailCard}>
              <SectionTitle title="الملاحظات المسجلة" badge={notes.length} />
              {notes.length === 0 ? <Text style={commonStyles.body}>لا توجد ملاحظات في هذا الملف حتى الآن.</Text> : null}
              {notes.map((note) => {
                const content = readString(note.data, 'content');
                const addedAt = readString(note.data, 'addedAt');
                return (
                  <View key={note._id} style={styles.noteItem}>
                    <View style={styles.noteItemHeader}>
                      <Text style={styles.noteItemTitle}>{note.title}</Text>
                      <Pressable onPress={() => setDeleteNoteId(note._id)} style={styles.deleteIconBtn}>
                        <Ionicons name="trash-outline" size={15} color={palette.danger} />
                      </Pressable>
                    </View>
                    {content ? <Text style={styles.noteItemContent}>{content}</Text> : null}
                    {addedAt ? (
                      <View style={styles.noteFooter}>
                        <Ionicons name="calendar-outline" size={12} color={palette.muted} />
                        <Text style={styles.noteDateText}>{formatDateAr(addedAt)}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* Add Note Card */}
            <View style={styles.detailCard}>
              <Text style={styles.detailCardHeading}>إضافة ملاحظة جديدة لهذا الملف</Text>
              <View style={styles.fieldGroup}>
                <Text style={commonStyles.label}>عنوان الملاحظة *</Text>
                <TextInput
                  accessibilityLabel="عنوان الملاحظة"
                  placeholder="عنوان الملاحظة..."
                  placeholderTextColor={palette.muted}
                  style={commonStyles.input}
                  value={noteTitle}
                  onChangeText={setNoteTitle}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={commonStyles.label}>المحتوى أو التفاصيل</Text>
                <TextInput
                  accessibilityLabel="محتوى الملاحظة"
                  placeholder="المحتوى..."
                  placeholderTextColor={palette.muted}
                  style={[commonStyles.input, styles.noteInput]}
                  multiline
                  value={noteContent}
                  onChangeText={setNoteContent}
                />
              </View>
              {noteFormError ? <Text accessibilityRole="alert" style={commonStyles.error}>{noteFormError}</Text> : null}
              <PrimaryButton label={savingNote ? 'جارٍ الحفظ...' : 'حفظ الملاحظة في الملف'} disabled={savingNote} onPress={() => void addNote()} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* CREATE TASK MODAL */}
      <Modal visible={taskFormVisible} transparent animationType="slide" onRequestClose={() => setTaskFormVisible(false)}>
        <FormDialog title="مهمة جديدة لمشروع LB" onClose={() => setTaskFormVisible(false)}>
          <View style={styles.fieldGroup}>
            <Text style={commonStyles.label}>عنوان المهمة *</Text>
            <TextInput
              accessibilityLabel="عنوان المهمة"
              placeholder="عنوان المهمة..."
              placeholderTextColor={palette.muted}
              style={commonStyles.input}
              value={taskTitle}
              onChangeText={setTaskTitle}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={commonStyles.label}>التاريخ (YYYY-MM-DD)</Text>
            <TextInput
              accessibilityLabel="تاريخ المهمة"
              placeholder="YYYY-MM-DD"
              placeholderTextColor={palette.muted}
              style={commonStyles.input}
              value={taskDate}
              onChangeText={setTaskDate}
            />
          </View>
          {taskFormError ? <Text accessibilityRole="alert" style={commonStyles.error}>{taskFormError}</Text> : null}
          <PrimaryButton label={savingTask ? 'جارٍ الحفظ...' : 'إضافة إلى لوحة Trello'} disabled={savingTask} onPress={() => void addTask()} />
        </FormDialog>
      </Modal>

      <ConfirmDialog
        visible={Boolean(deleteNoteId)}
        title="حذف الملاحظة"
        message="هل تريد حذف هذه الملاحظة نهائيًا؟"
        busy={false}
        onConfirm={() => void confirmDeleteNote()}
        onCancel={() => setDeleteNoteId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filesGrid: {
    gap: 10,
  },
  fileCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    borderColor: palette.primary,
  },
  fileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
  },
  fileCount: {
    fontSize: 12,
    color: palette.muted,
  },
  board: {
    flexDirection: 'row-reverse',
    gap: 12,
    paddingVertical: 4,
  },
  column: {
    width: 250,
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    padding: 12,
    gap: 10,
    maxHeight: 460,
  },
  columnHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  columnTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  columnCountBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  columnCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.muted,
  },
  columnScroll: {
    gap: 8,
  },
  emptyColumnText: {
    fontSize: 12,
    color: palette.muted,
    textAlign: 'center',
    paddingVertical: 14,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'right',
  },
  taskDateRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  taskDateText: {
    fontSize: 11,
    color: palette.muted,
  },
  taskActionsRow: {
    flexDirection: 'row-reverse',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  detailCardHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
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
  noteItem: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  noteItemHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteItemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
    flex: 1,
    textAlign: 'right',
  },
  noteItemContent: {
    fontSize: 13,
    color: palette.muted,
    lineHeight: 20,
    textAlign: 'right',
  },
  noteFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  noteDateText: {
    fontSize: 11,
    color: palette.muted,
  },
  deleteIconBtn: {
    padding: 4,
  },
  noteInput: {
    minHeight: 90,
    textAlignVertical: 'top',
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
