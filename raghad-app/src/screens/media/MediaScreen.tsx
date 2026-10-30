import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
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
import type { RootStackParamList } from '../../navigation/types';
import { getApiErrorMessage } from '../../utils/apiError';
import { goBackSafe } from '../../utils/goBackSafe';

export type MediaKind = 'program' | 'journal' | 'beek_idea';

export interface MediaItem {
  _id: string;
  kind: MediaKind;
  title: string;
  body?: string;
  projectId?: string;
  watchedAt?: string;
  tags?: string[];
  createdAt: string;
}

interface MediaListResponse {
  items: MediaItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

const KIND_CONFIG: Record<
  MediaKind,
  { label: string; bg: string; text: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  program: {
    label: 'برامج',
    bg: '#ECFDF5',
    text: '#047857',
    icon: 'tv-outline',
  },
  journal: {
    label: 'يوميات',
    bg: '#FFFBEB',
    text: '#B45309',
    icon: 'journal-outline',
  },
  beek_idea: {
    label: 'أفكار البيك',
    bg: '#EEF2FF',
    text: '#4F46E5',
    icon: 'bulb-outline',
  },
};

type FilterKind = 'all' | MediaKind;

const FILTER_TABS: { key: FilterKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'الكل', icon: 'grid-outline' },
  { key: 'program', label: 'برامج', icon: 'tv-outline' },
  { key: 'journal', label: 'يوميات', icon: 'journal-outline' },
  { key: 'beek_idea', label: 'أفكار البيك', icon: 'bulb-outline' },
];

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  } catch {
    return dateStr;
  }
}

export function MediaScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Media'>>();
  const initialKind = route.params?.kind;

  // List data states
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Tab filtering
  const [activeTab, setActiveTab] = useState<FilterKind>(initialKind ?? 'all');

  // Counts for summary stats
  const [programsCount, setProgramsCount] = useState(0);
  const [journalCount, setJournalCount] = useState(0);
  const [beekCount, setBeekCount] = useState(0);

  // Selected item detail modal
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Create modal states
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [createKind, setCreateKind] = useState<MediaKind>('program');
  const [createTitle, setCreateTitle] = useState('');
  const [createBody, setCreateBody] = useState('');
  const [createTags, setCreateTags] = useState('');
  const [createWatched, setCreateWatched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit modal states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirm dialog
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load items
  const loadData = useCallback(
    async (targetPage = page, kindFilter = activeTab) => {
      setLoading(true);
      setError('');

      try {
        const params: Record<string, string | number> = {
          page: targetPage,
          limit: 20,
        };
        if (kindFilter !== 'all') {
          params.kind = kindFilter;
        }

        const res = (await api.listMediaItems(params)) as MediaListResponse;
        const fetchedItems = res?.items ?? [];
        setItems(fetchedItems);
        setTotal(res?.meta?.total ?? fetchedItems.length);
        setPage(targetPage);

        // Fetch counts for all kinds
        void Promise.all([
          api.listMediaItems({ kind: 'program', limit: 1 }).catch(() => null),
          api.listMediaItems({ kind: 'journal', limit: 1 }).catch(() => null),
          api.listMediaItems({ kind: 'beek_idea', limit: 1 }).catch(() => null),
        ]).then(([pRes, jRes, bRes]) => {
          if (pRes) setProgramsCount((pRes as MediaListResponse)?.meta?.total ?? 0);
          if (jRes) setJournalCount((jRes as MediaListResponse)?.meta?.total ?? 0);
          if (bRes) setBeekCount((bRes as MediaListResponse)?.meta?.total ?? 0);
        });
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [page, activeTab]
  );

  useFocusEffect(
    useCallback(() => {
      void loadData(1, activeTab);
    }, [activeTab])
  );

  const handleTabChange = (newTab: FilterKind) => {
    setActiveTab(newTab);
    setPage(1);
    void loadData(1, newTab);
  };

  const handlePageChange = (newPage: number) => {
    void loadData(newPage, activeTab);
  };

  // Open detail
  const openDetail = async (item: MediaItem) => {
    setSelectedItem(item);
    setDetailModalVisible(true);
    try {
      const full = (await api.getMediaItem(item._id)) as { item?: MediaItem } | MediaItem;
      const resolved = (full as { item?: MediaItem }).item ?? (full as MediaItem);
      if (resolved && resolved._id) {
        setSelectedItem(resolved);
      }
    } catch {
      // fallback to item
    }
  };

  // Create submission
  const handleCreateSubmit = async () => {
    if (!createTitle.trim()) {
      setCreateError('عنوان العنصر مطلوب.');
      return;
    }

    setCreating(true);
    setCreateError('');

    try {
      const tagList = createTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await api.createMediaItem({
        kind: createKind,
        title: createTitle.trim(),
        body: createBody.trim() || undefined,
        tags: tagList.length > 0 ? tagList : undefined,
        watchedAt: createWatched ? new Date().toISOString() : undefined,
      });

      setCreateModalVisible(false);
      setCreateTitle('');
      setCreateBody('');
      setCreateTags('');
      setCreateWatched(false);
      setSuccess('تمت إضافة العنصر بنجاح.');
      await loadData(1, activeTab);
    } catch (err) {
      setCreateError(getApiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  // Start edit
  const openEditModal = () => {
    if (!selectedItem) return;
    setEditTitle(selectedItem.title);
    setEditBody(selectedItem.body ?? '');
    setEditTags(selectedItem.tags ? selectedItem.tags.join(', ') : '');
    setEditError('');
    setEditModalVisible(true);
  };

  // Save edit
  const handleEditSubmit = async () => {
    if (!selectedItem) return;
    if (!editTitle.trim()) {
      setEditError('عنوان العنصر مطلوب.');
      return;
    }

    setEditing(true);
    setEditError('');

    try {
      const tagList = editTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const trimmedBody = editBody.trim();

      const res = (await api.updateMediaItem(selectedItem._id, {
        title: editTitle.trim(),
        body: trimmedBody,
        tags: tagList,
      })) as { item?: MediaItem } | MediaItem;

      const resolved =
        (res as { item?: MediaItem }).item ??
        (res as MediaItem) ?? {
          ...selectedItem,
          title: editTitle.trim(),
          body: trimmedBody,
          tags: tagList,
        };

      setSelectedItem(resolved);
      setEditModalVisible(false);
      setDetailModalVisible(true);
      setSuccess('تم حفظ التعديلات بنجاح.');
      await loadData();
    } catch (err) {
      setEditError(getApiErrorMessage(err));
    } finally {
      setEditing(false);
    }
  };

  // Delete submission
  const handleDeleteSubmit = async () => {
    if (!selectedItem) return;
    setDeleting(true);

    try {
      await api.deleteMediaItem(selectedItem._id);
      setDeleteConfirmVisible(false);
      setDetailModalVisible(false);
      setSelectedItem(null);
      setSuccess('تم حذف العنصر بنجاح.');
      await loadData();
    } catch (err) {
      setError(getApiErrorMessage(err));
      setDeleteConfirmVisible(false);
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / 20) || 1;

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.pageCategoryBadge}>الأنشطة والوسائط</Text>
            <Text style={styles.pageTitle}>البرامج والوسائط</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (activeTab !== 'all') {
                  setCreateKind(activeTab);
                }
                setCreateError('');
                setCreateModalVisible(true);
              }}
              style={({ pressed }) => [styles.addBtn, pressed && styles.btnPressed]}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addBtnText}>إضافة عنصر</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="رجوع"
              onPress={() => goBackSafe(navigation)}
              style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
            >
              <Ionicons name="arrow-forward" size={17} color={palette.primary} />
              <Text style={styles.backBtnText}>رجوع</Text>
            </Pressable>
          </View>
        </View>

        {/* Success Alert Banner */}
        {success ? (
          <View style={styles.alertSuccess} accessibilityRole="alert">
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={styles.alertSuccessText}>{success}</Text>
            <Pressable onPress={() => setSuccess('')}>
              <Ionicons name="close" size={16} color="#059669" />
            </Pressable>
          </View>
        ) : null}

        {/* Error Screen State */}
        {error ? (
          <View style={styles.alertError} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={styles.alertErrorText}>{error}</Text>
          </View>
        ) : null}

        {/* Hero Progress Banner */}
        <LinearGradient
          colors={['#1E293B', '#334155', '#475569']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <View style={styles.circleProgressTrack}>
              <Ionicons name="play-circle" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.heroTexts}>
              <Text style={styles.heroTitle}>المكتبة المعرفية والوسائط</Text>
              <Text style={styles.heroSubtitle}>
                توثيق البرامج، وتدوين المذكرات، وأفكار جلسات البيك
              </Text>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatBox}>
              <Ionicons name="tv-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{programsCount}</Text>
              <Text style={styles.heroStatLabel}>البرامج</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Ionicons name="journal-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{journalCount}</Text>
              <Text style={styles.heroStatLabel}>اليوميات</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Ionicons name="bulb-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{beekCount}</Text>
              <Text style={styles.heroStatLabel}>أفكار البيك</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Filter Pills Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          {FILTER_TABS.map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => handleTabChange(tab.key)}
                style={[
                  styles.filterPill,
                  isSelected && styles.filterPillSelected,
                ]}
              >
                <Ionicons
                  name={tab.icon}
                  size={15}
                  color={isSelected ? '#FFFFFF' : palette.muted}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected && styles.filterPillTextSelected,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Loading State */}
        {loading && items.length === 0 ? (
          <LoadingState label="جارٍ تحميل عناصر الوسائط..." />
        ) : null}

        {/* Empty State */}
        {!loading && items.length === 0 ? (
          <ScreenState
            title="لا توجد عناصر وسائط"
            message={
              activeTab === 'all'
                ? 'لم يتم إضافة أي عناصر بعد. أضف برنامجًا أو يوميات أو فكرة للبدء.'
                : `لا توجد عناصر تحت تصنيف "${FILTER_TABS.find((t) => t.key === activeTab)?.label}".`
            }
            actionLabel="إضافة عنصر جديد"
            onAction={() => {
              if (activeTab !== 'all') {
                setCreateKind(activeTab);
              }
              setCreateError('');
              setCreateModalVisible(true);
            }}
          />
        ) : null}

        {/* Items List */}
        {!loading &&
          items.map((item) => {
            const kindMeta = KIND_CONFIG[item.kind] ?? KIND_CONFIG.program;
            const bodyPreview = item.body
              ? item.body.length > 80
                ? `${item.body.slice(0, 80)}...`
                : item.body
              : '';

            return (
              <Pressable
                key={item._id}
                accessibilityRole="button"
                accessibilityLabel={`عرض تفاصيل ${item.title}`}
                onPress={() => void openDetail(item)}
                style={({ pressed }) => [
                  styles.mediaCard,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.kindBadge, { backgroundColor: kindMeta.bg }]}>
                    <Ionicons name={kindMeta.icon} size={13} color={kindMeta.text} />
                    <Text style={[styles.kindBadgeText, { color: kindMeta.text }]}>
                      {kindMeta.label}
                    </Text>
                  </View>

                  {item.watchedAt ? (
                    <View style={styles.watchedBadge}>
                      <Ionicons name="checkmark-circle" size={12} color="#059669" />
                      <Text style={styles.watchedBadgeText}>مكتمل المشاهدة</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.mediaTitle}>{item.title}</Text>

                {bodyPreview ? (
                  <Text style={styles.mediaBodyPreview}>{bodyPreview}</Text>
                ) : null}

                <View style={styles.mediaCardFooter}>
                  <View style={styles.mediaDateRow}>
                    <Ionicons name="calendar-outline" size={12} color={palette.muted} />
                    <Text style={styles.mediaDateText}>
                      {item.watchedAt
                        ? `مشاهدة: ${formatDate(item.watchedAt)}`
                        : formatDate(item.createdAt)}
                    </Text>
                  </View>

                  {item.tags && item.tags.length > 0 ? (
                    <View style={styles.tagsRow}>
                      {item.tags.slice(0, 2).map((t, idx) => (
                        <View key={`t-${idx}`} style={styles.tagPill}>
                          <Text style={styles.tagPillText}>#{t}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}

        {/* Pagination */}
        {!loading && !error && total > 20 ? (
          <View style={styles.paginationRow}>
            <Pressable
              disabled={page <= 1}
              onPress={() => handlePageChange(page - 1)}
              style={[styles.pageBtn, page <= 1 && styles.btnDisabled]}
            >
              <Text style={styles.pageBtnText}>السابق</Text>
            </Pressable>

            <Text style={styles.pageIndicator}>
              صفحة {page} من {totalPages}
            </Text>

            <Pressable
              disabled={page >= totalPages}
              onPress={() => handlePageChange(page + 1)}
              style={[styles.pageBtn, page >= totalPages && styles.btnDisabled]}
            >
              <Text style={styles.pageBtnText}>التالي</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* CREATE MODAL */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.dialogScroll}>
            <View style={styles.dialog}>
              <View style={styles.dialogHeader}>
                <Text style={styles.dialogTitle}>إضافة عنصر وسائط جديد</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCreateModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>النوع *</Text>
                <View style={styles.kindSelectorRow}>
                  {(['program', 'journal', 'beek_idea'] as MediaKind[]).map((k) => {
                    const sel = createKind === k;
                    return (
                      <Pressable
                        key={k}
                        onPress={() => setCreateKind(k)}
                        style={[styles.kindSelectBtn, sel && styles.kindSelectBtnActive]}
                      >
                        <Text style={[styles.kindSelectBtnText, sel && styles.kindSelectBtnTextActive]}>
                          {KIND_CONFIG[k].label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>العنوان *</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="مثال: بودكاست طارق السويدان"
                  placeholderTextColor={palette.muted}
                  value={createTitle}
                  onChangeText={setCreateTitle}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الملاحظات أو المحتوى</Text>
                <TextInput
                  style={[commonStyles.input, styles.textArea]}
                  multiline
                  placeholder="التفاصيل، الروابط، أو الأفكار..."
                  placeholderTextColor={palette.muted}
                  value={createBody}
                  onChangeText={setCreateBody}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الوسوم (مفصولة بفاصلة)</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="تطوير، قيادة، ملخص..."
                  placeholderTextColor={palette.muted}
                  value={createTags}
                  onChangeText={setCreateTags}
                />
              </View>

              {createKind === 'program' ? (
                <Pressable
                  onPress={() => setCreateWatched(!createWatched)}
                  style={styles.checkboxRow}
                >
                  <Ionicons
                    name={createWatched ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={createWatched ? palette.primary : palette.muted}
                  />
                  <Text style={styles.checkboxLabel}>تمت مشاهدته بالفعل</Text>
                </Pressable>
              ) : null}

              {createError ? (
                <View style={styles.alertError} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={15} color="#EF4444" />
                  <Text style={styles.alertErrorText}>{createError}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label={creating ? 'جارٍ الإضافة...' : 'إضافة العنصر'}
                disabled={creating}
                onPress={() => void handleCreateSubmit()}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal
        visible={detailModalVisible && selectedItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.dialogScroll}>
            {selectedItem && (
              <View style={styles.dialog}>
                <View style={styles.dialogHeader}>
                  <View style={styles.detailTitleGroup}>
                    <Text style={styles.dialogTitle}>{selectedItem.title}</Text>
                    <View style={[styles.kindBadge, { backgroundColor: KIND_CONFIG[selectedItem.kind]?.bg }]}>
                      <Text style={[styles.kindBadgeText, { color: KIND_CONFIG[selectedItem.kind]?.text }]}>
                        {KIND_CONFIG[selectedItem.kind]?.label}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDetailModalVisible(false)}
                    style={styles.closeBtn}
                  >
                    <Ionicons name="close" size={20} color={palette.text} />
                  </Pressable>
                </View>

                {selectedItem.body ? (
                  <View style={styles.detailBodyBox}>
                    <Text style={styles.detailBodyText}>{selectedItem.body}</Text>
                  </View>
                ) : null}

                {selectedItem.tags && selectedItem.tags.length > 0 ? (
                  <View style={styles.tagsWrapRow}>
                    {selectedItem.tags.map((t, idx) => (
                      <View key={`dt-${idx}`} style={styles.tagPill}>
                        <Text style={styles.tagPillText}>#{t}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.detailActionsRow}>
                  <Pressable onPress={openEditModal} style={styles.actionOutlineBtn}>
                    <Ionicons name="create-outline" size={15} color={palette.primary} />
                    <Text style={styles.actionOutlineBtnText}>تعديل</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDeleteConfirmVisible(true)}
                    style={styles.actionDangerBtn}
                  >
                    <Ionicons name="trash-outline" size={15} color={palette.danger} />
                    <Text style={styles.actionDangerBtnText}>حذف</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* EDIT MODAL */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.dialogScroll}>
            <View style={styles.dialog}>
              <View style={styles.dialogHeader}>
                <Text style={styles.dialogTitle}>تعديل العنصر</Text>
                <Pressable onPress={() => setEditModalVisible(false)} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>العنوان</Text>
                <TextInput style={commonStyles.input} value={editTitle} onChangeText={setEditTitle} />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>المحتوى</Text>
                <TextInput
                  style={[commonStyles.input, styles.textArea]}
                  multiline
                  value={editBody}
                  onChangeText={setEditBody}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>الوسوم</Text>
                <TextInput style={commonStyles.input} value={editTags} onChangeText={setEditTags} />
              </View>

              {editError ? (
                <View style={styles.alertError} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={15} color="#EF4444" />
                  <Text style={styles.alertErrorText}>{editError}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label={editing ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                disabled={editing}
                onPress={() => void handleEditSubmit()}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* DELETE CONFIRM MODAL */}
      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmDialog}>
            <View style={styles.confirmIconBox}>
              <Ionicons name="alert-circle" size={28} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>حذف العنصر</Text>
            <Text style={styles.confirmText}>
              هل أنت متأكد من حذف هذا العنصر؟ لا يمكن التراجع عن هذه الخطوة.
            </Text>
            <View style={styles.confirmActionsRow}>
              <Pressable
                disabled={deleting}
                onPress={() => void handleDeleteSubmit()}
                style={[styles.confirmDeleteBtn, deleting && styles.btnDisabled]}
              >
                <Text style={styles.confirmDeleteBtnText}>
                  {deleting ? 'جارٍ الحذف...' : 'نعم، احذف'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDeleteConfirmVisible(false)}
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
  headerActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  addBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
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
    shadowColor: '#1E293B',
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
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
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
    color: 'rgba(255, 255, 255, 0.85)',
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
  filterPillsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingVertical: 4,
  },
  filterPill: {
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
  filterPillSelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
  },
  filterPillTextSelected: {
    color: '#FFFFFF',
  },
  mediaCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 10,
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
  cardHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kindBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kindBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  watchedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  watchedBadgeText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  mediaTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  mediaBodyPreview: {
    fontSize: 13,
    color: palette.muted,
    lineHeight: 19,
    textAlign: 'right',
  },
  mediaCardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  mediaDateRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  mediaDateText: {
    fontSize: 12,
    color: palette.muted,
  },
  tagsRow: {
    flexDirection: 'row-reverse',
    gap: 6,
  },
  tagPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagPillText: {
    fontSize: 11,
    color: palette.primary,
    fontWeight: '600',
  },
  paginationRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.primary,
  },
  pageIndicator: {
    fontSize: 13,
    color: palette.muted,
    fontWeight: '600',
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
  detailTitleGroup: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  dialogTitle: {
    fontSize: 19,
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
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'right',
  },
  kindSelectorRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  kindSelectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
  },
  kindSelectBtnActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  kindSelectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  kindSelectBtnTextActive: {
    color: '#FFFFFF',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  checkboxRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checkboxLabel: {
    fontSize: 14,
    color: palette.text,
    fontWeight: '600',
  },
  detailBodyBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
  },
  detailBodyText: {
    fontSize: 14,
    color: palette.text,
    lineHeight: 22,
    textAlign: 'right',
  },
  tagsWrapRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  detailActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  actionOutlineBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  actionOutlineBtnText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionDangerBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.danger,
    backgroundColor: '#FEF2F2',
  },
  actionDangerBtnText: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmDialog: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    padding: 20,
    gap: 14,
    alignItems: 'center',
  },
  confirmIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
  },
  confirmText: {
    fontSize: 13,
    color: palette.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmActionsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    width: '100%',
  },
  confirmDeleteBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmDeleteBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmCancelBtnText: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
