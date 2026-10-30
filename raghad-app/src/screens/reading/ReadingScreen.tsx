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

export interface Book {
  _id: string;
  title: string;
  author?: string;
  level: number;
  status: 'locked' | 'unlocked' | 'completed' | string;
  pdfUrl?: string;
  bookmarkPage?: number;
  notes?: string;
  completedAt?: string | null;
}

export interface Note {
  _id: string;
  content: string;
  text?: string;
  page?: number;
  createdAt: string;
}

type FilterType = 'all' | 'unlocked' | 'completed' | 'locked';

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'الكل',
  unlocked: 'متاح للقراءة',
  completed: 'مكتملة ✓',
  locked: 'مقفل 🔒',
};

function formatReadingError(err: unknown): string {
  if (
    (err instanceof ApiClientError && err.code === 'LEVEL_LOCKED') ||
    (typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: unknown }).code === 'LEVEL_LOCKED')
  ) {
    return 'هذا الكتاب مقفل — أكمل الكتاب السابق أولاً';
  }
  const msg = getApiErrorMessage(err);
  if (msg.includes('LEVEL_LOCKED')) {
    return 'هذا الكتاب مقفل — أكمل الكتاب السابق أولاً';
  }
  return msg;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function mapNotes(rawNotes: unknown[]): Note[] {
  return rawNotes.map((item) => {
    const n = item as Record<string, unknown>;
    const content =
      typeof n.content === 'string'
        ? n.content
        : typeof n.text === 'string'
        ? n.text
        : '';
    return {
      _id: String(n._id ?? Math.random().toString()),
      content,
      text: typeof n.text === 'string' ? n.text : content,
      page: typeof n.page === 'number' ? n.page : undefined,
      createdAt:
        typeof n.createdAt === 'string' ? n.createdAt : new Date().toISOString(),
    };
  });
}

export function ReadingScreen() {
  const navigation = useNavigation();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [successToast, setSuccessToast] = useState<string>('');

  // Create Book Modal States
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newAuthor, setNewAuthor] = useState<string>('');
  const [newLevel, setNewLevel] = useState<string>('1');
  const [newPdfUrl, setNewPdfUrl] = useState<string>('');
  const [createError, setCreateError] = useState<string>('');
  const [savingCreate, setSavingCreate] = useState<boolean>(false);

  // Detail Modal States
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [bookmarkInput, setBookmarkInput] = useState<string>('1');
  const [savingBookmark, setSavingBookmark] = useState<boolean>(false);
  const [notesInput, setNotesInput] = useState<string>('');
  const [savingNotes, setSavingNotes] = useState<boolean>(false);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [bookNotes, setBookNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const [newNoteText, setNewNoteText] = useState<string>('');
  const [savingNewNote, setSavingNewNote] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string>('');

  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast('');
    }, 4000);
  };

  const loadBooks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = filter === 'all' ? undefined : { status: filter };
      const res = await api.getReadingBooks(params);
      let loadedBooks: Book[] = [];
      if (Array.isArray(res)) {
        loadedBooks = res as Book[];
      } else if (
        res &&
        typeof res === 'object' &&
        'items' in res &&
        Array.isArray((res as { items: unknown }).items)
      ) {
        loadedBooks = (res as { items: Book[] }).items;
      }
      loadedBooks.sort((a, b) => (a.level ?? 1) - (b.level ?? 1));
      setBooks(loadedBooks);
    } catch (err) {
      setError(formatReadingError(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void loadBooks();
    }, [loadBooks])
  );

  function openCreateModal() {
    setNewTitle('');
    setNewAuthor('');
    const nextLevel =
      books.length > 0 ? Math.max(...books.map((b) => b.level || 0)) + 1 : 1;
    setNewLevel(String(nextLevel));
    setNewPdfUrl('');
    setCreateError('');
    setCreateModalVisible(true);
  }

  async function handleCreateBook() {
    const title = newTitle.trim();
    if (!title) {
      setCreateError('عنوان الكتاب مطلوب.');
      return;
    }
    const levelNumber = parseInt(newLevel, 10);
    if (isNaN(levelNumber) || levelNumber < 1) {
      setCreateError('المستوى يجب أن يكون رقماً صحيحاً أكبر من أو يساوي 1.');
      return;
    }

    setSavingCreate(true);
    setCreateError('');
    try {
      await api.createReadingBook({
        title,
        author: newAuthor.trim() || undefined,
        level: levelNumber,
        pdfUrl: newPdfUrl.trim() || undefined,
      });
      setCreateModalVisible(false);
      showToast('تمت إضافة الكتاب بنجاح إلى مسار القراءة.');
      await loadBooks();
    } catch (err) {
      setCreateError(formatReadingError(err));
    } finally {
      setSavingCreate(false);
    }
  }

  async function openDetailModal(book: Book) {
    setSelectedBook(book);
    setBookmarkInput(String(book.bookmarkPage ?? 1));
    setNotesInput(book.notes ?? '');
    setDetailError('');
    setNewNoteText('');
    setBookNotes([]);
    setDetailModalVisible(true);

    setLoadingNotes(true);
    try {
      const notesRes = (await api.listReadingNotes(book._id)) as unknown[];
      if (Array.isArray(notesRes)) {
        setBookNotes(mapNotes(notesRes));
      }
    } catch (err) {
      setDetailError(formatReadingError(err));
    } finally {
      setLoadingNotes(false);
    }
  }

  async function handleSaveBookmark() {
    if (!selectedBook) return;
    const pageNumber = parseInt(bookmarkInput, 10);
    if (isNaN(pageNumber) || pageNumber < 1) {
      setDetailError('رقم صفحة التوقف يجب أن يكون عدداً صحيحاً أكبر من 0.');
      return;
    }
    setSavingBookmark(true);
    setDetailError('');
    try {
      await api.updateReadingBook(selectedBook._id, { bookmarkPage: pageNumber });
      setSelectedBook((prev) =>
        prev ? { ...prev, bookmarkPage: pageNumber } : null
      );
      setBooks((prev) =>
        prev.map((b) =>
          b._id === selectedBook._id ? { ...b, bookmarkPage: pageNumber } : b
        )
      );
      showToast('تم تحديث صفحة التوقف بنجاح.');
    } catch (err) {
      setDetailError(formatReadingError(err));
    } finally {
      setSavingBookmark(false);
    }
  }

  async function handleSaveNotes() {
    if (!selectedBook) return;
    setSavingNotes(true);
    setDetailError('');
    try {
      await api.updateReadingBook(selectedBook._id, { notes: notesInput });
      setSelectedBook((prev) =>
        prev ? { ...prev, notes: notesInput } : null
      );
      setBooks((prev) =>
        prev.map((b) =>
          b._id === selectedBook._id ? { ...b, notes: notesInput } : b
        )
      );
      showToast('تم حفظ ملاحظات الكتاب بنجاح.');
    } catch (err) {
      setDetailError(formatReadingError(err));
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleToggleStatus() {
    if (!selectedBook) return;
    const nextStatus =
      selectedBook.status === 'completed' ? 'unlocked' : 'completed';
    setUpdatingStatus(true);
    setDetailError('');
    try {
      await api.updateReadingBook(selectedBook._id, { status: nextStatus });
      setSelectedBook((prev) =>
        prev ? { ...prev, status: nextStatus } : null
      );
      setBooks((prev) =>
        prev.map((b) =>
          b._id === selectedBook._id ? { ...b, status: nextStatus } : b
        )
      );
      showToast(
        nextStatus === 'completed'
          ? 'تهانينا! تم إكمال الكتاب بنجاح.'
          : 'تم تغيير حالة الكتاب إلى متاح.'
      );
      void loadBooks();
    } catch (err) {
      setDetailError(formatReadingError(err));
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleCreateNote() {
    if (!selectedBook) return;
    const content = newNoteText.trim();
    if (!content) {
      setDetailError('يرجى كتابة نص الملاحظة.');
      return;
    }

    setSavingNewNote(true);
    setDetailError('');
    try {
      await api.createReadingNote(selectedBook._id, {
        text: content,
        content,
      });
      const updatedNotes = (await api.listReadingNotes(
        selectedBook._id
      )) as unknown[];
      if (Array.isArray(updatedNotes)) {
        setBookNotes(mapNotes(updatedNotes));
      }
      setNewNoteText('');
      showToast('تمت إضافة الملاحظة بنجاح.');
    } catch (err) {
      setDetailError(formatReadingError(err));
    } finally {
      setSavingNewNote(false);
    }
  }

  // Calculate statistics for Hero banner
  const totalBooks = books.length;
  const completedBooks = books.filter((b) => b.status === 'completed').length;
  const unlockedBooks = books.filter((b) => b.status === 'unlocked').length;
  const completionPercent = totalBooks > 0 ? Math.round((completedBooks / totalBooks) * 100) : 0;

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.pageCategoryBadge}>العادات الخاصة</Text>
            <Text style={styles.pageTitle}>القراءة والمطالعة</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="إضافة كتاب جديد"
              onPress={openCreateModal}
              style={({ pressed }) => [styles.addBookBtn, pressed && styles.btnPressed]}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addBookBtnText}>إضافة كتاب</Text>
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

        {/* Hero Progress Banner */}
        <LinearGradient
          colors={['#0F766E', '#0D9488', '#14B8A6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <View style={styles.circleProgressTrack}>
              <Text style={styles.circleProgressText}>{completionPercent}%</Text>
            </View>
            <View style={styles.heroTexts}>
              <Text style={styles.heroTitle}>مسار القراءة والكتب</Text>
              <Text style={styles.heroSubtitle}>
                {completedBooks} من {totalBooks} كتاب مُنجز في رحلتك
              </Text>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatBox}>
              <Ionicons name="book-outline" size={20} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{totalBooks}</Text>
              <Text style={styles.heroStatLabel}>إجمالي الكتب</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Ionicons name="checkmark-done-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{completedBooks}</Text>
              <Text style={styles.heroStatLabel}>المنجز</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Ionicons name="bookmarks-outline" size={20} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{unlockedBooks}</Text>
              <Text style={styles.heroStatLabel}>متاح حالياً</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Filter Pills Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsRow}
        >
          {(['all', 'unlocked', 'completed', 'locked'] as FilterType[]).map((statusKey) => {
            const isSelected = filter === statusKey;
            return (
              <Pressable
                key={statusKey}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setFilter(statusKey)}
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
                  {FILTER_LABELS[statusKey]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Success Alert Banner */}
        {successToast ? (
          <View style={styles.alertSuccess} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.alertSuccessText}>{successToast}</Text>
          </View>
        ) : null}

        {/* Error Alert Banner */}
        {error && !loading ? (
          <View style={styles.alertError} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={styles.alertErrorText}>{error}</Text>
          </View>
        ) : null}

        {/* Loading State */}
        {loading && books.length === 0 ? (
          <LoadingState label="جارٍ تحميل مكتبة الكتب..." />
        ) : null}

        {/* Empty State */}
        {!loading && !error && books.length === 0 ? (
          <ScreenState
            title="لا توجد كتب بعد"
            message={
              filter === 'all'
                ? 'ابدأ بإضافة أول كتاب في مسار القراءة الخاص بك.'
                : 'لا توجد كتب بهذه الحالة في الوقت الحالي.'
            }
            actionLabel="إضافة كتاب جديد"
            onAction={openCreateModal}
          />
        ) : null}

        {/* Books List */}
        {books.map((book) => {
          const isLocked = book.status === 'locked';
          const isCompleted = book.status === 'completed';

          return isLocked ? (
            <View key={book._id} style={[styles.bookCard, styles.lockedCard]}>
              <View style={styles.cardHeader}>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle}>{book.title}</Text>
                  {book.author ? (
                    <Text style={styles.bookAuthor}>المؤلف: {book.author}</Text>
                  ) : null}
                </View>
                <View style={styles.badgeLocked}>
                  <Ionicons name="lock-closed" size={13} color="#64748B" />
                  <Text style={styles.badgeLockedText}>مقفل</Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>المستوى {book.level}</Text>
                </View>
                <Text style={styles.lockedNotice}>
                  أكمل الكتاب السابق أولاً لفتح هذا المستوى
                </Text>
              </View>
            </View>
          ) : (
            <Pressable
              key={book._id}
              accessibilityRole="button"
              accessibilityLabel={`كتاب ${book.title}`}
              onPress={() => void openDetailModal(book)}
              style={({ pressed }) => [
                styles.bookCard,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle}>{book.title}</Text>
                  {book.author ? (
                    <Text style={styles.bookAuthor}>المؤلف: {book.author}</Text>
                  ) : null}
                </View>

                <View
                  style={
                    isCompleted
                      ? styles.badgeCompleted
                      : styles.badgeUnlocked
                  }
                >
                  <Ionicons
                    name={isCompleted ? 'checkmark-circle' : 'book-outline'}
                    size={13}
                    color={isCompleted ? '#059669' : '#2563EB'}
                  />
                  <Text
                    style={
                      isCompleted
                        ? styles.badgeCompletedText
                        : styles.badgeUnlockedText
                    }
                  >
                    {isCompleted ? 'مكتمل ✓' : 'متاح'}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.metaRow}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>المستوى {book.level}</Text>
                  </View>
                  <View style={styles.bookmarkBadge}>
                    <Ionicons name="bookmark-outline" size={13} color="#0D9488" />
                    <Text style={styles.bookmarkBadgeText}>
                      ص {book.bookmarkPage ?? 1}
                    </Text>
                  </View>
                </View>

                <View style={styles.tapPromptRow}>
                  <Text style={styles.tapPrompt}>التفاصيل والملاحظات</Text>
                  <Ionicons name="chevron-back" size={16} color={palette.primary} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.dialogScroll}>
            <View style={styles.dialog}>
              {/* Modal Header */}
              <View style={styles.dialogHeader}>
                <View style={styles.dialogTitleGroup}>
                  <Text style={styles.dialogTitle}>
                    {selectedBook?.title ?? 'تفاصيل الكتاب'}
                  </Text>
                  {selectedBook?.author ? (
                    <Text style={styles.dialogAuthor}>
                      المؤلف: {selectedBook.author}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="إغلاق"
                  onPress={() => setDetailModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

              {/* Status and Level Row */}
              <View style={styles.badgesRow}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>
                    المستوى {selectedBook?.level}
                  </Text>
                </View>
                <View
                  style={
                    selectedBook?.status === 'completed'
                      ? styles.badgeCompleted
                      : styles.badgeUnlocked
                  }
                >
                  <Ionicons
                    name={selectedBook?.status === 'completed' ? 'checkmark-circle' : 'book-outline'}
                    size={14}
                    color={selectedBook?.status === 'completed' ? '#059669' : '#2563EB'}
                  />
                  <Text
                    style={
                      selectedBook?.status === 'completed'
                        ? styles.badgeCompletedText
                        : styles.badgeUnlockedText
                    }
                  >
                    {selectedBook?.status === 'completed' ? 'مكتمل ✓' : 'متاح للتصفح'}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  disabled={updatingStatus}
                  onPress={() => void handleToggleStatus()}
                  style={[
                    styles.statusToggleBtn,
                    updatingStatus && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.statusToggleText}>
                    {updatingStatus
                      ? 'جارٍ التحديث...'
                      : selectedBook?.status === 'completed'
                      ? 'إعادة فتحه'
                      : 'تعيين كمكتمل ✓'}
                  </Text>
                </Pressable>
              </View>

              {/* PDF URL Display */}
              {selectedBook?.pdfUrl ? (
                <View style={styles.sectionBox}>
                  <Text style={styles.sectionLabel}>رابط الكتاب / الملف</Text>
                  <Text selectable style={styles.pdfUrlText}>
                    {selectedBook.pdfUrl}
                  </Text>
                </View>
              ) : null}

              {/* Bookmark Section */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionLabel}>صفحة التوقف الحالية</Text>
                <View style={styles.bookmarkRow}>
                  <TextInput
                    accessibilityLabel="رقم صفحة التوقف"
                    keyboardType="number-pad"
                    value={bookmarkInput}
                    onChangeText={setBookmarkInput}
                    style={styles.bookmarkInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={savingBookmark}
                    onPress={() => void handleSaveBookmark()}
                    style={[
                      styles.actionSaveBtn,
                      savingBookmark && styles.buttonDisabled,
                    ]}
                  >
                    <Text style={styles.actionSaveBtnText}>
                      {savingBookmark ? 'جارٍ الحفظ...' : 'حفظ الصفحة'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Summary Notes Section */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionLabel}>ملاحظات وخلاصة الكتاب</Text>
                <TextInput
                  accessibilityLabel="ملاحظات الكتاب"
                  multiline
                  placeholder="اكتب خلاصة، فوائد، أو اقتباسات من الكتاب..."
                  placeholderTextColor={palette.muted}
                  value={notesInput}
                  onChangeText={setNotesInput}
                  style={styles.notesTextArea}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={savingNotes}
                  onPress={() => void handleSaveNotes()}
                  style={[
                    styles.actionSaveBtnFull,
                    savingNotes && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.actionSaveBtnText}>
                    {savingNotes ? 'جارٍ الحفظ...' : 'حفظ الخلاصة'}
                  </Text>
                </Pressable>
              </View>

              {/* Quotes & Lessons Sub-notes */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionLabel}>
                  المقتطفات والفوائد المستفادة ({bookNotes.length})
                </Text>
                {loadingNotes ? (
                  <LoadingState label="جارٍ تحميل الملاحظات..." />
                ) : null}

                {bookNotes.map((note) => (
                  <View key={note._id} style={styles.quoteCard}>
                    <Text style={styles.quoteText}>{note.content || note.text}</Text>
                    <Text style={styles.quoteDate}>{formatDate(note.createdAt)}</Text>
                  </View>
                ))}

                <View style={styles.addNoteRow}>
                  <TextInput
                    accessibilityLabel="فائدة جديدة"
                    placeholder="أضف فائدة أو اقتباساً جديداً..."
                    placeholderTextColor={palette.muted}
                    value={newNoteText}
                    onChangeText={setNewNoteText}
                    style={styles.addNoteInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={savingNewNote}
                    onPress={() => void handleCreateNote()}
                    style={[
                      styles.addNoteBtn,
                      savingNewNote && styles.buttonDisabled,
                    ]}
                  >
                    <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>

              {detailError ? (
                <View style={styles.alertError} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.alertErrorText}>{detailError}</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Create Modal */}
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
                <Text style={styles.dialogTitle}>إضافة كتاب جديد للمسار</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCreateModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>عنوان الكتاب *</Text>
                <TextInput
                  accessibilityLabel="عنوان الكتاب"
                  placeholder="مثال: من صفر إلى واحد"
                  placeholderTextColor={palette.muted}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  style={commonStyles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>المؤلف (اختياري)</Text>
                <TextInput
                  accessibilityLabel="اسم المؤلف"
                  placeholder="مثال: بيتر ثيل"
                  placeholderTextColor={palette.muted}
                  value={newAuthor}
                  onChangeText={setNewAuthor}
                  style={commonStyles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>المستوى التسلسلي</Text>
                <TextInput
                  accessibilityLabel="مستوى الكتاب"
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={palette.muted}
                  value={newLevel}
                  onChangeText={setNewLevel}
                  style={commonStyles.input}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>رابط الكتاب / PDF (اختياري)</Text>
                <TextInput
                  accessibilityLabel="رابط الكتاب"
                  placeholder="https://..."
                  placeholderTextColor={palette.muted}
                  value={newPdfUrl}
                  onChangeText={setNewPdfUrl}
                  style={commonStyles.input}
                />
              </View>

              {createError ? (
                <View style={styles.alertError} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={styles.alertErrorText}>{createError}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label={savingCreate ? 'جارٍ إضافة الكتاب...' : 'إضافة الكتاب للمسار'}
                disabled={savingCreate}
                onPress={() => void handleCreateBook()}
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
    color: '#0D9488',
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
  addBookBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0D9488',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  addBookBtnText: {
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
    shadowColor: '#0D9488',
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
  circleProgressText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
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
    color: 'rgba(255, 255, 255, 0.9)',
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  filterPillSelected: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
  },
  filterPillTextSelected: {
    color: '#FFFFFF',
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
  bookCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  lockedCard: {
    backgroundColor: '#F8FAFC',
    opacity: 0.85,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    borderColor: '#0D9488',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  bookInfo: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  bookTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  bookAuthor: {
    fontSize: 13,
    color: palette.muted,
    textAlign: 'right',
  },
  badgeCompleted: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeCompletedText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeUnlocked: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeUnlockedText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeLocked: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeLockedText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  levelBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.text,
  },
  bookmarkBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    borderColor: '#CCFBF1',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bookmarkBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D9488',
  },
  lockedNotice: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: '600',
  },
  tapPromptRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
  },
  tapPrompt: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.primary,
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
    maxWidth: 580,
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
  dialogTitleGroup: {
    flex: 1,
    alignItems: 'flex-end',
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  dialogAuthor: {
    fontSize: 13,
    color: palette.muted,
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
  badgesRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0D9488',
    backgroundColor: '#F0FDFA',
  },
  statusToggleText: {
    color: '#0D9488',
    fontWeight: '700',
    fontSize: 13,
  },
  sectionBox: {
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  pdfUrlText: {
    color: palette.primary,
    fontSize: 13,
    textAlign: 'right',
    textDecorationLine: 'underline',
  },
  bookmarkRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  bookmarkInput: {
    minHeight: 46,
    width: 90,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
    backgroundColor: '#FFFFFF',
  },
  actionSaveBtn: {
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#0D9488',
    paddingHorizontal: 18,
  },
  actionSaveBtnFull: {
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#0D9488',
    paddingHorizontal: 18,
    width: '100%',
  },
  actionSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  notesTextArea: {
    minHeight: 90,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    textAlign: 'right',
    textAlignVertical: 'top',
    fontSize: 14,
    color: palette.text,
    backgroundColor: '#F8FAFC',
  },
  quoteCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  quoteText: {
    color: palette.text,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
  },
  quoteDate: {
    color: palette.muted,
    fontSize: 11,
    textAlign: 'right',
  },
  addNoteRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  addNoteInput: {
    flex: 1,
    minHeight: 44,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    textAlign: 'right',
    backgroundColor: '#FFFFFF',
    fontSize: 14,
  },
  addNoteBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
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
  buttonDisabled: {
    opacity: 0.5,
  },
});
