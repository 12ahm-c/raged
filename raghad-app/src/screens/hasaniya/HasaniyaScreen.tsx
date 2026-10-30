import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, ApiClientError } from '../../api/client';
import {
  commonStyles,
  LoadingState,
  palette,
  PrimaryButton,
  ScreenState,
} from '../../components/ui/States';
import { getApiErrorMessage } from '../../utils/apiError';
import { goBackSafe } from '../../utils/goBackSafe';

export type HasaniyaType = 'hasaniya' | 'translated' | 'qa' | 'dictionary';

export interface HasaniyaCard {
  _id: string;
  type: HasaniyaType;
  text: string;
  translation?: string;
  source?: string;
  referenceMark?: string;
  saved: boolean;
  createdAt: string;
}

export interface HasaniyaStats {
  total: number;
  byType: { type: string; count: number }[];
  saved: number;
}

interface FetchedPreviewItem {
  id: string;
  text: string;
  translation?: string;
  type: HasaniyaType;
  saving?: boolean;
  saved?: boolean;
  error?: string;
}

const CARD_TYPES: HasaniyaType[] = ['hasaniya', 'translated', 'qa', 'dictionary'];

const TYPE_LABELS: Record<HasaniyaType, string> = {
  hasaniya: 'حسانية',
  translated: 'مترجم',
  qa: 'سؤال-جواب',
  dictionary: 'قاموس',
};

const TYPE_THEMES: Record<HasaniyaType, { bg: string; text: string; border: string }> = {
  hasaniya: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  translated: { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  qa: { bg: '#EDE9FE', text: '#5B21B6', border: '#DDD6FE' },
  dictionary: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
};

const FILTER_TYPES: ('all' | HasaniyaType)[] = ['all', 'hasaniya', 'translated', 'qa', 'dictionary'];

const FILTER_LABELS: Record<'all' | HasaniyaType, string> = {
  all: 'الكل',
  hasaniya: 'حسانية',
  translated: 'مترجم',
  qa: 'سؤال-جواب',
  dictionary: 'قاموس',
};

function normalizeStats(data: unknown): HasaniyaStats {
  if (!data || typeof data !== 'object') {
    return { total: 0, byType: [], saved: 0 };
  }
  const obj = data as Record<string, unknown>;
  const total = typeof obj.total === 'number' ? obj.total : 0;
  const saved = typeof obj.saved === 'number' ? obj.saved : total;

  let byType: { type: string; count: number }[] = [];
  if (Array.isArray(obj.byType)) {
    byType = obj.byType
      .map((item: unknown) => {
        if (item && typeof item === 'object') {
          const itemObj = item as Record<string, unknown>;
          return {
            type: String(itemObj.type ?? itemObj._id ?? ''),
            count: Number(itemObj.count ?? 0),
          };
        }
        return { type: '', count: 0 };
      })
      .filter((i) => Boolean(i.type));
  } else if (obj.byType && typeof obj.byType === 'object') {
    byType = Object.entries(obj.byType as Record<string, unknown>).map(([type, count]) => ({
      type,
      count: Number(count ?? 0),
    }));
  }

  return { total, byType, saved };
}

function parseCardsResponse(res: unknown): { items: HasaniyaCard[]; total: number; page: number } {
  if (Array.isArray(res)) {
    return { items: res as HasaniyaCard[], total: res.length, page: 1 };
  }
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    const items = Array.isArray(obj.items) ? (obj.items as HasaniyaCard[]) : [];
    const meta = obj.meta && typeof obj.meta === 'object' ? (obj.meta as Record<string, unknown>) : {};
    const total = Number(meta.totalCount ?? meta.total ?? items.length);
    const page = Number(meta.page ?? 1);
    return { items, total, page };
  }
  return { items: [], total: 0, page: 1 };
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function HasaniyaScreen() {
  const navigation = useNavigation();

  // Stats state
  const [stats, setStats] = useState<HasaniyaStats>({ total: 0, byType: [], saved: 0 });
  const [statsLoading, setStatsLoading] = useState<boolean>(true);

  // Fetch state
  const [fetchPrompt, setFetchPrompt] = useState<string>('');
  const [fetchCount, setFetchCount] = useState<string>('5');
  const [fetching, setFetching] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string>('');
  const [previewCards, setPreviewCards] = useState<FetchedPreviewItem[]>([]);

  // Saved cards state
  const [cards, setCards] = useState<HasaniyaCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState<boolean>(true);
  const [cardsError, setCardsError] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [typeFilter, setTypeFilter] = useState<'all' | HasaniyaType>('all');
  const [search, setSearch] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');

  // Manual create modal state
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [createType, setCreateType] = useState<HasaniyaType>('hasaniya');
  const [createText, setCreateText] = useState<string>('');
  const [createTranslation, setCreateTranslation] = useState<string>('');
  const [createReferenceMark, setCreateReferenceMark] = useState<string>('');
  const [createSource, setCreateSource] = useState<string>('manual');
  const [createSaving, setCreateSaving] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');

  // Card detail & edit modal state
  const [detailCard, setDetailCard] = useState<HasaniyaCard | null>(null);
  const [editType, setEditType] = useState<HasaniyaType>('hasaniya');
  const [editText, setEditText] = useState<string>('');
  const [editTranslation, setEditTranslation] = useState<string>('');
  const [editReferenceMark, setEditReferenceMark] = useState<string>('');
  const [editSaving, setEditSaving] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');

  // Delete confirm modal state
  const [cardToDelete, setCardToDelete] = useState<HasaniyaCard | null>(null);
  const [deleteSaving, setDeleteSaving] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>('');

  // Success notice
  const [notice, setNotice] = useState<string>('');

  function showNotice(message: string) {
    setNotice(message);
    setTimeout(() => {
      setNotice((current) => (current === message ? '' : current));
    }, 4000);
  }

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api.getHasaniyaStats();
      setStats(normalizeStats(res));
    } catch {
      // stats failure is non-blocking
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadCards = useCallback(
    async (targetPage = 1, searchOverride?: string, typeOverride?: 'all' | HasaniyaType) => {
      setCardsLoading(true);
      setCardsError('');
      const currentType = typeOverride !== undefined ? typeOverride : typeFilter;
      const currentSearch = searchOverride !== undefined ? searchOverride : appliedSearch;

      try {
        const res = await api.listHasaniyaCards({
          page: targetPage,
          limit: 20,
          type: currentType === 'all' ? undefined : currentType,
          search: currentSearch.trim() || undefined,
        });
        const parsed = parseCardsResponse(res);
        setCards(parsed.items);
        setTotal(parsed.total);
        setPage(parsed.page);
      } catch (err) {
        setCardsError(getApiErrorMessage(err));
      } finally {
        setCardsLoading(false);
      }
    },
    [appliedSearch, typeFilter]
  );

  useFocusEffect(
    useCallback(() => {
      void loadStats();
      void loadCards(1);
    }, [loadCards, loadStats])
  );

  // 1. Fetch from Hugging Face via backend
  async function handleFetch() {
    setFetchError('');
    const count = parseInt(fetchCount, 10);
    if (isNaN(count) || count < 1 || count > 50) {
      setFetchError('يرجى تحديد عدد بطاقات صالح بين 1 و 50.');
      return;
    }

    setFetching(true);
    try {
      const res = await api.fetchHasaniyaCards({
        count,
        prompt: fetchPrompt.trim() || undefined,
      });

      const items = (Array.isArray(res) ? res : []) as {
        text?: string;
        translation?: string | null;
        type?: HasaniyaType;
      }[];

      if (items.length === 0) {
        setFetchError('لم يرجع الخادم أي بطاقات. يرجى تجربة موضوع آخر.');
        setPreviewCards([]);
      } else {
        const mapped: FetchedPreviewItem[] = items.map((item, index) => ({
          id: `preview-${Date.now()}-${index}`,
          text: typeof item.text === 'string' ? item.text : '',
          translation: typeof item.translation === 'string' ? item.translation : undefined,
          type: item.type && CARD_TYPES.includes(item.type) ? item.type : 'hasaniya',
          saved: false,
        }));
        setPreviewCards(mapped);
      }
    } catch (err) {
      const isExternalService =
        (err instanceof ApiClientError && err.code === 'EXTERNAL_SERVICE_ERROR') ||
        (typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === 'EXTERNAL_SERVICE_ERROR');

      if (isExternalService) {
        setFetchError('تعذر الوصول إلى خدمة الذكاء الاصطناعي — تحقق من الإعداد');
      } else {
        setFetchError(getApiErrorMessage(err));
      }
    } finally {
      setFetching(false);
    }
  }

  // 2. Save card from preview
  async function handleSavePreviewCard(previewItem: FetchedPreviewItem) {
    setPreviewCards((prev) =>
      prev.map((item) => (item.id === previewItem.id ? { ...item, saving: true, error: undefined } : item))
    );

    try {
      await api.createHasaniyaCard({
        type: previewItem.type,
        text: previewItem.text,
        translation: previewItem.translation || undefined,
        source: 'huggingface',
      });

      setPreviewCards((prev) =>
        prev.map((item) => (item.id === previewItem.id ? { ...item, saving: false, saved: true } : item))
      );
      showNotice('تم حفظ البطاقة بنجاح!');
      void loadCards(1);
      void loadStats();
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setPreviewCards((prev) =>
        prev.map((item) => (item.id === previewItem.id ? { ...item, saving: false, error: msg } : item))
      );
    }
  }

  // 3. Manual Create Modal
  function openCreateModal() {
    setCreateType('hasaniya');
    setCreateText('');
    setCreateTranslation('');
    setCreateReferenceMark('');
    setCreateSource('manual');
    setCreateError('');
    setCreateModalVisible(true);
  }

  async function handleCreateCard() {
    if (!createText.trim()) {
      setCreateError('نص البطاقة بالحسانية مطلوب.');
      return;
    }

    setCreateSaving(true);
    setCreateError('');

    try {
      await api.createHasaniyaCard({
        type: createType,
        text: createText.trim(),
        translation: createTranslation.trim() || undefined,
        referenceMark: createReferenceMark.trim() || undefined,
        source: createSource.trim() || 'manual',
      });
      setCreateModalVisible(false);
      showNotice('تمت إضافة البطاقة بنجاح!');
      void loadCards(1);
      void loadStats();
    } catch (err) {
      setCreateError(getApiErrorMessage(err));
    } finally {
      setCreateSaving(false);
    }
  }

  // 4. Detail & Edit
  function openDetailModal(card: HasaniyaCard) {
    setDetailCard(card);
    setEditType(card.type);
    setEditText(card.text);
    setEditTranslation(card.translation || '');
    setEditReferenceMark(card.referenceMark || '');
    setEditError('');
  }

  async function handleUpdateCard() {
    if (!detailCard) return;
    if (!editText.trim()) {
      setEditError('نص البطاقة بالحسانية مطلوب.');
      return;
    }

    setEditSaving(true);
    setEditError('');

    try {
      await api.updateHasaniyaCard(detailCard._id, {
        type: editType,
        text: editText.trim(),
        translation: editTranslation.trim() || undefined,
        referenceMark: editReferenceMark.trim() || undefined,
      });

      const updatedCard: HasaniyaCard = {
        ...detailCard,
        type: editType,
        text: editText.trim(),
        translation: editTranslation.trim() || undefined,
        referenceMark: editReferenceMark.trim() || undefined,
      };

      setDetailCard(updatedCard);
      setCards((prev) => prev.map((c) => (c._id === updatedCard._id ? updatedCard : c)));
      showNotice('تم حفظ تعديلات البطاقة.');
      setDetailCard(null);
      void loadStats();
    } catch (err) {
      setEditError(getApiErrorMessage(err));
    } finally {
      setEditSaving(false);
    }
  }

  // 5. Delete Card
  function requestDelete(card: HasaniyaCard) {
    setCardToDelete(card);
    setDeleteError('');
  }

  async function handleConfirmDelete() {
    if (!cardToDelete) return;
    setDeleteSaving(true);
    setDeleteError('');

    try {
      await api.deleteHasaniyaCard(cardToDelete._id);
      if (detailCard && detailCard._id === cardToDelete._id) {
        setDetailCard(null);
      }
      setCardToDelete(null);
      showNotice('تم حذف البطاقة.');
      void loadCards(page);
      void loadStats();
    } catch (err) {
      setDeleteError(getApiErrorMessage(err));
    } finally {
      setDeleteSaving(false);
    }
  }

  // Filter change
  function handleFilterSelect(type: 'all' | HasaniyaType) {
    setTypeFilter(type);
    void loadCards(1, appliedSearch, type);
  }

  // Search submit
  function handleSearchSubmit() {
    setAppliedSearch(search);
    void loadCards(1, search, typeFilter);
  }

  function handleSearchClear() {
    setSearch('');
    setAppliedSearch('');
    void loadCards(1, '', typeFilter);
  }

  const totalPages = Math.max(1, Math.ceil(total / 20));

  function getTypeCount(type: string): number {
    const found = stats.byType.find((b) => b.type === type);
    return found ? found.count : 0;
  }

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="الرجوع"
            onPress={() => goBackSafe(navigation)}
            style={({ pressed }) => [styles.backPill, pressed && styles.buttonPressed]}
          >
            <Ionicons name="arrow-forward" size={18} color={palette.primary} />
            <Text style={styles.backPillText}>رجوع</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إضافة بطاقة يدوياً"
            onPress={openCreateModal}
            style={({ pressed }) => [styles.addCardButton, pressed && styles.buttonPressed]}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addCardButtonText}>إضافة بطاقة</Text>
          </Pressable>
        </View>

        {/* Page Category & Title */}
        <View style={styles.titleSection}>
          <View style={styles.pageCategoryBadge}>
            <Ionicons name="language-outline" size={14} color="#D97706" />
            <Text style={styles.pageCategoryBadgeText}>مشروع وقاموس اللهجة</Text>
          </View>
          <Text style={styles.screenMainTitle}>الحسانية</Text>
          <Text style={styles.screenSubtitle}>
            قاموس وموسوعة اللهجة الحسانية الأصيلة مع الاستدعاء الذكي بالذكاء الاصطناعي
          </Text>
        </View>

        {/* Global Notice Alert */}
        {notice ? (
          <View style={styles.noticeBox} accessibilityRole="alert">
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {/* 1. Hero Banner: Stats & Distribution */}
        <LinearGradient
          colors={['#78350F', '#B45309', '#D97706']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroHeaderRow}>
            <View style={styles.heroTitleGroup}>
              <Text style={styles.heroTitle}>إحصاءات الموسوعة الحسانية</Text>
              <Text style={styles.heroSubtitle}>نظرة شاملة على المفردات والبطاقات المسجلة</Text>
            </View>
            <View style={styles.heroIconBubble}>
              <Ionicons name="book" size={24} color="#FEF3C7" />
            </View>
          </View>

          {/* Stats Summary Boxes */}
          <View style={styles.statsSummaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats.total}</Text>
              <Text style={styles.summaryLabel}>إجمالي البطاقات</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{stats.saved}</Text>
              <Text style={styles.summaryLabel}>البطاقات المحفوظة</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {stats.byType.reduce((acc, curr) => acc + (curr.count > 0 ? 1 : 0), 0)}
              </Text>
              <Text style={styles.summaryLabel}>أصناف المفردات</Text>
            </View>
          </View>

          {/* Breakdown Chips */}
          <View style={styles.typeStatsGrid}>
            {CARD_TYPES.map((t) => (
              <View key={t} style={styles.typeStatChip}>
                <Text style={styles.typeStatLabel}>{TYPE_LABELS[t]}</Text>
                <View style={styles.typeStatCountBadge}>
                  <Text style={styles.typeStatCount}>{getTypeCount(t)}</Text>
                </View>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* 2. 'استدعاء من الخادم' Section */}
        <View style={styles.cardContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionBadge}>
              <Ionicons name="sparkles" size={16} color="#B45309" />
              <Text style={styles.sectionBadgeText}>الذكاء الاصطناعي</Text>
            </View>
            <Text style={styles.cardSectionTitle}>استدعاء ذكي من الخادم</Text>
          </View>
          <Text style={styles.cardSectionDesc}>
            استخرج بطاقات حسانية جديدة وموثقة مع الترجمة الفصحى والشرح بضغطة زر.
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>الموضوع أو الكلمات المفتاحية (اختياري)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="search-outline" size={18} color={palette.muted} style={styles.inputIcon} />
              <TextInput
                accessibilityLabel="موضوع الاستدعاء"
                placeholder="مثال: أمثال شعبية، أدوات تقليدية، كلمات الترحيب..."
                placeholderTextColor={palette.muted}
                value={fetchPrompt}
                onChangeText={setFetchPrompt}
                style={styles.textInputWithIcon}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>عدد البطاقات المطلوبة</Text>
            <View style={styles.countPickerRow}>
              {['3', '5', '10', '15'].map((val) => (
                <Pressable
                  key={val}
                  onPress={() => setFetchCount(val)}
                  style={[
                    styles.countPill,
                    fetchCount === val && styles.countPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.countPillText,
                      fetchCount === val && styles.countPillTextActive,
                    ]}
                  >
                    {val} بطاقات
                  </Text>
                </Pressable>
              ))}
              <TextInput
                accessibilityLabel="عدد البطاقات المخصص"
                placeholder="رقم"
                placeholderTextColor={palette.muted}
                keyboardType="number-pad"
                value={fetchCount}
                onChangeText={setFetchCount}
                style={styles.customCountInput}
              />
            </View>
          </View>

          {fetchError ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Ionicons name="alert-circle" size={18} color={palette.danger} />
              <Text style={styles.errorText}>{fetchError}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="استدعاء البطاقات"
            accessibilityState={{ disabled: fetching }}
            disabled={fetching}
            onPress={() => void handleFetch()}
            style={({ pressed }) => [
              styles.fetchButton,
              fetching && styles.buttonDisabled,
              pressed && !fetching && styles.buttonPressed,
            ]}
          >
            {fetching ? (
              <View style={styles.inlineButtonContent}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.fetchButtonText}>جارٍ الاستدعاء من الخادم بالذكاء الاصطناعي...</Text>
              </View>
            ) : (
              <View style={styles.inlineButtonContent}>
                <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
                <Text style={styles.fetchButtonText}>بدء الاستدعاء</Text>
              </View>
            )}
          </Pressable>

          {/* Preview list for fetched cards */}
          {previewCards.length > 0 ? (
            <View style={styles.previewContainer}>
              <View style={styles.previewHeaderRow}>
                <View style={styles.previewCountBadge}>
                  <Text style={styles.previewCountText}>{previewCards.length} بطاقة مقترحة</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPreviewCards([])}
                  style={styles.clearPreviewBtn}
                >
                  <Ionicons name="close-circle-outline" size={16} color={palette.muted} />
                  <Text style={styles.clearPreviewBtnText}>مسح المقترحات</Text>
                </Pressable>
              </View>

              {previewCards.map((item, index) => (
                <View key={item.id} style={styles.previewCard}>
                  <View style={styles.previewCardTop}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>مقترح #{index + 1}</Text>
                    </View>
                    <View style={styles.badgeSecondary}>
                      <Ionicons name="sparkles" size={11} color="#B45309" />
                      <Text style={styles.badgeSecondaryText}>الذكاء الاصطناعي</Text>
                    </View>
                  </View>

                  <Text style={styles.previewCardText}>{item.text}</Text>
                  {item.translation ? (
                    <View style={styles.previewTranslationBox}>
                      <Text style={styles.previewTranslationLabel}>الترجمة / الشرح:</Text>
                      <Text style={styles.previewTranslationText}>{item.translation}</Text>
                    </View>
                  ) : null}

                  {item.error ? (
                    <Text style={commonStyles.error}>{item.error}</Text>
                  ) : null}

                  <View style={styles.cardActionRow}>
                    {item.saved ? (
                      <View style={styles.savedPill}>
                        <Ionicons name="checkmark-circle" size={16} color="#059669" />
                        <Text style={styles.savedPillText}>تم الحفظ في القاموس</Text>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`حفظ المقترح ${index + 1}`}
                        accessibilityState={{ disabled: item.saving }}
                        disabled={item.saving}
                        onPress={() => void handleSavePreviewCard(item)}
                        style={({ pressed }) => [
                          styles.actionPillButton,
                          item.saving && styles.buttonDisabled,
                          pressed && !item.saving && styles.buttonPressed,
                        ]}
                      >
                        {item.saving ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <View style={styles.buttonInnerRow}>
                            <Ionicons name="bookmark-outline" size={15} color="#FFFFFF" />
                            <Text style={styles.actionPillButtonText}>حفظ في القاموس</Text>
                          </View>
                        )}
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* 3. Saved Cards Section & Search/Filter */}
        <View style={styles.cardContainer}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionBadge}>
              <Ionicons name="library-outline" size={16} color="#B45309" />
              <Text style={styles.sectionBadgeText}>{total} بطاقة</Text>
            </View>
            <Text style={styles.cardSectionTitle}>البطاقات والمفردات المحفوظة</Text>
          </View>

          {/* Type Filter Pills */}
          <View style={styles.filterSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsContainer}
            >
              {FILTER_TYPES.map((typeKey) => {
                const isSelected = typeFilter === typeKey;
                const count = typeKey === 'all' ? total : getTypeCount(typeKey);
                return (
                  <Pressable
                    key={typeKey}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => handleFilterSelect(typeKey)}
                    style={[
                      styles.filterPill,
                      isSelected && styles.filterPillSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        isSelected && styles.filterPillTextSelected,
                      ]}
                    >
                      {FILTER_LABELS[typeKey]}
                    </Text>
                    <View
                      style={[
                        styles.filterPillBadge,
                        isSelected && styles.filterPillBadgeSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterPillBadgeText,
                          isSelected && styles.filterPillBadgeTextSelected,
                        ]}
                      >
                        {count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Search Bar */}
          <View style={styles.searchRow}>
            <View style={styles.searchFieldWrapper}>
              <Ionicons name="search" size={18} color={palette.muted} style={styles.searchFieldIcon} />
              <TextInput
                accessibilityLabel="البحث في البطاقات"
                placeholder="ابحث في نص الحسانية، الترجمة، أو المرجع..."
                placeholderTextColor={palette.muted}
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
                style={styles.searchInputClean}
              />
              {search.length > 0 ? (
                <Pressable onPress={handleSearchClear} style={styles.searchInnerClear}>
                  <Ionicons name="close-circle" size={18} color={palette.muted} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="بحث"
              onPress={handleSearchSubmit}
              style={({ pressed }) => [styles.searchSubmitButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.searchSubmitButtonText}>بحث</Text>
            </Pressable>
          </View>
        </View>

        {/* 4. States & Card List */}
        {cardsLoading ? (
          <LoadingState label="جارٍ تحميل بطاقات الحسانية..." />
        ) : cardsError ? (
          <ScreenState
            title="تعذر تحميل البطاقات"
            message={cardsError}
            actionLabel="إعادة المحاولة"
            onAction={() => void loadCards(page)}
          />
        ) : cards.length === 0 ? (
          <ScreenState
            title="لا توجد بطاقات هنا بعد"
            message={
              appliedSearch || typeFilter !== 'all'
                ? 'لا توجد نتائج مطابقة لخيارات التصفية والبحث الحالية.'
                : 'لم يتم حفظ أي بطاقات حتى الآن. يمكنك استدعاء بطاقات من الخادم أو إضافتها يدوياً.'
            }
            actionLabel={
              appliedSearch || typeFilter !== 'all' ? 'إعادة ضبط التصفية' : 'إضافة بطاقة يدوياً'
            }
            onAction={() => {
              if (appliedSearch || typeFilter !== 'all') {
                setTypeFilter('all');
                setSearch('');
                setAppliedSearch('');
                void loadCards(1, '', 'all');
              } else {
                openCreateModal();
              }
            }}
          />
        ) : (
          <View style={styles.cardsListContainer}>
            {cards.map((card) => {
              const theme = TYPE_THEMES[card.type] ?? {
                bg: '#FEF3C7',
                text: '#92400E',
                border: '#FDE68A',
              };

              return (
                <Pressable
                  key={card._id}
                  accessibilityRole="button"
                  accessibilityLabel={`عرض وتعديل البطاقة ${card.text.slice(0, 30)}`}
                  onPress={() => openDetailModal(card)}
                  style={({ pressed }) => [
                    styles.cardItem,
                    pressed && styles.cardItemPressed,
                  ]}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.typeBadge, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                      <Text style={[styles.typeBadgeText, { color: theme.text }]}>
                        {TYPE_LABELS[card.type] ?? card.type}
                      </Text>
                    </View>
                    <View style={styles.cardMetaGroup}>
                      <View style={styles.sourcePill}>
                        <Ionicons
                          name={card.source === 'huggingface' ? 'sparkles' : 'person-outline'}
                          size={11}
                          color={palette.muted}
                        />
                        <Text style={styles.sourcePillText}>
                          {card.source === 'huggingface' ? 'ذكاء اصطناعي' : 'يدوي'}
                        </Text>
                      </View>
                      <Text style={styles.cardDate}>{formatDate(card.createdAt)}</Text>
                    </View>
                  </View>

                  {/* Main Dialect Text */}
                  <Text style={styles.cardMainText}>
                    {card.text.length > 100 ? `${card.text.slice(0, 100)}...` : card.text}
                  </Text>

                  {card.translation ? (
                    <View style={styles.cardTranslationBox}>
                      <View style={styles.translationHeaderRow}>
                        <Ionicons name="chatbubble-ellipses-outline" size={13} color="#64748B" />
                        <Text style={styles.cardTranslationLabel}>المعنى / المقابل بالفصحى:</Text>
                      </View>
                      <Text style={styles.cardTranslationText}>
                        {card.translation.length > 100
                          ? `${card.translation.slice(0, 100)}...`
                          : card.translation}
                      </Text>
                    </View>
                  ) : null}

                  {card.referenceMark ? (
                    <View style={styles.referenceRow}>
                      <Ionicons name="bookmark-outline" size={13} color={palette.muted} />
                      <Text style={styles.cardRefText}>المرجع: {card.referenceMark}</Text>
                    </View>
                  ) : null}

                  <View style={styles.cardFooterRow}>
                    <View style={styles.tapToEditHint}>
                      <Ionicons name="create-outline" size={14} color={palette.primary} />
                      <Text style={styles.tapToEditHintText}>انقر للتعديل والعرض</Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="حذف البطاقة"
                      onPress={(e) => {
                        e.stopPropagation();
                        requestDelete(card);
                      }}
                      style={styles.deleteSmallButton}
                    >
                      <Ionicons name="trash-outline" size={14} color={palette.danger} />
                      <Text style={styles.deleteSmallButtonText}>حذف</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}

            {/* Modern Pagination */}
            {total > 20 ? (
              <View style={styles.paginationCard}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="الصفحة التالية"
                  accessibilityState={{ disabled: page >= totalPages }}
                  disabled={page >= totalPages}
                  onPress={() => void loadCards(page + 1)}
                  style={[
                    styles.pageNavButton,
                    page >= totalPages && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.pageNavButtonText}>التالي</Text>
                  <Ionicons name="chevron-back" size={16} color={palette.primary} />
                </Pressable>

                <View style={styles.pageIndicatorContainer}>
                  <Text style={styles.pageIndicatorText}>
                    صفحة {page} من {totalPages}
                  </Text>
                  <Text style={styles.pageIndicatorSub}>({total} بطاقة إجمالاً)</Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="الصفحة السابقة"
                  accessibilityState={{ disabled: page <= 1 }}
                  disabled={page <= 1}
                  onPress={() => void loadCards(page - 1)}
                  style={[styles.pageNavButton, page <= 1 && styles.buttonDisabled]}
                >
                  <Ionicons name="chevron-forward" size={16} color={palette.primary} />
                  <Text style={styles.pageNavButtonText}>السابق</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Manual Create Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <ScrollView style={commonStyles.screen} contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeaderRow}>
            <View>
              <Text style={styles.modalTitle}>إضافة بطاقة يدوياً</Text>
              <Text style={styles.modalSubtitle}>أدخل المفردة الحسانية مع ترجمتها ومرجعها</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إغلاق النافذة"
              onPress={() => setCreateModalVisible(false)}
              style={styles.modalCloseCircle}
            >
              <Ionicons name="close" size={20} color={palette.text} />
            </Pressable>
          </View>

          <View style={styles.cardContainer}>
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>نوع البطاقة</Text>
              <View style={styles.typeSelectorRow}>
                {CARD_TYPES.map((t) => {
                  const isSelected = createType === t;
                  return (
                    <Pressable
                      key={t}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setCreateType(t)}
                      style={[
                        styles.typeSelectorPill,
                        isSelected && styles.typeSelectorPillSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeSelectorPillText,
                          isSelected && styles.typeSelectorPillTextSelected,
                        ]}
                      >
                        {TYPE_LABELS[t]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>النص بالحسانية (مطلوب)</Text>
              <TextInput
                accessibilityLabel="النص بالحسانية"
                placeholder="اكتب العبارة أو الكلمة أو المثل الحساني..."
                placeholderTextColor={palette.muted}
                multiline
                numberOfLines={3}
                value={createText}
                onChangeText={setCreateText}
                style={[styles.cleanInput, styles.multilineInput]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>الترجمة أو الشرح (اختياري)</Text>
              <TextInput
                accessibilityLabel="الترجمة أو الشرح"
                placeholder="شرح المعنى أو المقابل بالعربية الفصحى..."
                placeholderTextColor={palette.muted}
                multiline
                numberOfLines={3}
                value={createTranslation}
                onChangeText={setCreateTranslation}
                style={[styles.cleanInput, styles.multilineInput]}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>الإشارة المرجعية (اختياري)</Text>
              <TextInput
                accessibilityLabel="الإشارة المرجعية"
                placeholder="مثال: ديوان البشير، راوٍ، أهل الحوض..."
                placeholderTextColor={palette.muted}
                value={createReferenceMark}
                onChangeText={setCreateReferenceMark}
                style={styles.cleanInput}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>المصدر</Text>
              <TextInput
                accessibilityLabel="المصدر"
                placeholder="manual"
                placeholderTextColor={palette.muted}
                value={createSource}
                onChangeText={setCreateSource}
                style={styles.cleanInput}
              />
            </View>

            {createError ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={16} color={palette.danger} />
                <Text style={styles.errorText}>{createError}</Text>
              </View>
            ) : null}

            <PrimaryButton
              label={createSaving ? 'جارٍ الحفظ...' : 'إضافة البطاقة'}
              disabled={createSaving}
              onPress={() => void handleCreateCard()}
            />
          </View>
        </ScrollView>
      </Modal>

      {/* Card Detail & Edit Modal */}
      <Modal
        visible={Boolean(detailCard)}
        animationType="slide"
        onRequestClose={() => setDetailCard(null)}
      >
        <ScrollView style={commonStyles.screen} contentContainerStyle={styles.modalContent}>
          <View style={styles.modalHeaderRow}>
            <View>
              <Text style={styles.modalTitle}>تفاصيل وتعديل البطاقة</Text>
              <Text style={styles.modalSubtitle}>تعديل المفردة أو الترجمة أو الإشارة المرجعية</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إغلاق النافذة"
              onPress={() => setDetailCard(null)}
              style={styles.modalCloseCircle}
            >
              <Ionicons name="close" size={20} color={palette.text} />
            </Pressable>
          </View>

          {detailCard ? (
            <View style={styles.cardContainer}>
              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Ionicons
                    name={detailCard.source === 'huggingface' ? 'sparkles' : 'person'}
                    size={13}
                    color="#D97706"
                  />
                  <Text style={styles.metaText}>
                    المصدر: {detailCard.source === 'huggingface' ? 'الذكاء الاصطناعي' : 'يدوي'}
                  </Text>
                </View>
                <View style={styles.metaChip}>
                  <Ionicons name="calendar-outline" size={13} color={palette.muted} />
                  <Text style={styles.metaText}>
                    أضيفت في: {formatDate(detailCard.createdAt)}
                  </Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>نوع البطاقة</Text>
                <View style={styles.typeSelectorRow}>
                  {CARD_TYPES.map((t) => {
                    const isSelected = editType === t;
                    return (
                      <Pressable
                        key={t}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setEditType(t)}
                        style={[
                          styles.typeSelectorPill,
                          isSelected && styles.typeSelectorPillSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeSelectorPillText,
                            isSelected && styles.typeSelectorPillTextSelected,
                          ]}
                        >
                          {TYPE_LABELS[t]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>النص بالحسانية (مطلوب)</Text>
                <TextInput
                  accessibilityLabel="تعديل النص بالحسانية"
                  placeholder="نص العبارة أو الكلمة..."
                  placeholderTextColor={palette.muted}
                  multiline
                  numberOfLines={4}
                  value={editText}
                  onChangeText={setEditText}
                  style={[styles.cleanInput, styles.multilineInput]}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>الترجمة أو الشرح بالفصحى</Text>
                <TextInput
                  accessibilityLabel="تعديل الترجمة أو الشرح"
                  placeholder="الترجمة بالفصحى..."
                  placeholderTextColor={palette.muted}
                  multiline
                  numberOfLines={3}
                  value={editTranslation}
                  onChangeText={setEditTranslation}
                  style={[styles.cleanInput, styles.multilineInput]}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>الإشارة المرجعية</Text>
                <TextInput
                  accessibilityLabel="تعديل الإشارة المرجعية"
                  placeholder="المرجع أو المصدر..."
                  placeholderTextColor={palette.muted}
                  value={editReferenceMark}
                  onChangeText={setEditReferenceMark}
                  style={styles.cleanInput}
                />
              </View>

              {editError ? (
                <View style={styles.errorBox} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={16} color={palette.danger} />
                  <Text style={styles.errorText}>{editError}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label={editSaving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                disabled={editSaving}
                onPress={() => void handleUpdateCard()}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="حذف هذه البطاقة"
                onPress={() => requestDelete(detailCard)}
                style={styles.dangerButton}
              >
                <Ionicons name="trash-outline" size={16} color={palette.danger} />
                <Text style={styles.dangerButtonText}>حذف هذه البطاقة</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={Boolean(cardToDelete)}
        transparent
        animationType="fade"
        onRequestClose={() => setCardToDelete(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.deleteHeaderRow}>
              <View style={styles.deleteWarningIcon}>
                <Ionicons name="warning" size={24} color={palette.danger} />
              </View>
              <View style={styles.deleteHeaderText}>
                <Text style={styles.confirmTitle}>تأكيد حذف البطاقة</Text>
                <Text style={styles.confirmSubtitle}>هل أنت متأكد من حذف هذه المفردة نهائياً؟</Text>
              </View>
            </View>

            {cardToDelete ? (
              <View style={styles.confirmPreviewBox}>
                <Text style={styles.confirmPreviewText} numberOfLines={3}>
                  "{cardToDelete.text}"
                </Text>
              </View>
            ) : null}

            {deleteError ? (
              <View style={styles.errorBox} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={16} color={palette.danger} />
                <Text style={styles.errorText}>{deleteError}</Text>
              </View>
            ) : null}

            <View style={styles.confirmActionsRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="تأكيد الحذف"
                accessibilityState={{ disabled: deleteSaving }}
                disabled={deleteSaving}
                onPress={() => void handleConfirmDelete()}
                style={[styles.confirmDeleteBtn, deleteSaving && styles.buttonDisabled]}
              >
                {deleteSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmDeleteBtnText}>نعم، حذف</Text>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="إلغاء الحذف"
                disabled={deleteSaving}
                onPress={() => setCardToDelete(null)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>إلغاء</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backPillText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  addCardButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D97706',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: '#D97706',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  addCardButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  titleSection: {
    alignItems: 'flex-end',
    gap: 4,
  },
  pageCategoryBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 2,
  },
  pageCategoryBadgeText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
  },
  screenMainTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  screenSubtitle: {
    fontSize: 14,
    color: palette.muted,
    textAlign: 'right',
    lineHeight: 20,
  },
  noticeBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  noticeText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
    flex: 1,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    gap: 16,
    shadowColor: '#78350F',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  heroHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitleGroup: {
    flex: 1,
    alignItems: 'flex-end',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'right',
  },
  heroIconBubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  statsSummaryRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  summaryLabel: {
    color: '#FEF3C7',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  typeStatsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeStatChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 100,
    flex: 1,
  },
  typeStatLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  typeStatCountBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeStatCount: {
    color: '#FEF3C7',
    fontSize: 13,
    fontWeight: '800',
  },
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderColor: '#EBF0F7',
    borderWidth: 1,
    padding: 18,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sectionBadgeText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
  },
  cardSectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  cardSectionDesc: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  formGroup: {
    gap: 6,
  },
  inputLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    right: 14,
    zIndex: 1,
  },
  textInputWithIcon: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingRight: 40,
    paddingVertical: 12,
    fontSize: 14,
    color: palette.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  countPickerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  countPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countPillActive: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  countPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.text,
  },
  countPillTextActive: {
    color: '#B45309',
    fontWeight: '800',
  },
  customCountInput: {
    width: 60,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    textAlign: 'center',
    fontSize: 14,
    color: palette.text,
    fontWeight: '700',
  },
  fetchButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 18,
    backgroundColor: '#D97706',
    shadowColor: '#D97706',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  fetchButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  inlineButtonContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  previewContainer: {
    marginTop: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 16,
  },
  previewHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewCountBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  previewCountText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
  },
  clearPreviewBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  clearPreviewBtnText: {
    color: palette.muted,
    fontSize: 13,
  },
  previewCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  previewCardTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeSecondary: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeSecondaryText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '700',
  },
  previewCardText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 24,
  },
  previewTranslationBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    gap: 4,
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  previewTranslationLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
  previewTranslationText: {
    color: palette.text,
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 18,
  },
  cardActionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonInnerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  actionPillButton: {
    minHeight: 40,
    backgroundColor: '#D97706',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionPillButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  savedPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  savedPillText: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 13,
  },
  filterSection: {
    marginTop: 4,
  },
  filterPillsContainer: {
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
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  filterPillSelected: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  filterPillText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  filterPillTextSelected: {
    color: '#FFFFFF',
  },
  filterPillBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  filterPillBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterPillBadgeText: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '800',
  },
  filterPillBadgeTextSelected: {
    color: '#FFFFFF',
  },
  searchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  searchFieldWrapper: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  searchFieldIcon: {
    position: 'absolute',
    right: 12,
    zIndex: 1,
  },
  searchInputClean: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingRight: 38,
    paddingLeft: 36,
    paddingVertical: 10,
    fontSize: 13,
    color: palette.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  searchInnerClear: {
    position: 'absolute',
    left: 10,
    zIndex: 1,
    padding: 4,
  },
  searchSubmitButton: {
    backgroundColor: '#D97706',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  searchSubmitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  cardsListContainer: {
    gap: 12,
  },
  cardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderColor: '#EBF0F7',
    borderWidth: 1,
    padding: 16,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardItemPressed: {
    opacity: 0.92,
  },
  cardHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typeBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  cardMetaGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  sourcePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourcePillText: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  cardDate: {
    color: palette.muted,
    fontSize: 11,
  },
  cardMainText: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 26,
  },
  cardTranslationBox: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  translationHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  cardTranslationLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  cardTranslationText: {
    color: palette.text,
    fontSize: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 22,
  },
  referenceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  cardRefText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  cardFooterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    marginTop: 2,
  },
  tapToEditHint: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  tapToEditHintText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  deleteSmallButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderColor: '#FEE2E2',
    borderWidth: 1,
    backgroundColor: '#FEF2F2',
  },
  deleteSmallButtonText: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  paginationCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderColor: '#EBF0F7',
    borderWidth: 1,
    padding: 12,
    marginTop: 4,
  },
  pageNavButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  pageNavButtonText: {
    color: palette.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  pageIndicatorContainer: {
    alignItems: 'center',
  },
  pageIndicatorText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  pageIndicatorSub: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 2,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  modalSubtitle: {
    fontSize: 13,
    color: palette.muted,
    marginTop: 2,
    textAlign: 'right',
  },
  modalCloseCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeSelectorRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeSelectorPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  typeSelectorPillSelected: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  typeSelectorPillText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  typeSelectorPillTextSelected: {
    color: '#FFFFFF',
  },
  cleanInput: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: palette.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  metaChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  dangerButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    marginTop: 6,
  },
  dangerButtonText: {
    color: palette.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  confirmCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 16,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  deleteHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  deleteWarningIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteHeaderText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  confirmTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  confirmSubtitle: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 2,
    textAlign: 'right',
  },
  confirmPreviewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  confirmPreviewText: {
    color: palette.text,
    fontSize: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  confirmActionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  confirmDeleteBtn: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: palette.danger,
  },
  confirmDeleteBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  cancelButtonText: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 14,
  },
  errorBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  errorText: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 18,
    flex: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
