import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import { commonStyles, LoadingState, palette, PrimaryButton, ScreenState } from '../../components/ui/States';
import { FormDialog } from '../tabs/TasksScreen';
import type { ProjectDTO, ProjectNodeDTO } from '../../types/dto';
import { getApiErrorMessage } from '../../utils/apiError';
import {
  ProgressBar,
  ProjectHeader,
  SectionTitle,
  TinyAction,
  childrenOf,
  formatDateAr,
  readNumber,
  readString,
  todayInputDate,
  useProjectNodes,
} from './projectUi';

type LevelGameMode = 'gaza' | 'ai';

const MODE_TEXT: Record<LevelGameMode, { subtitle: string; levelLabel: string; lockedHint: string }> = {
  gaza: {
    subtitle: 'لعبة تفاعلية بمستويات مؤرخة؛ إن أنهيت متأخرًا تُدمج مهام مستوى العقوبة مع مهامك.',
    levelLabel: 'رسائل غزة · ',
    lockedHint: 'أنهِ المستوى السابق أولًا لفتح هذا المستوى.',
  },
  ai: {
    subtitle: 'مستويات متدرجة؛ محتوى كل مستوى مخفي حتى تُنجز المستوى الذي قبله.',
    levelLabel: 'ذكاء اصطناعي · ',
    lockedHint: 'المحتوى مخفي حتى تُكمل المستوى السابق.',
  },
};

export function ProjectLevelGameScreen({
  project,
  mode,
}: {
  project: ProjectDTO;
  mode: LevelGameMode;
}) {
  const { nodes, loading, error, reload } = useProjectNodes(project._id);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const [levelFormVisible, setLevelFormVisible] = useState(false);
  const [levelTitle, setLevelTitle] = useState('');
  const [startDate, setStartDate] = useState(todayInputDate());
  const [durationDays, setDurationDays] = useState('7');
  const [content, setContent] = useState('');
  const [levelError, setLevelError] = useState('');
  const [savingLevel, setSavingLevel] = useState(false);

  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const levels = nodes
    .filter((node) => node.type === 'level' && !node.parentId)
    .sort((a, b) => a.order - b.order);

  const doneCount = levels.filter((level) => level.status === 'done').length;
  const percent = levels.length ? (doneCount / levels.length) * 100 : project.progress;

  function isLocked(index: number): boolean {
    return levels.slice(0, index).some((level) => level.status !== 'done');
  }

  async function addLevel() {
    if (!levelTitle.trim()) {
      setLevelError('عنوان المستوى مطلوب.');
      return;
    }
    const duration = Number(durationDays);
    if (!Number.isInteger(duration) || duration < 1) {
      setLevelError('المدة بالأيام يجب أن تكون عددًا صحيحًا أكبر من 0.');
      return;
    }
    setSavingLevel(true);
    setLevelError('');
    try {
      await api.createProjectNode(project._id, {
        type: 'level',
        title: levelTitle.trim(),
        order: levels.length,
        status: 'todo',
        data: {
          startDate,
          durationDays: duration,
          content: content.trim() || undefined,
        },
      });
      setLevelTitle('');
      setContent('');
      setLevelFormVisible(false);
      setSuccess('أُضيف المستوى بنجاح.');
      await reload();
    } catch (requestError) {
      setLevelError(getApiErrorMessage(requestError));
    } finally {
      setSavingLevel(false);
    }
  }

  async function toggleLevel(level: ProjectNodeDTO) {
    const nextStatus = level.status === 'done' ? 'todo' : 'done';
    try {
      await api.updateProjectNodeStatus(level._id, nextStatus);
      if (mode === 'gaza' && nextStatus === 'done') {
        const start = readString(level.data, 'startDate');
        const duration = readNumber(level.data, 'durationDays');
        if (start && duration) {
          const end = new Date(new Date(`${start}T00:00:00.000Z`).getTime() + duration * 86400000);
          if (Date.now() > end.getTime()) {
            setNotice('أنهيت هذا المستوى بعد الموعد المحدد؛ تم دمج مهام العقوبة تلقائيًا.');
          }
        }
      }
      setSuccess('تم تحديث حالة المستوى.');
      await reload();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    }
  }

  async function removeLevel(level: ProjectNodeDTO) {
    try {
      await api.deleteProjectNode(level._id);
      setSuccess('حُذف المستوى.');
      await reload();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    }
  }

  if (loading && nodes.length === 0) return <LoadingState label="جارٍ تحميل المستويات التفاعلية..." />;

  const today = todayInputDate();

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={commonStyles.content}>
        <ProjectHeader project={project} subtitle={MODE_TEXT[mode].subtitle} />

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

        {notice ? (
          <View style={styles.alertNotice} accessibilityRole="alert">
            <Ionicons name="warning-outline" size={16} color="#B45309" />
            <Text style={styles.alertNoticeText}>{notice}</Text>
          </View>
        ) : null}

        <SectionTitle
          title="مسار المستويات"
          badge={`${doneCount}/${levels.length}`}
          action={
            <TinyAction
              label="+ مستوى جديد"
              icon="add"
              onPress={() => {
                setLevelError('');
                setLevelFormVisible(true);
              }}
            />
          }
        />

        {levels.length === 0 ? (
          <ScreenState title="لا مستويات بعد" message="أضف أول مستوى لتبدأ اللعبة التفاعلية." />
        ) : (
          levels.map((level, index) => {
            const locked = isLocked(index);
            const start = readString(level.data, 'startDate');
            const duration = readNumber(level.data, 'durationDays');
            const levelContent = readString(level.data, 'content') ?? '';
            const leaves = childrenOf(nodes, level._id);
            const doneLeaves = leaves.filter((leaf) => leaf.status === 'done').length;
            const expanded = expandedId === level._id;
            const levelEnd =
              start && duration
                ? new Date(new Date(`${start}T00:00:00.000Z`).getTime() + duration * 86400000)
                    .toISOString()
                    .slice(0, 10)
                : null;
            const overdue =
              mode === 'gaza' && levelEnd && level.status !== 'done' && today > levelEnd;

            const isDone = level.status === 'done';

            return (
              <View
                key={level._id}
                style={[
                  styles.levelCard,
                  isDone && styles.levelCardDone,
                  locked && styles.levelCardLocked,
                ]}
              >
                <View style={styles.levelHeader}>
                  <View style={styles.levelIconBox}>
                    <Ionicons
                      name={locked ? 'lock-closed' : isDone ? 'checkmark-circle' : 'play-circle'}
                      size={22}
                      color={locked ? '#64748B' : isDone ? '#059669' : palette.primary}
                    />
                  </View>

                  <View style={styles.levelTitleGroup}>
                    <Text style={styles.levelNumberTag}>
                      {MODE_TEXT[mode].levelLabel}المستوى {index + 1}
                    </Text>
                    <Text style={styles.levelTitle}>{level.title}</Text>
                  </View>

                  <View style={[styles.statusBadge, isDone ? styles.statusBadgeDone : locked ? styles.statusBadgeLocked : styles.statusBadgeActive]}>
                    <Text style={[styles.statusBadgeText, isDone ? styles.statusBadgeTextDone : locked ? styles.statusBadgeTextLocked : styles.statusBadgeTextActive]}>
                      {locked ? 'مقفل' : isDone ? 'مكتمل ✓' : 'متاح'}
                    </Text>
                  </View>
                </View>

                {mode === 'gaza' && start && duration ? (
                  <View style={styles.dateMetaRow}>
                    <Ionicons name="calendar-outline" size={13} color={palette.muted} />
                    <Text style={styles.dateMetaText}>
                      من {formatDateAr(start)} إلى {formatDateAr(levelEnd)} ({duration} يوم)
                    </Text>
                  </View>
                ) : null}

                {overdue ? (
                  <View style={styles.overdueBadge}>
                    <Ionicons name="alert-circle" size={13} color="#DC2626" />
                    <Text style={styles.overdueText}>متأخر عن موعد الإنجاز المقرر</Text>
                  </View>
                ) : null}

                <Text style={styles.tasksSummary}>
                  {leaves.length ? `مهام المستوى: ${doneLeaves} من ${leaves.length} منجزة` : 'لا مهام مسجلة لهذا المستوى بعد.'}
                </Text>

                {locked ? (
                  <View style={styles.lockedHintBox}>
                    <Ionicons name="lock-closed-outline" size={14} color="#64748B" />
                    <Text style={styles.lockedHintText}>{MODE_TEXT[mode].lockedHint}</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.levelActionsRow}>
                      <TinyAction
                        label={isDone ? 'إعادة فتح' : '✓ إكمال المستوى'}
                        onPress={() => void toggleLevel(level)}
                      />
                      <TinyAction
                        label={expanded ? 'إخفاء المهام ▲' : `عرض المهام (${leaves.length}) ▼`}
                        onPress={() => setExpandedId(expanded ? null : level._id)}
                      />
                      <TinyAction label="حذف" icon="trash-outline" danger onPress={() => void removeLevel(level)} />
                    </View>

                    {expanded ? (
                      <View style={styles.expandedContent}>
                        {levelContent ? (
                          <View style={styles.contentBox}>
                            <Text style={styles.contentBoxTitle}>محتوى المستوى:</Text>
                            <Text style={styles.contentBoxText}>{levelContent}</Text>
                          </View>
                        ) : null}

                        {leaves.map((leaf) => {
                          const leafDone = leaf.status === 'done';
                          return (
                            <View key={leaf._id} style={styles.leafItem}>
                              <Pressable
                                onPress={() => {
                                  void api
                                    .updateProjectNodeStatus(leaf._id, leafDone ? 'todo' : 'done')
                                    .then(reload)
                                    .catch((err) => setActionError(getApiErrorMessage(err)));
                                }}
                                style={[styles.checkCircle, leafDone && styles.checkCircleDone]}
                              >
                                {leafDone ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                              </Pressable>
                              <Text style={[styles.leafTitle, leafDone && styles.leafTitleDone]}>
                                {leaf.title}
                              </Text>
                            </View>
                          );
                        })}

                        <LeafForm
                          projectId={project._id}
                          parentId={level._id}
                          nextOrder={leaves.length}
                          onSaved={() => void reload()}
                        />
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* CREATE LEVEL MODAL */}
      <Modal visible={levelFormVisible} transparent animationType="slide" onRequestClose={() => setLevelFormVisible(false)}>
        <FormDialog title="إضافة مستوى جديد" onClose={() => setLevelFormVisible(false)}>
          <View style={styles.fieldGroup}>
            <Text style={commonStyles.label}>عنوان المستوى *</Text>
            <TextInput
              accessibilityLabel="عنوان المستوى"
              placeholder="مثال: مقدمة في شبكات العصبية..."
              placeholderTextColor={palette.muted}
              style={commonStyles.input}
              value={levelTitle}
              onChangeText={setLevelTitle}
            />
          </View>
          {mode === 'gaza' ? (
            <>
              <View style={styles.fieldGroup}>
                <Text style={commonStyles.label}>تاريخ البداية (YYYY-MM-DD)</Text>
                <TextInput
                  accessibilityLabel="تاريخ البداية"
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={palette.muted}
                  style={commonStyles.input}
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={commonStyles.label}>المدة بالأيام</Text>
                <TextInput
                  accessibilityLabel="المدة بالأيام"
                  keyboardType="number-pad"
                  placeholder="7"
                  placeholderTextColor={palette.muted}
                  style={commonStyles.input}
                  value={durationDays}
                  onChangeText={setDurationDays}
                />
              </View>
            </>
          ) : null}
          <View style={styles.fieldGroup}>
            <Text style={commonStyles.label}>محتوى المستوى (نص، واجب، رابط...)</Text>
            <TextInput
              accessibilityLabel="محتوى المستوى"
              placeholder="شرح المستوى والمصادر..."
              placeholderTextColor={palette.muted}
              style={[commonStyles.input, styles.contentInput]}
              multiline
              value={content}
              onChangeText={setContent}
            />
          </View>
          {levelError ? <Text accessibilityRole="alert" style={commonStyles.error}>{levelError}</Text> : null}
          <PrimaryButton label={savingLevel ? 'جارٍ الحفظ...' : 'حفظ المستوى'} disabled={savingLevel} onPress={() => void addLevel()} />
        </FormDialog>
      </Modal>
    </View>
  );
}

function LeafForm({
  projectId,
  parentId,
  nextOrder,
  onSaved,
}: {
  projectId: string;
  parentId: string;
  nextOrder: number;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) {
      setError('عنوان المهمة مطلوب.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.createProjectNode(projectId, {
        type: 'leaf',
        parentId,
        title: title.trim(),
        order: nextOrder,
        status: 'todo',
      });
      setTitle('');
      onSaved();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.leafForm}>
      <TextInput
        accessibilityLabel="عنوان مهمة المستوى"
        placeholder="أضف مهمة لهذا المستوى…"
        placeholderTextColor={palette.muted}
        style={[commonStyles.input, { flex: 1 }]}
        value={title}
        onChangeText={setTitle}
      />
      <Pressable disabled={saving} onPress={() => void submit()} style={styles.addMiniBtn}>
        <Text style={styles.addMiniBtnText}>{saving ? '...' : 'إضافة'}</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={commonStyles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  levelCard: {
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
  levelCardDone: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  levelCardLocked: {
    backgroundColor: '#F8FAFC',
    opacity: 0.85,
  },
  levelHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  levelIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelTitleGroup: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  levelNumberTag: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.primary,
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeActive: {
    backgroundColor: '#EFF6FF',
  },
  statusBadgeDone: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeLocked: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadgeTextActive: {
    color: palette.primary,
  },
  statusBadgeTextDone: {
    color: '#059669',
  },
  statusBadgeTextLocked: {
    color: '#64748B',
  },
  dateMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  dateMetaText: {
    fontSize: 12,
    color: palette.muted,
  },
  overdueBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  overdueText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '700',
  },
  tasksSummary: {
    fontSize: 13,
    color: palette.muted,
    textAlign: 'right',
  },
  lockedHintBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
  },
  lockedHintText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  levelActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  expandedContent: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  contentBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  contentBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
    textAlign: 'right',
  },
  contentBoxText: {
    fontSize: 13,
    color: palette.text,
    lineHeight: 20,
    textAlign: 'right',
  },
  leafItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  leafTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
    textAlign: 'right',
  },
  leafTitleDone: {
    textDecorationLine: 'line-through',
    color: palette.muted,
  },
  leafForm: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  addMiniBtn: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addMiniBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  contentInput: {
    minHeight: 80,
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
  alertNotice: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  alertNoticeText: {
    flex: 1,
    color: '#92400E',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
});
