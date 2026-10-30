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
  ProjectCreateRequestDTO,
  ProjectDTO,
  ProjectNodeDTO,
} from '../../types/dto';
import type { RootStackParamList } from '../../navigation/types';
import { getApiErrorMessage } from '../../utils/apiError';
import { goBackSafe } from '../../utils/goBackSafe';
import { HasaniyaScreen } from '../hasaniya/HasaniyaScreen';
import { BasmaTechProjectScreen } from './BasmaTechProjectScreen';
import { CompetitionsProjectScreen } from './CompetitionsProjectScreen';
import { LbProjectScreen } from './LbProjectScreen';
import { ProjectLevelGameScreen } from './ProjectLevelGameScreen';
import { SupnumProjectScreen } from './SupnumProjectScreen';

const projectKeys: ProjectDTO['key'][] = [
  'lb',
  'supnum',
  'basma_tech',
  'competitions',
  'messages_gaza',
  'hasaniya',
  'ai_depth',
];

const structures: ProjectDTO['structureType'][] = [
  'notes_board',
  'tree_cards',
  'goals_pages',
  'calendar_notes',
  'level_game',
  'card_sets',
];

const projectLabels: Record<ProjectDTO['key'], string> = {
  lb: 'LB',
  supnum: 'SupNum',
  basma_tech: 'Basma Tech',
  competitions: 'المسابقات',
  messages_gaza: 'رسائل غزة',
  hasaniya: 'الحسانية',
  ai_depth: 'عمق الذكاء الاصطناعي',
};

const structureLabels: Record<ProjectDTO['structureType'], string> = {
  notes_board: 'لوحة ملاحظات',
  tree_cards: 'شجرة بطاقات',
  goals_pages: 'أهداف وصفحات',
  calendar_notes: 'تقويم وملاحظات',
  level_game: 'مستويات وتحديات',
  card_sets: 'مجموعات بطاقات',
};

const structureHints: Record<ProjectDTO['structureType'], string> = {
  notes_board: 'لوحة تفاعلية من عناصر مرتبة وملاحظات مرنة.',
  tree_cards: 'هيكل شجري متسلسل بحسب العنصر الأب.',
  goals_pages: 'صفحات وأهداف متعددة منظمة بدقة.',
  calendar_notes: 'ملاحظات مرتبطة بالتواريخ والروزنامة.',
  level_game: 'تدرج مستويات ونقاط خبرة تفتح بالتسلسل.',
  card_sets: 'شبكة بطاقات قابلة للتوسع والمطالعة.',
};

function getProjectIcon(key: ProjectDTO['key']): keyof typeof Ionicons.glyphMap {
  switch (key) {
    case 'lb':
      return 'laptop-outline';
    case 'supnum':
      return 'cube-outline';
    case 'basma_tech':
      return 'code-slash-outline';
    case 'competitions':
      return 'trophy-outline';
    case 'messages_gaza':
      return 'mail-outline';
    case 'hasaniya':
      return 'book-outline';
    case 'ai_depth':
      return 'hardware-chip-outline';
    default:
      return 'briefcase-outline';
  }
}

function orderNodesByTree(nodes: ProjectNodeDTO[]): { node: ProjectNodeDTO; depth: number }[] {
  const children = new Map<string, ProjectNodeDTO[]>();
  for (const node of nodes) {
    const parentKey = node.parentId ?? '';
    const siblings = children.get(parentKey) ?? [];
    siblings.push(node);
    children.set(parentKey, siblings);
  }
  for (const siblings of children.values()) {
    siblings.sort((a, b) => a.order - b.order);
  }

  const ordered: { node: ProjectNodeDTO; depth: number }[] = [];
  const visited = new Set<string>();
  function append(parentId: string | null, depth: number) {
    for (const node of children.get(parentId ?? '') ?? []) {
      if (visited.has(node._id)) continue;
      visited.add(node._id);
      ordered.push({ node, depth });
      append(node._id, depth + 1);
    }
  }

  append(null, 0);
  for (const node of nodes) {
    if (!visited.has(node._id)) {
      visited.add(node._id);
      ordered.push({ node, depth: 0 });
      append(node._id, 1);
    }
  }
  return ordered;
}

export function ProjectsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<ProjectCreateRequestDTO>({
    key: 'lb',
    name: '',
    structureType: 'notes_board',
    description: '',
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await api.listProjects({ page: 1, limit: 100 });
      setProjects(result.items);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const activeProjects = useMemo(
    () => projects.filter((p) => p.active),
    [projects]
  );

  const completedProjects = useMemo(
    () => projects.filter((p) => p.progress >= 100),
    [projects]
  );

  const averageProgress = useMemo(() => {
    if (projects.length === 0) return 0;
    const sum = projects.reduce((acc, p) => acc + (p.progress || 0), 0);
    return Math.round(sum / projects.length);
  }, [projects]);

  async function createProject() {
    if (form.name.trim().length < 1) {
      setFormError('اسم المشروع مطلوب.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await api.createProject({
        ...form,
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
      });
      setSuccess('تم إنشاء المشروع بنجاح!');
      setFormVisible(false);
      setForm({ key: 'lb', name: '', structureType: 'notes_board', description: '' });
      await load(true);
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (loading && projects.length === 0) {
    return <LoadingState label="جارٍ تحميل المشاريع..." />;
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
        {/* Top Header Row (matching Image 1) */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.pageTitle}>مشاريعي</Text>
            <Text style={styles.pageSubtitle}>{projects.length} مشاريع مسجلة</Text>
          </View>

          <View style={styles.headerButtonsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="تحديث المشاريع"
              onPress={() => void load(true)}
              style={({ pressed }) => [
                styles.refreshPill,
                pressed && styles.refreshPillPressed,
              ]}
            >
              <Ionicons name="refresh-outline" size={17} color={palette.primary} />
              <Text style={styles.refreshPillText}>تحديث</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إضافة مشروع جديد"
              onPress={() => {
                setFormError('');
                setFormVisible(true);
              }}
              style={({ pressed }) => [
                styles.addBtn,
                pressed && styles.addBtnPressed,
              ]}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addBtnText}>مشروع جديد</Text>
            </Pressable>
          </View>
        </View>

        {/* Hero Progress Card (matching Image 1) */}
        <LinearGradient
          colors={['#1E40AF', '#2563EB', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <View style={styles.circleOuter}>
              <View style={styles.circleTrack}>
                <View style={styles.indicatorDot} />
                <Text style={styles.circleText}>{averageProgress}%</Text>
              </View>
            </View>

            <View style={styles.heroTexts}>
              <Text style={styles.heroTitle}>تقدّم المشاريع</Text>
              <Text style={styles.heroSubtitle}>
                {completedProjects.length} من {projects.length} مشاريع مكتملة
              </Text>
            </View>
          </View>

          {/* 3 Translucent Stats Boxes */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Ionicons name="briefcase-outline" size={22} color="#FFFFFF" />
              <Text style={styles.statNumber}>{projects.length}</Text>
              <Text style={styles.statLabel}>المشاريع</Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons name="play-circle-outline" size={22} color="#FFFFFF" />
              <Text style={styles.statNumber}>{activeProjects.length}</Text>
              <Text style={styles.statLabel}>قيد التنفيذ</Text>
            </View>

            <View style={styles.statBox}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#FFFFFF" />
              <Text style={styles.statNumber}>{completedProjects.length}</Text>
              <Text style={styles.statLabel}>المكتملة</Text>
            </View>
          </View>
        </LinearGradient>

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

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.badgeAmber}>
            <Text style={styles.badgeAmberText}>النشطة • {activeProjects.length}</Text>
          </View>
          <Text style={styles.sectionTitle}>قائمة المشاريع</Text>
        </View>

        {/* Projects List */}
        {projects.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="briefcase-outline" size={38} color={palette.muted} />
            <Text style={styles.emptyTitle}>لا توجد مشاريع مضافة بعد</Text>
            <Text style={styles.emptySubtitle}>ابدأ بإضافة مشروع جديد لتتبع مهامه ومراحله.</Text>
            <Pressable style={styles.emptyAddBtn} onPress={() => setFormVisible(true)}>
              <Text style={styles.emptyAddBtnText}>+ إضافة مشروع</Text>
            </Pressable>
          </View>
        ) : (
          projects.map((project) => {
            const projectIcon = getProjectIcon(project.key);
            return (
              <Pressable
                key={project._id}
                accessibilityRole="button"
                accessibilityLabel={`فتح تفاصيل مشروع ${project.name}`}
                onPress={() => navigation.navigate('ProjectDetail', { id: project._id })}
                style={({ pressed }) => [
                  styles.projectCard,
                  pressed && styles.projectCardPressed,
                ]}
              >
                {/* Top Row: Icon + Name on right, Structure Badge on left */}
                <View style={styles.projectCardTop}>
                  <View style={styles.projectIdentity}>
                    <View style={styles.projectIconBox}>
                      <Ionicons name={projectIcon} size={22} color={palette.primary} />
                    </View>
                    <View style={styles.projectTitleContainer}>
                      <Text style={styles.projectName}>{project.name}</Text>
                      <Text style={styles.projectKeyLabel}>{projectLabels[project.key]}</Text>
                    </View>
                  </View>

                  <View style={styles.structureBadge}>
                    <Text style={styles.structureBadgeText}>
                      {structureLabels[project.structureType]}
                    </Text>
                  </View>
                </View>

                {/* Description if present */}
                {project.description ? (
                  <Text style={styles.projectDescription} numberOfLines={2}>
                    {project.description}
                  </Text>
                ) : null}

                {/* Progress Section */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressHeaderRow}>
                    <Text style={styles.progressPercentText}>{project.progress}%</Text>
                    <Text style={styles.progressLabel}>معدل الإنجاز</Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.max(0, Math.min(100, project.progress))}%` },
                      ]}
                    />
                  </View>
                </View>

                {/* Bottom Action Pill */}
                <View style={styles.projectCardBottom}>
                  <View style={styles.openPill}>
                    <Ionicons name="arrow-back" size={15} color={palette.primary} />
                    <Text style={styles.openPillText}>فتح مساحة المشروع</Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      project.active ? styles.statusPillActive : styles.statusPillArchived,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        project.active ? styles.statusPillTextActive : styles.statusPillTextArchived,
                      ]}
                    >
                      {project.active ? 'نشط' : 'مؤرشف'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Add Project Modal (Formulaire) */}
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
              <Pressable
                accessibilityRole="button"
                onPress={() => setFormVisible(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color={palette.text} />
              </Pressable>
              <Text style={styles.modalTitle}>مشروع جديد</Text>
            </View>

            {/* Basic Info */}
            <View style={styles.formCard}>
              <Text style={styles.formSectionHeading}>المعلومات الأساسية</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>اسم المشروع *</Text>
                <TextInput
                  accessibilityLabel="اسم المشروع"
                  placeholder="مثال: تطوير المنصة، مسابقة التحدي..."
                  placeholderTextColor={palette.muted}
                  value={form.name}
                  onChangeText={(name) => setForm({ ...form, name })}
                  style={styles.formInput}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>مفتاح المشروع</Text>
                <View style={styles.chipsWrap}>
                  {projectKeys.map((key) => (
                    <Pressable
                      key={key}
                      onPress={() => setForm({ ...form, key })}
                      style={[
                        styles.selectChip,
                        form.key === key && styles.selectChipActive,
                      ]}
                    >
                      <Ionicons
                        name={getProjectIcon(key)}
                        size={16}
                        color={form.key === key ? '#FFFFFF' : palette.text}
                      />
                      <Text
                        style={[
                          styles.selectChipText,
                          form.key === key && styles.selectChipTextActive,
                        ]}
                      >
                        {projectLabels[key]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>نوع بنية المشروع</Text>
                <View style={styles.chipsWrap}>
                  {structures.map((st) => (
                    <Pressable
                      key={st}
                      onPress={() => setForm({ ...form, structureType: st })}
                      style={[
                        styles.selectChip,
                        form.structureType === st && styles.selectChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectChipText,
                          form.structureType === st && styles.selectChipTextActive,
                        ]}
                      >
                        {structureLabels[st]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.hintText}>{structureHints[form.structureType]}</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>وصف المشروع (اختياري)</Text>
                <TextInput
                  accessibilityLabel="وصف المشروع"
                  placeholder="ملاحظات حول أهداف المشروع وكيفية إدارته..."
                  placeholderTextColor={palette.muted}
                  multiline
                  numberOfLines={3}
                  value={form.description ?? ''}
                  onChangeText={(description) => setForm({ ...form, description })}
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
                label={saving ? 'جارٍ الإنشاء...' : 'إنشاء المشروع'}
                disabled={saving}
                onPress={() => void createProject()}
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
    </View>
  );
}

/**
 * شاشة تفاصيل المشروع العامة (LegacyProjectDetailScreen)
 * بتصميم عصري وأنيق
 */
export function LegacyProjectDetailScreen({ route }: { route: { params: { id: string } } }) {
  const { id } = route.params;
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [nodes, setNodes] = useState<ProjectNodeDTO[]>([]);
  const [achievements, setAchievements] = useState<import('../../types/dto').ProjectAchievementsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [nodeTitle, setNodeTitle] = useState('');
  const [nodeType, setNodeType] = useState<ProjectNodeDTO['type']>('card');
  const [nodeParent, setNodeParent] = useState('');
  const [nodeStatus, setNodeStatus] = useState<ProjectNodeDTO['status']>('todo');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [detail, nextAchievements, nextNodes] = await Promise.all([
        api.getProject(id),
        api.getProjectAchievements(id),
        api.listProjectNodes(id, { limit: 100 }),
      ]);
      setProject(detail.project);
      setNodes(nextNodes.length ? nextNodes : detail.nodes);
      setAchievements(nextAchievements);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function openNode(node?: ProjectNodeDTO) {
    setEditingId(node?._id ?? null);
    setNodeTitle(node?.title ?? '');
    setNodeType(node?.type ?? (project?.structureType === 'level_game' ? 'level' : 'card'));
    setNodeParent(node?.parentId ?? '');
    setNodeStatus(node?.status ?? 'todo');
    setFormError('');
    setFormVisible(true);
  }

  async function saveNode() {
    if (!nodeTitle.trim()) {
      setFormError('عنوان العنصر مطلوب.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const input = {
        title: nodeTitle.trim(),
        type: nodeType,
        parentId: nodeParent.trim() || null,
        status: nodeStatus,
      };
      if (editingId) await api.updateProjectNode(editingId, input);
      else await api.createProjectNode(id, input);
      setFormVisible(false);
      setSuccess('تم حفظ العنصر بنجاح.');
      await load();
    } catch (requestError) {
      setFormError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function changeNodeStatus(node: ProjectNodeDTO) {
    setError('');
    try {
      await api.updateProjectNodeStatus(node._id, node.status === 'done' ? 'todo' : 'done');
      setSuccess('تم تحديث حالة العنصر.');
      await load();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    }
  }

  async function removeNode() {
    if (!deleteId) return;
    setSaving(true);
    try {
      await api.deleteProjectNode(deleteId);
      setDeleteId(null);
      setSuccess('تم حذف العنصر بنجاح.');
      await load();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setDeleteId(null);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !project) return <LoadingState label="جارٍ تحميل مساحة المشروع..." />;
  if (error && !project) {
    return (
      <ScreenState
        title="تعذر تحميل المشروع"
        message={error}
        actionLabel="إعادة المحاولة"
        onAction={() => void load()}
      />
    );
  }
  if (!project) return <ScreenState title="المشروع غير متاح" message={error} />;

  const visibleNodes = orderNodesByTree(nodes);

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Top Nav */}
        <View style={styles.topNav}>
          <Pressable
            accessibilityRole="button"
            onPress={() => goBackSafe(navigation)}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-forward" size={20} color={palette.primary} />
            <Text style={styles.backBtnText}>العودة</Text>
          </Pressable>
          <Text style={styles.navTitle} numberOfLines={1}>
            {project.name}
          </Text>
        </View>

        {/* Project Hero Card */}
        <View style={styles.detailHeroCard}>
          <View style={styles.detailHeroTop}>
            <View style={styles.projectIconBoxLarge}>
              <Ionicons name={getProjectIcon(project.key)} size={28} color={palette.primary} />
            </View>
            <View style={styles.detailHeroTexts}>
              <Text style={styles.detailHeroTitle}>{project.name}</Text>
              <Text style={styles.detailHeroSubtitle}>
                {structureLabels[project.structureType]} · تقدم المشروع: {project.progress}%
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(0, Math.min(100, project.progress))}%` },
              ]}
            />
          </View>
        </View>

        {/* Achievements Card if available */}
        {achievements && achievements.milestones.length > 0 ? (
          <View style={styles.achievementsCard}>
            <View style={styles.achievementsHeader}>
              <Ionicons name="trophy-outline" size={20} color="#F59E0B" />
              <Text style={styles.achievementsTitle}>الإنجازات والمعالم</Text>
            </View>
            {achievements.milestones.map((m, idx) => (
              <View key={m._id ?? idx} style={styles.milestoneRow}>
                <Ionicons
                  name={m.status === 'done' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={m.status === 'done' ? '#10B981' : palette.muted}
                />
                <Text style={styles.milestoneText}>{m.title ?? 'معلم إنجاز'}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Nodes Header & Add button */}
        <View style={styles.sectionHeader}>
          <Pressable
            onPress={() => openNode()}
            style={styles.addNodeBtn}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addNodeBtnText}>إضافة عنصر</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>مكونات المشروع ({visibleNodes.length})</Text>
        </View>

        {success ? (
          <View style={styles.alertSuccess}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.alertSuccessText}>{success}</Text>
          </View>
        ) : null}

        {visibleNodes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptySubtitle}>لا توجد عناصر في هذا المشروع بعد. أضف عناصر لبدء العمل.</Text>
          </View>
        ) : (
          visibleNodes.map(({ node, depth }) => (
            <View
              key={node._id}
              style={[
                styles.nodeCard,
                depth > 0 && { marginRight: Math.min(depth * 16, 48), borderRightWidth: 3, borderRightColor: palette.primary },
              ]}
            >
              <View style={styles.nodeCardTop}>
                <Text style={styles.nodeTitleText}>
                  {project.structureType === 'level_game' ? `المستوى ${node.order + 1}: ` : ''}
                  {node.title}
                </Text>
                <View
                  style={[
                    styles.nodeStatusPill,
                    node.status === 'done' && styles.nodeStatusDone,
                  ]}
                >
                  <Text
                    style={[
                      styles.nodeStatusText,
                      node.status === 'done' && styles.nodeStatusTextDone,
                    ]}
                  >
                    {node.status === 'done' ? 'مكتمل' : node.status === 'in_progress' ? 'قيد التنفيذ' : 'للتنفيذ'}
                  </Text>
                </View>
              </View>

              <View style={styles.nodeActionsRow}>
                <Pressable
                  onPress={() => void changeNodeStatus(node)}
                  style={styles.nodeActionPill}
                >
                  <Ionicons
                    name={node.status === 'done' ? 'refresh-outline' : 'checkmark-outline'}
                    size={16}
                    color={palette.primary}
                  />
                  <Text style={styles.nodeActionPillText}>
                    {node.status === 'done' ? 'إعادة فتح' : 'إنجاز'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => openNode(node)}
                  style={styles.nodeIconBtn}
                >
                  <Ionicons name="pencil-outline" size={16} color="#475569" />
                </Pressable>

                <Pressable
                  onPress={() => setDeleteId(node._id)}
                  style={styles.nodeDeleteBtn}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Node Form Modal */}
      <Modal
        visible={formVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFormVisible(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.nodeModalCard}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setFormVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={palette.text} />
              </Pressable>
              <Text style={styles.modalTitle}>{editingId ? 'تعديل عنصر' : 'عنصر جديد'}</Text>
            </View>

            <TextInput
              accessibilityLabel="عنوان العنصر"
              placeholder="عنوان العنصر"
              placeholderTextColor={palette.muted}
              value={nodeTitle}
              onChangeText={setNodeTitle}
              style={styles.formInput}
            />

            <Text style={styles.fieldLabel}>الحالة</Text>
            <View style={styles.chipsWrap}>
              {(['todo', 'in_progress', 'done'] as const).map((st) => (
                <Pressable
                  key={st}
                  onPress={() => setNodeStatus(st)}
                  style={[
                    styles.selectChip,
                    nodeStatus === st && styles.selectChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.selectChipText,
                      nodeStatus === st && styles.selectChipTextActive,
                    ]}
                  >
                    {st === 'done' ? 'مكتمل' : st === 'in_progress' ? 'قيد التنفيذ' : 'للتنفيذ'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {formError ? <Text style={styles.alertErrorText}>{formError}</Text> : null}

            <View style={styles.modalActions}>
              <PrimaryButton
                label={saving ? 'جارٍ الحفظ...' : 'حفظ العنصر'}
                disabled={saving}
                onPress={() => void saveNode()}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        visible={deleteId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteId(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>حذف العنصر؟</Text>
            <Text style={styles.confirmBody}>سيتم حذف هذا العنصر وجميع العناصر التابعة له.</Text>
            <View style={styles.confirmButtons}>
              <Pressable onPress={() => void removeNode()} style={styles.confirmDeleteBtn}>
                <Text style={styles.confirmDeleteBtnText}>حذف</Text>
              </Pressable>
              <Pressable onPress={() => setDeleteId(null)} style={styles.confirmCancelBtn}>
                <Text style={styles.confirmCancelBtnText}>إلغاء</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * شاشة المشروع المخصصة بحسب النوع والمفتاح
 */
export function ProjectDetailScreen({ route }: { route: { params: { id: string } } }) {
  const { id } = route.params;
  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const detail = await api.getProject(id);
      setProject(detail.project);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading && !project) return <LoadingState label="جارٍ فتح مساحة المشروع..." />;
  if (!project) {
    return (
      <ScreenState
        title="تعذر فتح المشروع"
        message={error || 'المشروع غير متاح حاليًا.'}
        actionLabel="إعادة المحاولة"
        onAction={() => void load()}
      />
    );
  }

  switch (project.key) {
    case 'lb':
      return <LbProjectScreen project={project} />;
    case 'supnum':
      return <SupnumProjectScreen project={project} />;
    case 'basma_tech':
      return <BasmaTechProjectScreen project={project} />;
    case 'competitions':
      return <CompetitionsProjectScreen project={project} />;
    case 'messages_gaza':
      return <ProjectLevelGameScreen project={project} mode="gaza" />;
    case 'ai_depth':
      return <ProjectLevelGameScreen project={project} mode="ai" />;
    case 'hasaniya':
      return <HasaniyaScreen />;
    default:
      return <LegacyProjectDetailScreen route={route} />;
  }
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
  headerButtonsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  refreshPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  refreshPillPressed: {
    backgroundColor: '#DBEAFE',
  },
  refreshPillText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addBtnPressed: {
    opacity: 0.88,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
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
    marginBottom: 20,
  },
  heroTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTexts: {
    alignItems: 'flex-end',
    flex: 1,
    marginRight: 12,
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
  circleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 20,
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
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  badgeAmber: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeAmberText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '700',
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  projectCardPressed: {
    borderColor: palette.primaryBorder,
  },
  projectCardTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectIdentity: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  projectIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectTitleContainer: {
    alignItems: 'flex-end',
    flex: 1,
  },
  projectName: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  projectKeyLabel: {
    fontSize: 12,
    color: palette.muted,
    marginTop: 2,
  },
  structureBadge: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  structureBadgeText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  projectDescription: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'right',
    lineHeight: 21,
  },
  progressContainer: {
    gap: 6,
  },
  progressHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
    color: palette.muted,
    fontWeight: '600',
  },
  progressPercentText: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.primary,
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: palette.primary,
  },
  projectCardBottom: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  openPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  openPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.primary,
  },
  statusPill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillActive: {
    backgroundColor: '#ECFDF5',
  },
  statusPillArchived: {
    backgroundColor: '#F1F5F9',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPillTextActive: {
    color: '#059669',
  },
  statusPillTextArchived: {
    color: '#64748B',
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
    textAlign: 'center',
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
    minHeight: 80,
    paddingVertical: 12,
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
  hintText: {
    fontSize: 12,
    color: palette.muted,
    textAlign: 'right',
    marginTop: 4,
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
  topNav: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 8,
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
    fontSize: 14,
    fontWeight: '700',
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: palette.text,
    flex: 1,
    textAlign: 'left',
    marginRight: 12,
  },
  detailHeroCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    gap: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 14,
  },
  detailHeroTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  projectIconBoxLarge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailHeroTexts: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  detailHeroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  detailHeroSubtitle: {
    fontSize: 13,
    color: palette.muted,
  },
  achievementsCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    marginBottom: 14,
  },
  achievementsHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  achievementsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
  },
  milestoneRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  milestoneText: {
    fontSize: 14,
    color: '#78350F',
    fontWeight: '600',
  },
  addNodeBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addNodeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  nodeCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  nodeCardTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nodeTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    flex: 1,
    textAlign: 'right',
  },
  nodeStatusPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nodeStatusDone: {
    backgroundColor: '#ECFDF5',
  },
  nodeStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
  },
  nodeStatusTextDone: {
    color: '#059669',
  },
  nodeActionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  nodeActionPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nodeActionPillText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  nodeIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  nodeModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 14,
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
