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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
import { getApiErrorMessage } from '../../utils/apiError';
import { goBackSafe } from '../../utils/goBackSafe';

export interface MoneyEntry {
  _id: string;
  amount: number;
  source: string;
  note?: string;
  date: string;
}

export interface MoneySummary {
  total: number;
  bySource: { source: string; total: number }[];
  byMonth: { month: string; total: number }[];
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const dateObj = new Date(dateStr);
  if (Number.isNaN(dateObj.getTime())) {
    return dateStr.slice(0, 10);
  }
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatAmount(value: number): string {
  return Number(value || 0).toLocaleString('ar-MR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export function MoneyScreen() {
  const navigation = useNavigation();

  // Data states
  const [entries, setEntries] = useState<MoneyEntry[]>([]);
  const [summary, setSummary] = useState<MoneySummary | null>(null);
  const [page, setPage] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Summary collapse states
  const [showAllSources, setShowAllSources] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter input states
  const [filterSource, setFilterSource] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Applied filter states
  const [appliedFilters, setAppliedFilters] = useState<{
    source: string;
    from: string;
    to: string;
  }>({
    source: '',
    from: '',
    to: '',
  });

  // Create Modal state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newDate, setNewDate] = useState(getTodayString());

  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast('');
    }, 4000);
  };

  const loadData = useCallback(async (targetPage = 1, currentFilters = appliedFilters) => {
    setLoading(true);
    setError('');
    try {
      const summaryRes = (await api.getMoneySummary().catch(() => null)) as {
        total?: number;
        bySource?: { source?: string; total?: number }[];
        byMonth?: { month?: string; total?: number }[];
      } | null;
      if (summaryRes) {
        setSummary({
          total: Number(summaryRes.total ?? 0),
          bySource: Array.isArray(summaryRes.bySource)
            ? summaryRes.bySource.map((s: { source?: string; total?: number }) => ({
                source: String(s.source ?? 'عام'),
                total: Number(s.total ?? 0),
              }))
            : [],
          byMonth: Array.isArray(summaryRes.byMonth)
            ? summaryRes.byMonth.map((m: { month?: string; total?: number }) => ({
                month: String(m.month ?? ''),
                total: Number(m.total ?? 0),
              }))
            : [],
        });
      }

      const params: Record<string, string | number> = {
        page: targetPage,
        limit: 20,
      };
      if (currentFilters.source.trim()) params.source = currentFilters.source.trim();
      if (currentFilters.from.trim()) params.from = currentFilters.from.trim();
      if (currentFilters.to.trim()) params.to = currentFilters.to.trim();

      const entriesRes = await api.listMoneyEntries(params);
      let items: MoneyEntry[] = [];
      let totalCount = 0;

      if (Array.isArray(entriesRes)) {
        items = entriesRes as MoneyEntry[];
        totalCount = items.length;
      } else if (entriesRes && typeof entriesRes === 'object') {
        const obj = entriesRes as { items?: MoneyEntry[]; total?: number; meta?: { total?: number } };
        items = Array.isArray(obj.items) ? obj.items : [];
        totalCount = typeof obj.total === 'number' ? obj.total : typeof obj.meta?.total === 'number' ? obj.meta.total : items.length;
      }

      setEntries(items);
      setTotalEntries(totalCount);
      setPage(targetPage);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useFocusEffect(
    useCallback(() => {
      void loadData(1, appliedFilters);
    }, [loadData, appliedFilters])
  );

  function applyFilters() {
    const updated = {
      source: filterSource.trim(),
      from: filterFrom.trim(),
      to: filterTo.trim(),
    };
    setAppliedFilters(updated);
    void loadData(1, updated);
  }

  function resetFilters() {
    setFilterSource('');
    setFilterFrom('');
    setFilterTo('');
    const empty = { source: '', from: '', to: '' };
    setAppliedFilters(empty);
    void loadData(1, empty);
  }

  function openCreateModal() {
    setNewAmount('');
    setNewSource('');
    setNewNote('');
    setNewDate(getTodayString());
    setCreateError('');
    setCreateModalVisible(true);
  }

  async function handleCreateEntry() {
    const amountNum = parseFloat(newAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setCreateError('المبلغ يجب أن يكون رقماً أكبر من صفر.');
      return;
    }
    if (!newSource.trim()) {
      setCreateError('يرجى تحديد مصدر المال.');
      return;
    }
    if (!newDate.trim()) {
      setCreateError('يرجى إدخال تاريخ الإدخال.');
      return;
    }

    setCreating(true);
    setCreateError('');
    try {
      await api.createMoneyEntry({
        amount: amountNum,
        source: newSource.trim(),
        note: newNote.trim() || undefined,
        date: newDate.trim(),
      });
      setCreateModalVisible(false);
      showToast('تمت إضافة الإدخال المالي بنجاح.');
      await loadData(1, appliedFilters);
    } catch (err) {
      setCreateError(getApiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  const sourcesList = summary?.bySource ?? [];
  const displayedSources = showAllSources ? sourcesList : sourcesList.slice(0, 3);

  const monthsList = summary?.byMonth ?? [];
  const displayedMonths = showAllMonths ? monthsList : monthsList.slice(0, 3);

  const hasActiveFilters = Boolean(
    appliedFilters.source || appliedFilters.from || appliedFilters.to
  );

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.pageCategoryBadge}>العادات المالية</Text>
            <Text style={styles.pageTitle}>صندوق المال والادخار</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={openCreateModal}
              style={({ pressed }) => [styles.addBtn, pressed && styles.btnPressed]}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addBtnText}>إضافة إدخال</Text>
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

        {/* Success Toast Banner */}
        {successToast ? (
          <View style={styles.alertSuccess} accessibilityRole="alert">
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={styles.alertSuccessText}>{successToast}</Text>
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
        {summary ? (
          <LinearGradient
            colors={['#047857', '#059669', '#10B981']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTop}>
              <View style={styles.circleProgressTrack}>
                <Ionicons name="wallet" size={28} color="#FFFFFF" />
              </View>
              <View style={styles.heroTexts}>
                <Text style={styles.heroTitle}>الإجمالي المدخر</Text>
                <Text style={styles.heroBalanceText}>{formatAmount(summary.total)} أوقية</Text>
              </View>
            </View>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatBox}>
                <Ionicons name="receipt-outline" size={18} color="#FFFFFF" />
                <Text style={styles.heroStatNum}>{totalEntries}</Text>
                <Text style={styles.heroStatLabel}>إجمالي الإدخالات</Text>
              </View>
              <View style={styles.heroStatBox}>
                <Ionicons name="layers-outline" size={18} color="#FFFFFF" />
                <Text style={styles.heroStatNum}>{sourcesList.length}</Text>
                <Text style={styles.heroStatLabel}>المصادر</Text>
              </View>
              <View style={styles.heroStatBox}>
                <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
                <Text style={styles.heroStatNum}>{monthsList.length}</Text>
                <Text style={styles.heroStatLabel}>الأشهر النشطة</Text>
              </View>
            </View>
          </LinearGradient>
        ) : null}

        {/* Breakdown Card: Sources and Months */}
        {summary && (sourcesList.length > 0 || monthsList.length > 0) ? (
          <View style={styles.breakdownCard}>
            {/* By Source */}
            <View style={styles.breakdownSection}>
              <View style={styles.breakdownHeaderRow}>
                <Text style={styles.breakdownTitle}>توزيع المدخرات حسب المصدر</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{sourcesList.length} مصادر</Text>
                </View>
              </View>

              <View style={styles.itemsList}>
                {displayedSources.map((item, idx) => {
                  const percent = summary.total > 0 ? Math.round((item.total / summary.total) * 100) : 0;
                  return (
                    <View key={`src-${item.source}-${idx}`} style={styles.sourceRow}>
                      <View style={styles.sourceLabelRow}>
                        <Text style={styles.sourceName}>{item.source}</Text>
                        <Text style={styles.sourceAmount}>{formatAmount(item.total)} أوقية ({percent}%)</Text>
                      </View>
                      <View style={styles.progressBarTrack}>
                        <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                      </View>
                    </View>
                  );
                })}

                {sourcesList.length > 3 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowAllSources((prev) => !prev)}
                    style={styles.expandBtn}
                  >
                    <Text style={styles.expandBtnText}>
                      {showAllSources ? 'عرض أقل ▲' : `عرض المزيد (+${sourcesList.length - 3}) ▼`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.divider} />

            {/* By Month */}
            <View style={styles.breakdownSection}>
              <View style={styles.breakdownHeaderRow}>
                <Text style={styles.breakdownTitle}>حسب الشهر</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{monthsList.length} أشهر</Text>
                </View>
              </View>

              <View style={styles.itemsList}>
                {displayedMonths.map((item, idx) => (
                  <View key={`m-${item.month}-${idx}`} style={styles.monthRow}>
                    <View style={styles.monthBadge}>
                      <Ionicons name="calendar-outline" size={13} color="#059669" />
                      <Text style={styles.monthBadgeText}>{item.month || 'غير محدد'}</Text>
                    </View>
                    <Text style={styles.monthAmount}>{formatAmount(item.total)} أوقية</Text>
                  </View>
                ))}

                {monthsList.length > 3 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowAllMonths((prev) => !prev)}
                    style={styles.expandBtn}
                  >
                    <Text style={styles.expandBtnText}>
                      {showAllMonths ? 'عرض أقل ▲' : `عرض المزيد (+${monthsList.length - 3}) ▼`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Section Header: قائمة الإدخالات + تصفية Toggle */}
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleGroup}>
            <Text style={styles.sectionTitle}>قائمة الإدخالات</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{totalEntries} إدخال</Text>
            </View>
          </View>

          <Pressable
            onPress={() => setShowFilters(!showFilters)}
            style={[styles.filterToggleBtn, (showFilters || hasActiveFilters) && styles.filterToggleBtnActive]}
          >
            <Ionicons
              name="options-outline"
              size={17}
              color={showFilters || hasActiveFilters ? palette.primary : palette.muted}
            />
            <Text style={[styles.filterToggleBtnText, (showFilters || hasActiveFilters) && styles.filterToggleBtnTextActive]}>
              تصفية
            </Text>
          </Pressable>
        </View>

        {/* Collapsible Filter Card */}
        {showFilters ? (
          <View style={styles.filtersCard}>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>المصدر</Text>
              <TextInput
                style={commonStyles.input}
                placeholder="ابحث حسب المصدر (مثال: راتب، منحة...)"
                placeholderTextColor={palette.muted}
                value={filterSource}
                onChangeText={setFilterSource}
              />
            </View>

            <View style={styles.dateRow}>
              <View style={[styles.filterField, { flex: 1 }]}>
                <Text style={styles.filterLabel}>من تاريخ</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={palette.muted}
                  value={filterFrom}
                  onChangeText={setFilterFrom}
                />
              </View>
              <View style={[styles.filterField, { flex: 1 }]}>
                <Text style={styles.filterLabel}>إلى تاريخ</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={palette.muted}
                  value={filterTo}
                  onChangeText={setFilterTo}
                />
              </View>
            </View>

            <View style={styles.filterActionsRow}>
              <Pressable onPress={applyFilters} style={styles.applyBtn}>
                <Text style={styles.applyBtnText}>تطبيق التصفية</Text>
              </Pressable>
              {hasActiveFilters ? (
                <Pressable onPress={resetFilters} style={styles.resetBtn}>
                  <Text style={styles.resetBtnText}>إلغاء التصفية</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Loading State */}
        {loading && entries.length === 0 ? (
          <LoadingState label="جارٍ تحميل سجل الإدخالات..." />
        ) : null}

        {/* Empty State */}
        {!loading && entries.length === 0 ? (
          <ScreenState
            title="لا توجد إدخالات بعد"
            message={
              hasActiveFilters
                ? 'لا توجد إدخالات تطابق شروط التصفية.'
                : 'أضف أول إدخال مالي لتبدأ ببناء صندوق ادخارك.'
            }
            actionLabel="إضافة إدخال الآن"
            onAction={openCreateModal}
          />
        ) : null}

        {/* Entries List */}
        {entries.map((entry) => (
          <View key={entry._id} style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <View style={styles.entryIconBox}>
                <Ionicons name="cash-outline" size={20} color="#059669" />
              </View>

              <View style={styles.entryInfo}>
                <View style={styles.entryAmountRow}>
                  <Text style={styles.entryAmount}>+ {formatAmount(entry.amount)} أوقية</Text>
                  <View style={styles.sourceTag}>
                    <Text style={styles.sourceTagText}>{entry.source}</Text>
                  </View>
                </View>

                <View style={styles.entryDateRow}>
                  <Ionicons name="calendar-outline" size={12} color={palette.muted} />
                  <Text style={styles.entryDateText}>{formatDateDisplay(entry.date)}</Text>
                </View>
              </View>
            </View>

            {entry.note ? (
              <View style={styles.entryNoteBox}>
                <Text style={styles.entryNoteText}>{entry.note}</Text>
              </View>
            ) : null}
          </View>
        ))}

        {/* Pagination */}
        {totalEntries > 20 ? (
          <View style={styles.paginationRow}>
            <Pressable
              disabled={page <= 1}
              onPress={() => void loadData(page - 1, appliedFilters)}
              style={[styles.pageBtn, page <= 1 && styles.btnDisabled]}
            >
              <Text style={styles.pageBtnText}>الصفحة السابقة</Text>
            </Pressable>
            <Text style={styles.pageIndicator}>صفحة {page}</Text>
            <Pressable
              disabled={entries.length < 20}
              onPress={() => void loadData(page + 1, appliedFilters)}
              style={[styles.pageBtn, entries.length < 20 && styles.btnDisabled]}
            >
              <Text style={styles.pageBtnText}>الصفحة التالية</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* Create Entry Modal */}
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
                <Text style={styles.dialogTitle}>إضافة إدخال مالي جديد</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCreateModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>المبلغ (أوقية) *</Text>
                <TextInput
                  style={commonStyles.input}
                  keyboardType="numeric"
                  placeholder="مثال: 500"
                  placeholderTextColor={palette.muted}
                  value={newAmount}
                  onChangeText={setNewAmount}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>المصدر *</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="مثال: الراتب، منحة، مشروع حر..."
                  placeholderTextColor={palette.muted}
                  value={newSource}
                  onChangeText={setNewSource}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>التاريخ (YYYY-MM-DD) *</Text>
                <TextInput
                  style={commonStyles.input}
                  value={newDate}
                  onChangeText={setNewDate}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ملاحظة توضيحية (اختياري)</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="أي تفاصيل حول هذا الإدخال..."
                  placeholderTextColor={palette.muted}
                  value={newNote}
                  onChangeText={setNewNote}
                />
              </View>

              {createError ? (
                <View style={styles.alertError} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={15} color="#EF4444" />
                  <Text style={styles.alertErrorText}>{createError}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label={creating ? 'جارٍ الحفظ...' : 'حفظ الإدخال'}
                disabled={creating}
                onPress={() => void handleCreateEntry()}
              />
            </View>
          </ScrollView>
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
    color: '#059669',
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
    backgroundColor: '#059669',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#059669',
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
    shadowColor: '#047857',
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
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  heroBalanceText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
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
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  breakdownSection: {
    gap: 10,
  },
  breakdownHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
  },
  countBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.primary,
  },
  itemsList: {
    gap: 10,
  },
  sourceRow: {
    gap: 4,
  },
  sourceLabelRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceName: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  sourceAmount: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 3,
  },
  monthRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  monthBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  monthBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  monthAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  expandBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  expandBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  sectionHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  sectionTitleGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: palette.text,
  },
  filterToggleBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterToggleBtnActive: {
    borderColor: palette.primary,
    backgroundColor: '#EFF6FF',
  },
  filterToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
  },
  filterToggleBtnTextActive: {
    color: palette.primary,
  },
  filtersCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  filterField: {
    gap: 4,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'right',
  },
  dateRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  filterActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 4,
  },
  applyBtn: {
    flex: 1,
    backgroundColor: palette.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  resetBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetBtnText: {
    color: palette.text,
    fontWeight: '600',
    fontSize: 13,
  },
  entryCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  entryHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  entryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryInfo: {
    flex: 1,
    gap: 4,
  },
  entryAmountRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  sourceTag: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourceTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: palette.text,
  },
  entryDateRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  entryDateText: {
    fontSize: 12,
    color: palette.muted,
  },
  entryNoteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
  },
  entryNoteText: {
    fontSize: 12,
    color: palette.muted,
    textAlign: 'right',
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
    maxWidth: 520,
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
  btnDisabled: {
    opacity: 0.5,
  },
});
