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
  statusAr,
  useProjectNodes,
} from './projectUi';

export function SupnumProjectScreen({ project }: { project: ProjectDTO }) {
  const { nodes, loading, error, reload } = useProjectNodes(project._id);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const [subjectFormVisible, setSubjectFormVisible] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [savingSubject, setSavingSubject] = useState(false);

  const [leafTitle, setLeafTitle] = useState('');
  const [leafError, setLeafError] = useState('');
  const [savingLeaf, setSavingLeaf] = useState(false);

  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');

  const subjects = nodes.filter((node) => node.type === 'card' && !node.parentId);
  const selectedSubject = selectedSubjectId
    ? subjects.find((subject) => subject._id === selectedSubjectId) ?? null
    : null;
  const leaves = selectedSubjectId ? childrenOf(nodes, selectedSubjectId) : [];

  async function addSubject() {
    if (!subjectName.trim()) {
      setSubjectError('اسم المادة مطلوب.');
      return;
    }
    setSavingSubject(true);
    setSubjectError('');
    try {
      await api.createProjectNode(project._id, {
        type: 'card',
        title: subjectName.trim(),
        order: subjects.length,
      });
      setSubjectName('');
      setSubjectFormVisible(false);
      setSuccess('أُضيفت المادة بنجاح.');
      await reload();
    } catch (requestError) {
      setSubjectError(getApiErrorMessage(requestError));
    } finally {
      setSavingSubject(false);
    }
  }

  async function addLeaf() {
    if (!selectedSubjectId) return;
    if (!leafTitle.trim()) {
      setLeafError('عنوان المهمة مطلوب.');
      return;
    }
    setSavingLeaf(true);
    setLeafError('');
    try {
      await api.createProjectNode(project._id, {
        type: 'leaf',
        parentId: selectedSubjectId,
        title: leafTitle.trim(),
        order: leaves.length,
        status: 'todo',
      });
      setLeafTitle('');
      setSuccess('أُضيفت ورقة المهمة إلى الشجرة.');
      await reload();
    } catch (requestError) {
      setLeafError(getApiErrorMessage(requestError));
    } finally {
      setSavingLeaf(false);
    }
  }

  async function toggleLeaf(leaf: ProjectNodeDTO) {
    try {
      await api.updateProjectNodeStatus(leaf._id, leaf.status === 'done' ? 'todo' : 'done');
      await reload();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    }
  }

  async function removeLeaf(leaf: ProjectNodeDTO) {
    try {
      await api.deleteProjectNode(leaf._id);
      await reload();
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError));
    }
  }

  if (loading && nodes.length === 0) return <LoadingState label="جارٍ تحميل مشروع المعهد العالي للرقمنة..." />;

  // VIEW: TREE VIEW FOR SELECTED SUBJECT
  if (selectedSubject) {
    const doneLeaves = leaves.filter((leaf) => leaf.status === 'done').length;
    const percent = leaves.length > 0 ? Math.round((doneLeaves / leaves.length) * 100) : 0;

    return (
      <View style={commonStyles.screen}>
        <ScrollView contentContainerStyle={commonStyles.content}>
          {/* Header Row */}
          <View style={styles.treeHeaderRow}>
            <View style={styles.treeTitleGroup}>
              <Text style={styles.treeCategoryBadge}>شجرة مهام المادة</Text>
              <Text style={styles.treeMainTitle}>{selectedSubject.title}</Text>
            </View>
            <Pressable
              onPress={() => setSelectedSubjectId(null)}
              style={styles.backBtn}
            >
              <Ionicons name="arrow-forward" size={16} color={palette.primary} />
              <Text style={styles.backBtnText}>كل المواد</Text>
            </Pressable>
          </View>

          {/* Subject Progress Banner */}
          <View style={styles.subjectBannerCard}>
            <View style={styles.subjectBannerTop}>
              <Text style={styles.subjectBannerStats}>
                {doneLeaves} من {leaves.length} مهام منجزة ({percent}%)
              </Text>
              <View style={styles.bannerBadge}>
                <Ionicons name="leaf-outline" size={13} color="#059669" />
                <Text style={styles.bannerBadgeText}>{leaves.length} أوراق</Text>
              </View>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
            </View>
          </View>

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

          {/* Interactive Tree View */}
          <View style={styles.tree}>
            <View style={styles.treeLine} />
            {leaves.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="leaf-outline" size={32} color={palette.muted} />
                <Text style={commonStyles.body}>لم تُضف مهام في شجرة هذه المادة بعد.</Text>
              </View>
            ) : (
              leaves.map((leaf, index) => {
                const isRight = index % 2 === 0;
                const isDone = leaf.status === 'done';

                return (
                  <View
                    key={leaf._id}
                    style={[styles.treeRow, isRight ? styles.rowRight : styles.rowLeft]}
                  >
                    {isRight ? (
                      <View style={[styles.dot, isDone && styles.dotDone]} />
                    ) : null}

                    <View style={[styles.leafCard, isDone && styles.leafCardDone]}>
                      <View style={styles.leafHeader}>
                        <Pressable
                          onPress={() => void toggleLeaf(leaf)}
                          style={[styles.checkCircle, isDone && styles.checkCircleDone]}
                        >
                          {isDone ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                        </Pressable>
                        <Text style={[styles.leafTitle, isDone && styles.leafTitleDone]}>
                          {leaf.title}
                        </Text>
                        <Pressable onPress={() => void removeLeaf(leaf)} style={styles.leafDeleteBtn}>
                          <Ionicons name="trash-outline" size={14} color={palette.danger} />
                        </Pressable>
                      </View>
                      <View style={styles.leafFooter}>
                        <Text style={styles.leafStatusText}>{statusAr(leaf.status)}</Text>
                      </View>
                    </View>

                    {isRight ? null : (
                      <View style={[styles.dot, isDone && styles.dotDone]} />
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* Add Leaf Task Card */}
          <View style={styles.addCard}>
            <Text style={styles.addCardTitle}>إضافة ورقة مهمة جديدة للشجرة</Text>
            <View style={styles.addMiniRow}>
              <TextInput
                accessibilityLabel="عنوان المهمة"
                placeholder="مثال: إنجاز مشروع قاعدة البيانات..."
                placeholderTextColor={palette.muted}
                style={[commonStyles.input, { flex: 1 }]}
                value={leafTitle}
                onChangeText={setLeafTitle}
              />
              <Pressable
                disabled={savingLeaf}
                onPress={() => void addLeaf()}
                style={styles.addMiniBtn}
              >
                <Text style={styles.addMiniBtnText}>{savingLeaf ? '...' : 'إضافة'}</Text>
              </Pressable>
            </View>
            {leafError ? <Text accessibilityRole="alert" style={commonStyles.error}>{leafError}</Text> : null}
          </View>
        </ScrollView>
      </View>
    );
  }

  // VIEW: SUBJECTS GRID
  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={commonStyles.content}>
        <ProjectHeader project={project} subtitle="بطاقات المواد وشجرة المهام اليسرى/اليمنى" />

        {error ? (
          <ScreenState
            title="تعذر تحميل المشروع"
            message={error}
            actionLabel="إعادة المحاولة"
            onAction={() => void reload()}
          />
        ) : null}

        {success ? (
          <View style={styles.alertSuccess} accessibilityRole="alert">
            <Ionicons name="checkmark-circle" size={16} color="#059669" />
            <Text style={styles.alertSuccessText}>{success}</Text>
          </View>
        ) : null}

        <SectionTitle
          title="بطاقات المواد المقررة"
          badge={subjects.length}
          action={
            <TinyAction
              label="+ مادة جديدة"
              icon="add"
              onPress={() => {
                setSubjectError('');
                setSubjectFormVisible(true);
              }}
            />
          }
        />

        {subjects.length === 0 ? (
          <ScreenState title="لا توجد مواد بعد" message="أضف مادة لتظهر ببطاقة داخل شجرة مهامها." />
        ) : (
          <View style={styles.subjectsGrid}>
            {subjects.map((subject) => {
              const subjectLeaves = childrenOf(nodes, subject._id);
              const done = subjectLeaves.filter((leaf) => leaf.status === 'done').length;
              const percent = subjectLeaves.length > 0 ? Math.round((done / subjectLeaves.length) * 100) : 0;

              return (
                <Pressable
                  key={subject._id}
                  onPress={() => {
                    setSelectedSubjectId(subject._id);
                    setLeafError('');
                  }}
                  style={({ pressed }) => [styles.subjectCard, pressed && styles.cardPressed]}
                >
                  <View style={styles.subjectTopRow}>
                    <View style={styles.subjectIconBox}>
                      <Ionicons name="book-outline" size={22} color={palette.primary} />
                    </View>
                    <View style={styles.subjectInfo}>
                      <Text style={styles.subjectTitle}>{subject.title}</Text>
                      <Text style={styles.subjectMetaText}>
                        {done} من {subjectLeaves.length} مهام منجزة
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                  </View>

                  <View style={styles.subjectFooterRow}>
                    <Text style={styles.openTreeText}>فتح شجرة المهام ←</Text>
                    <Text style={styles.percentText}>{percent}%</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* CREATE SUBJECT MODAL */}
      <Modal visible={subjectFormVisible} transparent animationType="slide" onRequestClose={() => setSubjectFormVisible(false)}>
        <FormDialog title="إضافة مادة جديدة" onClose={() => setSubjectFormVisible(false)}>
          <View style={styles.fieldGroup}>
            <Text style={commonStyles.label}>اسم المادة *</Text>
            <TextInput
              accessibilityLabel="اسم المادة"
              placeholder="مثال: الخوارزميات وهياكل البيانات..."
              placeholderTextColor={palette.muted}
              style={commonStyles.input}
              value={subjectName}
              onChangeText={setSubjectName}
            />
          </View>
          {subjectError ? <Text accessibilityRole="alert" style={commonStyles.error}>{subjectError}</Text> : null}
          <PrimaryButton label={savingSubject ? 'جارٍ الحفظ...' : 'إنشاء بطاقة المادة'} disabled={savingSubject} onPress={() => void addSubject()} />
        </FormDialog>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  subjectsGrid: {
    gap: 12,
  },
  subjectCard: {
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
  cardPressed: {
    transform: [{ scale: 0.99 }],
    borderColor: palette.primary,
  },
  subjectTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  subjectIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectInfo: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  subjectTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  subjectMetaText: {
    fontSize: 12,
    color: palette.muted,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: palette.primary,
    borderRadius: 3,
  },
  subjectFooterRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  openTreeText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.primary,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
  },
  treeHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  treeTitleGroup: {
    alignItems: 'flex-end',
  },
  treeCategoryBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
    marginBottom: 2,
  },
  treeMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
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
    fontSize: 13,
  },
  subjectBannerCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  subjectBannerTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectBannerStats: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.text,
  },
  bannerBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bannerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  tree: {
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
    position: 'relative',
  },
  treeLine: {
    position: 'absolute',
    alignSelf: 'center',
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
  },
  treeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.primary,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 2,
  },
  dotDone: {
    backgroundColor: '#10B981',
  },
  leafCard: {
    width: '46%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRightWidth: 4,
    borderRightColor: palette.primary,
    padding: 12,
    gap: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  leafCardDone: {
    borderRightColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  leafHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
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
    color: palette.text,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'right',
  },
  leafTitleDone: {
    textDecorationLine: 'line-through',
    color: palette.muted,
  },
  leafDeleteBtn: {
    padding: 2,
  },
  leafFooter: {
    paddingTop: 4,
  },
  leafStatusText: {
    fontSize: 11,
    color: palette.muted,
    textAlign: 'right',
  },
  addCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  addCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  addMiniRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
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
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
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
