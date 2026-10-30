import { useCallback, useMemo, useState } from 'react';
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

export interface StudentLesson {
  _id: string;
  title: string;
  status: 'pending' | 'done';
}

export interface StudentExercise {
  _id: string;
  title?: string;
  description?: string;
  done?: boolean;
}

export interface Student {
  _id: string;
  name: string;
  group?: string;
  lessons?: StudentLesson[];
  exercises?: StudentExercise[];
  photos?: string[];
}

export interface Session {
  _id: string;
  studentId: string;
  date: string;
  durationMinutes: number;
  note?: string;
  status: 'scheduled' | 'done' | 'deferred';
}

type TabKey = 'students' | 'sessions';
type SessionStatusFilter = 'all' | 'scheduled' | 'done' | 'deferred';

const todayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function formatDisplayDate(value: string): string {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('ar-MR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

function formatGroupName(group?: string): string {
  if (!group) return 'عام';
  if (group === 'senior') return 'كبار';
  if (group === 'junior') return 'صغار';
  return group;
}

function getSessionEffectiveStatus(session: Session): 'scheduled' | 'done' | 'deferred' {
  if (session.status === 'deferred') return 'deferred';
  if (session.status === 'scheduled') return 'scheduled';
  try {
    const sessionTime = new Date(session.date).getTime();
    if (!Number.isNaN(sessionTime) && sessionTime > Date.now()) {
      return 'scheduled';
    }
  } catch {
    // fallback
  }
  return session.status === 'done' ? 'done' : 'scheduled';
}

export function BrotherhoodScreen() {
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<TabKey>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Student tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [createStudentModalVisible, setCreateStudentModalVisible] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGroup, setNewStudentGroup] = useState<'senior' | 'junior' | string>('senior');
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [studentFormError, setStudentFormError] = useState('');

  // Selected Student Detail state
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentDetailLoading, setStudentDetailLoading] = useState(false);
  const [studentDetailError, setStudentDetailError] = useState('');
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGroup, setEditGroup] = useState<'senior' | 'junior' | string>('senior');
  const [savingEdit, setSavingEdit] = useState(false);

  // Lesson state
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [addingLesson, setAddingLesson] = useState(false);
  const [lessonError, setLessonError] = useState('');

  // Exercise state
  const [newExerciseDescription, setNewExerciseDescription] = useState('');
  const [addingExercise, setAddingExercise] = useState(false);
  const [exerciseError, setExerciseError] = useState('');

  // Delete student confirmation
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);

  // Sessions tab state
  const [sessionStatusFilter, setSessionStatusFilter] = useState<SessionStatusFilter>('all');
  const [createSessionModalVisible, setCreateSessionModalVisible] = useState(false);
  const [newSessionStudentId, setNewSessionStudentId] = useState('');
  const [newSessionDate, setNewSessionDate] = useState(todayDateString());
  const [newSessionDuration, setNewSessionDuration] = useState('60');
  const [newSessionNote, setNewSessionNote] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionFormError, setSessionFormError] = useState('');
  const [deferringSessionId, setDeferringSessionId] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rawStudents, rawSessions] = await Promise.all([
        api.listBrotherhoodStudents(),
        api.listBrotherhoodSessions(),
      ]);

      const parsedStudents: Student[] = Array.isArray(rawStudents)
        ? (rawStudents as Student[])
        : ((rawStudents as { items?: Student[] })?.items ?? []);

      const parsedSessions: Session[] = Array.isArray(rawSessions)
        ? (rawSessions as Session[])
        : ((rawSessions as { items?: Session[] })?.items ?? []);

      setStudents(parsedStudents);
      setSessions(parsedSessions);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const studentsMap = useMemo(() => {
    const map = new Map<string, Student>();
    for (const student of students) {
      map.set(student._id, student);
    }
    return map;
  }, [students]);

  const openStudentDetail = async (student: Student) => {
    setSelectedStudent(student);
    setEditName(student.name);
    setEditGroup(student.group ?? 'senior');
    setIsEditingStudent(false);
    setStudentDetailError('');
    setLessonError('');
    setExerciseError('');
    setNewLessonTitle('');
    setNewExerciseDescription('');
    setStudentDetailLoading(true);

    try {
      const rawDetail = await api.getBrotherhoodStudent(student._id);
      const studentObj: Student | undefined =
        rawDetail && typeof rawDetail === 'object' && 'student' in rawDetail
          ? ((rawDetail as { student: Student }).student as Student)
          : (rawDetail as Student);

      if (studentObj && studentObj._id) {
        setSelectedStudent(studentObj);
        setEditName(studentObj.name);
        setEditGroup(studentObj.group ?? 'senior');
      }
    } catch (err) {
      setStudentDetailError(getApiErrorMessage(err));
    } finally {
      setStudentDetailLoading(false);
    }
  };

  const handleCreateStudent = async () => {
    if (!newStudentName.trim()) {
      setStudentFormError('يرجى كتابة اسم الطالب.');
      return;
    }
    setCreatingStudent(true);
    setStudentFormError('');
    try {
      await api.createBrotherhoodStudent({
        name: newStudentName.trim(),
        group: newStudentGroup,
      });
      setCreateStudentModalVisible(false);
      setNewStudentName('');
      setNewStudentGroup('senior');
      showToast('تمت إضافة الطالب بنجاح.');
      await loadData();
    } catch (requestError) {
      setStudentFormError(getApiErrorMessage(requestError));
    } finally {
      setCreatingStudent(false);
    }
  };

  const handleUpdateStudent = async () => {
    if (!selectedStudent) return;
    if (!editName.trim()) {
      setStudentDetailError('اسم الطالب مطلوب.');
      return;
    }
    setSavingEdit(true);
    setStudentDetailError('');
    try {
      await api.updateBrotherhoodStudent(selectedStudent._id, {
        name: editName.trim(),
        group: editGroup,
      });
      setSelectedStudent({
        ...selectedStudent,
        name: editName.trim(),
        group: editGroup,
      });
      setIsEditingStudent(false);
      showToast('تم تحديث بيانات الطالب.');
      await loadData();
    } catch (requestError) {
      setStudentDetailError(getApiErrorMessage(requestError));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;
    setDeletingStudent(true);
    try {
      await api.deleteBrotherhoodStudent(selectedStudent._id);
      setConfirmDeleteVisible(false);
      setSelectedStudent(null);
      showToast('تم حذف الطالب بنجاح.');
      await loadData();
    } catch (requestError) {
      setStudentDetailError(getApiErrorMessage(requestError));
      setConfirmDeleteVisible(false);
    } finally {
      setDeletingStudent(false);
    }
  };

  const handleAddLesson = async () => {
    if (!selectedStudent) return;
    if (!newLessonTitle.trim()) {
      setLessonError('يرجى إدخال عنوان الدرس.');
      return;
    }
    setAddingLesson(true);
    setLessonError('');
    try {
      const created = (await api.createBrotherhoodLesson(selectedStudent._id, {
        title: newLessonTitle.trim(),
      })) as StudentLesson | undefined;

      const newLesson: StudentLesson = created?._id
        ? created
        : { _id: Date.now().toString(), title: newLessonTitle.trim(), status: 'pending' };

      const updatedLessons: StudentLesson[] = [
        ...(selectedStudent.lessons ?? []),
        newLesson,
      ];

      setSelectedStudent({
        ...selectedStudent,
        lessons: updatedLessons,
      });
      setNewLessonTitle('');
      showToast('تمت إضافة الدرس بنجاح.');
      await loadData();
    } catch (requestError) {
      setLessonError(getApiErrorMessage(requestError));
    } finally {
      setAddingLesson(false);
    }
  };

  const handleAddExercise = async () => {
    if (!selectedStudent) return;
    if (!newExerciseDescription.trim()) {
      setExerciseError('يرجى إدخال وصف التمرين.');
      return;
    }
    setAddingExercise(true);
    setExerciseError('');
    try {
      const created = (await api.createBrotherhoodExercise(selectedStudent._id, {
        description: newExerciseDescription.trim(),
      })) as StudentExercise | undefined;

      const newExercise: StudentExercise = created?._id
        ? created
        : { _id: Date.now().toString(), description: newExerciseDescription.trim(), title: newExerciseDescription.trim() };

      const updatedExercises: StudentExercise[] = [
        ...(selectedStudent.exercises ?? []),
        newExercise,
      ];

      setSelectedStudent({
        ...selectedStudent,
        exercises: updatedExercises,
      });
      setNewExerciseDescription('');
      showToast('تمت إضافة التمرين بنجاح.');
      await loadData();
    } catch (requestError) {
      setExerciseError(getApiErrorMessage(requestError));
    } finally {
      setAddingExercise(false);
    }
  };

  const handleCreateSession = async () => {
    if (!newSessionStudentId) {
      setSessionFormError('يرجى اختيار الطالب للجلسة.');
      return;
    }
    if (!newSessionDate.trim()) {
      setSessionFormError('يرجى إدخال تاريخ الجلسة.');
      return;
    }
    const duration = parseInt(newSessionDuration, 10);
    if (Number.isNaN(duration) || duration <= 0) {
      setSessionFormError('مدة الجلسة يجب أن تكون رقمًا أكبر من الصفر.');
      return;
    }
    setCreatingSession(true);
    setSessionFormError('');
    try {
      await api.createBrotherhoodSession({
        studentId: newSessionStudentId,
        date: newSessionDate.includes('T') ? newSessionDate : `${newSessionDate}T00:00:00.000Z`,
        durationMinutes: duration,
        note: newSessionNote.trim() || undefined,
      });
      setCreateSessionModalVisible(false);
      setNewSessionStudentId('');
      setNewSessionDate(todayDateString());
      setNewSessionDuration('60');
      setNewSessionNote('');
      showToast('تمت جدولة الجلسة بنجاح.');
      await loadData();
    } catch (requestError) {
      setSessionFormError(getApiErrorMessage(requestError));
    } finally {
      setCreatingSession(false);
    }
  };

  const handleDeferSession = async (session: Session) => {
    setDeferringSessionId(session._id);
    try {
      await api.deferBrotherhoodSession(session._id, {});
      showToast('تم تأجيل الجلسة.');
      await loadData();
    } catch (requestError) {
      showToast(getApiErrorMessage(requestError));
    } finally {
      setDeferringSessionId(null);
    }
  };

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, searchQuery]);

  const filteredSessions = useMemo(() => {
    if (sessionStatusFilter === 'all') return sessions;
    return sessions.filter((s) => {
      const effectiveStatus = getSessionEffectiveStatus(s);
      return effectiveStatus === sessionStatusFilter;
    });
  }, [sessions, sessionStatusFilter]);

  // Summary statistics
  const seniorsCount = students.filter((s) => s.group === 'senior').length;
  const juniorsCount = students.filter((s) => s.group === 'junior').length;
  const doneSessionsCount = sessions.filter((s) => s.status === 'done').length;

  if (loading && students.length === 0 && sessions.length === 0) {
    return (
      <View style={commonStyles.screen}>
        <LoadingState label="جارٍ تحميل بيانات الأخوة..." />
      </View>
    );
  }

  if (error && students.length === 0 && sessions.length === 0) {
    return (
      <View style={commonStyles.screen}>
        <ScreenState
          title="تعذر تحميل بيانات الأخوة"
          message={error}
          actionLabel="إعادة المحاولة"
          onAction={() => void loadData()}
        />
      </View>
    );
  }

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.pageCategoryBadge}>العادات الاجتماعية</Text>
            <Text style={styles.pageTitle}>الأخوة والمراجعة</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (activeTab === 'students') {
                  setStudentFormError('');
                  setCreateStudentModalVisible(true);
                } else {
                  setSessionFormError('');
                  if (students.length > 0 && !newSessionStudentId) {
                    setNewSessionStudentId(students[0]._id);
                  }
                  setCreateSessionModalVisible(true);
                }
              }}
              style={({ pressed }) => [styles.addBtn, pressed && styles.btnPressed]}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addBtnText}>
                {activeTab === 'students' ? 'إضافة طالب' : 'جدولة جلسة'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="العودة"
              onPress={() => goBackSafe(navigation)}
              style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
            >
              <Ionicons name="arrow-forward" size={17} color={palette.primary} />
              <Text style={styles.backBtnText}>رجوع</Text>
            </Pressable>
          </View>
        </View>

        {/* Global Toast Notification */}
        {toastMessage ? (
          <View style={styles.alertSuccess} accessibilityRole="alert">
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={styles.alertSuccessText}>{toastMessage}</Text>
            <Pressable onPress={() => setToastMessage(null)}>
              <Ionicons name="close" size={16} color="#059669" />
            </Pressable>
          </View>
        ) : null}

        {/* Hero Banner */}
        <LinearGradient
          colors={['#312E81', '#4338CA', '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <View style={styles.circleProgressTrack}>
              <Ionicons name="people" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.heroTexts}>
              <Text style={styles.heroTitle}>جلسات المراجعة والأخوة</Text>
              <Text style={styles.heroSubtitle}>
                متابعة الدروس والتمارين وجلسات الإخوة بانتظام
              </Text>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatBox}>
              <Ionicons name="school-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{students.length}</Text>
              <Text style={styles.heroStatLabel}>الطلاب</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{sessions.length}</Text>
              <Text style={styles.heroStatLabel}>الجلسات</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{doneSessionsCount}</Text>
              <Text style={styles.heroStatLabel}>المنجزة</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Ionicons name="pie-chart-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{seniorsCount}/{juniorsCount}</Text>
              <Text style={styles.heroStatLabel}>كبار / صغار</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Tab switch bar */}
        <View style={styles.tabSegmentBar}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'students' }}
            onPress={() => setActiveTab('students')}
            style={[styles.segmentBtn, activeTab === 'students' && styles.segmentBtnActive]}
          >
            <Ionicons
              name="people-outline"
              size={17}
              color={activeTab === 'students' ? '#FFFFFF' : palette.muted}
            />
            <Text style={[styles.segmentBtnText, activeTab === 'students' && styles.segmentBtnTextActive]}>
              قائمة الطلاب ({students.length})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'sessions' }}
            onPress={() => setActiveTab('sessions')}
            style={[styles.segmentBtn, activeTab === 'sessions' && styles.segmentBtnActive]}
          >
            <Ionicons
              name="time-outline"
              size={17}
              color={activeTab === 'sessions' ? '#FFFFFF' : palette.muted}
            />
            <Text style={[styles.segmentBtnText, activeTab === 'sessions' && styles.segmentBtnTextActive]}>
              الجلسات ({sessions.length})
            </Text>
          </Pressable>
        </View>

        {/* TAB 1: STUDENTS */}
        {activeTab === 'students' && (
          <View style={styles.tabSection}>
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={19} color={palette.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="ابحث عن طالب بالاسم..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                accessibilityLabel="البحث باسم الطالب"
                placeholderTextColor={palette.muted}
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={palette.muted} />
                </Pressable>
              ) : null}
            </View>

            {/* Empty States */}
            {students.length === 0 ? (
              <ScreenState
                title="لا يوجد طلاب مسجلون"
                message="ابدأ بإضافة أول طالب لمتابعة دروسه وتمارينه وجلساته."
                actionLabel="إضافة طالب جديد"
                onAction={() => {
                  setStudentFormError('');
                  setCreateStudentModalVisible(true);
                }}
              />
            ) : filteredStudents.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={commonStyles.body}>لا توجد نتائج تطابق &ldquo;{searchQuery}&rdquo;.</Text>
              </View>
            ) : (
              filteredStudents.map((student) => {
                const lessonsCount = student.lessons?.length ?? 0;
                const exercisesCount = student.exercises?.length ?? 0;
                const initial = student.name ? student.name.trim().charAt(0) : 'ط';

                return (
                  <Pressable
                    key={student._id}
                    accessibilityRole="button"
                    accessibilityLabel={`فتح تفاصيل الطالب ${student.name}`}
                    onPress={() => void openStudentDetail(student)}
                    style={({ pressed }) => [
                      styles.studentCard,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <View style={styles.studentCardHeader}>
                      <View style={styles.studentAvatar}>
                        <Text style={styles.studentAvatarText}>{initial}</Text>
                      </View>

                      <View style={styles.studentInfoGroup}>
                        <View style={styles.studentNameRow}>
                          <Text style={styles.studentName}>{student.name}</Text>
                          <View style={styles.groupBadge}>
                            <Text style={styles.groupBadgeText}>
                              {formatGroupName(student.group)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.studentStatsRow}>
                          <View style={styles.miniStatItem}>
                            <Ionicons name="book-outline" size={13} color={palette.muted} />
                            <Text style={styles.miniStatText}>{lessonsCount} دروس</Text>
                          </View>
                          <View style={styles.miniStatItem}>
                            <Ionicons name="create-outline" size={13} color={palette.muted} />
                            <Text style={styles.miniStatText}>{exercisesCount} تمارين</Text>
                          </View>
                        </View>
                      </View>

                      <Ionicons name="chevron-back" size={18} color={palette.muted} />
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {/* TAB 2: SESSIONS */}
        {activeTab === 'sessions' && (
          <View style={styles.tabSection}>
            {/* Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsRow}
            >
              {(['all', 'scheduled', 'done', 'deferred'] as const).map((filterKey) => {
                const labelMap: Record<SessionStatusFilter, string> = {
                  all: 'الكل',
                  scheduled: 'مجدولة',
                  done: 'مكتملة ✓',
                  deferred: 'مؤجلة',
                };
                const isSelected = sessionStatusFilter === filterKey;
                return (
                  <Pressable
                    key={filterKey}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setSessionStatusFilter(filterKey)}
                    style={[styles.filterPill, isSelected && styles.filterPillSelected]}
                  >
                    <Text
                      style={[styles.filterPillText, isSelected && styles.filterPillTextSelected]}
                    >
                      {labelMap[filterKey]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Sessions List */}
            {sessions.length === 0 ? (
              <ScreenState
                title="لا توجد جلسات بعد"
                message="قم بجدولة جلسة دراسية جديدة مع أحد الطلاب."
                actionLabel="جدولة جلسة الآن"
                onAction={() => {
                  setSessionFormError('');
                  if (students.length > 0 && !newSessionStudentId) {
                    setNewSessionStudentId(students[0]._id);
                  }
                  setCreateSessionModalVisible(true);
                }}
              />
            ) : filteredSessions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={commonStyles.body}>لا توجد جلسات تطابق التصفية المحددة.</Text>
              </View>
            ) : (
              filteredSessions.map((session) => {
                const studentName = studentsMap.get(session.studentId)?.name ?? 'طالب';
                const effectiveStatus = getSessionEffectiveStatus(session);
                const isScheduled = effectiveStatus === 'scheduled';
                const isBusy = deferringSessionId === session._id;

                const statusBg =
                  effectiveStatus === 'scheduled'
                    ? '#EFF6FF'
                    : effectiveStatus === 'done'
                    ? '#ECFDF5'
                    : '#FEF3C7';
                const statusColor =
                  effectiveStatus === 'scheduled'
                    ? '#2563EB'
                    : effectiveStatus === 'done'
                    ? '#059669'
                    : '#B45309';

                const statusLabel =
                  effectiveStatus === 'scheduled'
                    ? 'مجدولة'
                    : effectiveStatus === 'done'
                    ? 'مكتملة ✓'
                    : 'مؤجلة';

                return (
                  <View key={session._id} style={styles.sessionCard}>
                    <View style={styles.sessionCardHeader}>
                      <View style={styles.sessionTitleGroup}>
                        <Text style={styles.sessionStudentName}>{studentName}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.sessionMeta}>
                        <View style={styles.sessionMetaItem}>
                          <Ionicons name="calendar-outline" size={13} color={palette.muted} />
                          <Text style={styles.sessionMetaText}>{formatDisplayDate(session.date)}</Text>
                        </View>
                        <View style={styles.sessionMetaItem}>
                          <Ionicons name="time-outline" size={13} color={palette.muted} />
                          <Text style={styles.sessionMetaText}>{session.durationMinutes} دقيقة</Text>
                        </View>
                      </View>
                    </View>

                    {session.note ? (
                      <View style={styles.sessionNoteBox}>
                        <Text style={styles.sessionNoteText}>ملاحظة: {session.note}</Text>
                      </View>
                    ) : null}

                    {isScheduled && (
                      <View style={styles.sessionActionsRow}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={isBusy}
                          onPress={() => void handleDeferSession(session)}
                          style={[styles.deferBtn, isBusy && styles.btnDisabled]}
                        >
                          <Ionicons name="calendar" size={14} color="#B45309" />
                          <Text style={styles.deferBtnText}>
                            {isBusy ? 'جارٍ التأجيل...' : 'تأجيل الجلسة'}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* CREATE STUDENT MODAL */}
      <Modal
        visible={createStudentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateStudentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.dialogScroll}>
            <View style={styles.dialog}>
              <View style={styles.dialogHeader}>
                <Text style={styles.dialogTitle}>إضافة طالب جديد</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCreateStudentModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>اسم الطالب *</Text>
                <TextInput
                  style={commonStyles.input}
                  placeholder="أدخل اسم الطالب الكامل"
                  value={newStudentName}
                  onChangeText={setNewStudentName}
                  accessibilityLabel="اسم الطالب"
                  placeholderTextColor={palette.muted}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>المجموعة</Text>
                <View style={styles.choiceRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setNewStudentGroup('senior')}
                    style={[styles.choiceBtn, newStudentGroup === 'senior' && styles.choiceBtnActive]}
                  >
                    <Text style={[styles.choiceBtnText, newStudentGroup === 'senior' && styles.choiceBtnTextActive]}>
                      كبار (Senior)
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setNewStudentGroup('junior')}
                    style={[styles.choiceBtn, newStudentGroup === 'junior' && styles.choiceBtnActive]}
                  >
                    <Text style={[styles.choiceBtnText, newStudentGroup === 'junior' && styles.choiceBtnTextActive]}>
                      صغار (Junior)
                    </Text>
                  </Pressable>
                </View>
              </View>

              {studentFormError ? (
                <View style={styles.alertError} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={15} color="#EF4444" />
                  <Text style={styles.alertErrorText}>{studentFormError}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label={creatingStudent ? 'جارٍ الحفظ...' : 'إنشاء الطالب'}
                disabled={creatingStudent}
                onPress={() => void handleCreateStudent()}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* CREATE SESSION MODAL */}
      <Modal
        visible={createSessionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateSessionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.dialogScroll}>
            <View style={styles.dialog}>
              <View style={styles.dialogHeader}>
                <Text style={styles.dialogTitle}>جدولة جلسة دراسية</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCreateSessionModalVisible(false)}
                  style={styles.closeBtn}
                >
                  <Ionicons name="close" size={20} color={palette.text} />
                </Pressable>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>اختر الطالب *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studentChipsRow}>
                  {students.map((student) => {
                    const sel = newSessionStudentId === student._id;
                    return (
                      <Pressable
                        key={student._id}
                        onPress={() => setNewSessionStudentId(student._id)}
                        style={[styles.studentChip, sel && styles.studentChipActive]}
                      >
                        <Text style={[styles.studentChipText, sel && styles.studentChipTextActive]}>
                          {student.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>تاريخ الجلسة (YYYY-MM-DD) *</Text>
                <TextInput
                  style={commonStyles.input}
                  value={newSessionDate}
                  onChangeText={setNewSessionDate}
                  placeholder="2026-10-30"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>مدة الجلسة (بالدقائق) *</Text>
                <TextInput
                  style={commonStyles.input}
                  keyboardType="number-pad"
                  value={newSessionDuration}
                  onChangeText={setNewSessionDuration}
                  placeholder="60"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>ملاحظات الجلسة (اختياري)</Text>
                <TextInput
                  style={commonStyles.input}
                  value={newSessionNote}
                  onChangeText={setNewSessionNote}
                  placeholder="ملاحظات حول موضوع الجلسة..."
                />
              </View>

              {sessionFormError ? (
                <View style={styles.alertError} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={15} color="#EF4444" />
                  <Text style={styles.alertErrorText}>{sessionFormError}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label={creatingSession ? 'جارٍ الجدولة...' : 'تأكيد جدولة الجلسة'}
                disabled={creatingSession}
                onPress={() => void handleCreateSession()}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* STUDENT DETAIL MODAL */}
      <Modal
        visible={selectedStudent !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedStudent(null)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.dialogScroll}>
            {selectedStudent && (
              <View style={styles.dialog}>
                <View style={styles.dialogHeader}>
                  <Text style={styles.dialogTitle}>تفاصيل الطالب</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelectedStudent(null)}
                    style={styles.closeBtn}
                  >
                    <Ionicons name="close" size={20} color={palette.text} />
                  </Pressable>
                </View>

                {studentDetailLoading ? <LoadingState label="جارٍ التحديث..." /> : null}

                {studentDetailError ? (
                  <View style={styles.alertError} accessibilityRole="alert">
                    <Ionicons name="alert-circle" size={15} color="#EF4444" />
                    <Text style={styles.alertErrorText}>{studentDetailError}</Text>
                  </View>
                ) : null}

                {/* Edit student info or view */}
                {isEditingStudent ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>تعديل الاسم</Text>
                    <TextInput style={commonStyles.input} value={editName} onChangeText={setEditName} />
                    <Text style={styles.fieldLabel}>المجموعة</Text>
                    <View style={styles.choiceRow}>
                      <Pressable
                        onPress={() => setEditGroup('senior')}
                        style={[styles.choiceBtn, editGroup === 'senior' && styles.choiceBtnActive]}
                      >
                        <Text style={[styles.choiceBtnText, editGroup === 'senior' && styles.choiceBtnTextActive]}>
                          كبار
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setEditGroup('junior')}
                        style={[styles.choiceBtn, editGroup === 'junior' && styles.choiceBtnActive]}
                      >
                        <Text style={[styles.choiceBtnText, editGroup === 'junior' && styles.choiceBtnTextActive]}>
                          صغار
                        </Text>
                      </Pressable>
                    </View>
                    <View style={styles.actionsRow}>
                      <PrimaryButton
                        label={savingEdit ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                        disabled={savingEdit}
                        onPress={() => void handleUpdateStudent()}
                      />
                      <Pressable
                        onPress={() => setIsEditingStudent(false)}
                        style={styles.cancelBtn}
                      >
                        <Text style={styles.cancelBtnText}>إلغاء</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.studentDetailCard}>
                    <View style={styles.studentNameRow}>
                      <Text style={styles.studentName}>{selectedStudent.name}</Text>
                      <View style={styles.groupBadge}>
                        <Text style={styles.groupBadgeText}>
                          {formatGroupName(selectedStudent.group)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actionsRow}>
                      <Pressable onPress={() => setIsEditingStudent(true)} style={styles.actionOutlineBtn}>
                        <Ionicons name="create-outline" size={14} color={palette.primary} />
                        <Text style={styles.actionOutlineBtnText}>تعديل</Text>
                      </Pressable>
                      <Pressable onPress={() => setConfirmDeleteVisible(true)} style={styles.actionDangerBtn}>
                        <Ionicons name="trash-outline" size={14} color={palette.danger} />
                        <Text style={styles.actionDangerBtnText}>حذف الطالب</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Lessons Section */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionSubtitle}>
                    الدروس ({selectedStudent.lessons?.length ?? 0})
                  </Text>
                  <View style={styles.addMiniRow}>
                    <TextInput
                      style={[commonStyles.input, styles.miniInput]}
                      placeholder="عنوان درس جديد..."
                      value={newLessonTitle}
                      onChangeText={setNewLessonTitle}
                      placeholderTextColor={palette.muted}
                    />
                    <Pressable
                      disabled={addingLesson}
                      onPress={() => void handleAddLesson()}
                      style={[styles.miniAddBtn, addingLesson && styles.btnDisabled]}
                    >
                      <Ionicons name="add" size={18} color="#FFFFFF" />
                    </Pressable>
                  </View>
                  {lessonError ? (
                    <Text style={commonStyles.error}>{lessonError}</Text>
                  ) : null}
                  {(selectedStudent.lessons ?? []).map((lesson, idx) => (
                    <View key={lesson._id || `les-${idx}`} style={styles.itemRow}>
                      <Text style={styles.itemTitle}>{lesson.title}</Text>
                      <View style={styles.miniBadge}>
                        <Text style={styles.miniBadgeText}>
                          {lesson.status === 'done' ? 'مكتمل ✓' : 'قيد الانتظار'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Exercises Section */}
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionSubtitle}>
                    التمارين ({selectedStudent.exercises?.length ?? 0})
                  </Text>
                  <View style={styles.addMiniRow}>
                    <TextInput
                      style={[commonStyles.input, styles.miniInput]}
                      placeholder="وصف تمرين جديد..."
                      value={newExerciseDescription}
                      onChangeText={setNewExerciseDescription}
                      placeholderTextColor={palette.muted}
                    />
                    <Pressable
                      disabled={addingExercise}
                      onPress={() => void handleAddExercise()}
                      style={[styles.miniAddBtn, addingExercise && styles.btnDisabled]}
                    >
                      <Ionicons name="add" size={18} color="#FFFFFF" />
                    </Pressable>
                  </View>
                  {exerciseError ? (
                    <Text style={commonStyles.error}>{exerciseError}</Text>
                  ) : null}
                  {(selectedStudent.exercises ?? []).map((ex, idx) => (
                    <View key={ex._id || `ex-${idx}`} style={styles.itemRow}>
                      <Text style={styles.itemTitle}>{ex.description || ex.title}</Text>
                      <View style={styles.miniBadge}>
                        <Text style={styles.miniBadgeText}>تمرين</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* CONFIRM DELETE MODAL */}
      <Modal
        visible={confirmDeleteVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDeleteVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmDialog}>
            <View style={styles.confirmIconBox}>
              <Ionicons name="alert-circle" size={28} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>حذف الطالب</Text>
            <Text style={styles.confirmText}>
              هل أنت متأكد من حذف الطالب {selectedStudent?.name}؟ سيتم حذف جميع دروسه وتمارينه بشكل نهائي.
            </Text>
            <View style={styles.confirmActionsRow}>
              <Pressable
                disabled={deletingStudent}
                onPress={() => void handleDeleteStudent()}
                style={[styles.confirmDeleteBtn, deletingStudent && styles.btnDisabled]}
              >
                <Text style={styles.confirmDeleteBtnText}>
                  {deletingStudent ? 'جارٍ الحذف...' : 'نعم، احذف'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setConfirmDeleteVisible(false)}
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
    color: '#4F46E5',
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
    backgroundColor: '#4F46E5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#4F46E5',
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
    shadowColor: '#4F46E5',
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
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    textAlign: 'right',
  },
  heroStatsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 8,
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
    fontSize: 15,
    fontWeight: '800',
  },
  heroStatLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  tabSegmentBar: {
    flexDirection: 'row-reverse',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 16,
    padding: 4,
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: '#4F46E5',
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
  },
  tabSection: {
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    textAlign: 'right',
    color: palette.text,
    fontSize: 14,
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
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.muted,
  },
  filterPillTextSelected: {
    color: '#FFFFFF',
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    borderColor: '#4F46E5',
  },
  studentCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4F46E5',
  },
  studentInfoGroup: {
    flex: 1,
    gap: 4,
  },
  studentNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  groupBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  groupBadgeText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  studentStatsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  miniStatItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  miniStatText: {
    fontSize: 12,
    color: palette.muted,
  },
  sessionCard: {
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
  sessionCardHeader: {
    gap: 6,
  },
  sessionTitleGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionStudentName: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.text,
  },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sessionMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  sessionMetaItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  sessionMetaText: {
    fontSize: 12,
    color: palette.muted,
  },
  sessionNoteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
  },
  sessionNoteText: {
    fontSize: 12,
    color: palette.muted,
    textAlign: 'right',
  },
  sessionActionsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  deferBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deferBtnText: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '700',
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
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
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
  choiceRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  choiceBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
  },
  choiceBtnActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  choiceBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.text,
  },
  choiceBtnTextActive: {
    color: '#FFFFFF',
  },
  studentChipsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingVertical: 4,
  },
  studentChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  studentChipActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  studentChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.text,
  },
  studentChipTextActive: {
    color: '#FFFFFF',
  },
  studentDetailCard: {
    gap: 12,
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  actionOutlineBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  actionOutlineBtnText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  actionDangerBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.danger,
  },
  actionDangerBtnText: {
    color: palette.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionBlock: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    gap: 10,
  },
  sectionSubtitle: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  addMiniRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  miniInput: {
    flex: 1,
    minHeight: 40,
    fontSize: 13,
  },
  miniAddBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
  },
  itemTitle: {
    fontSize: 13,
    color: palette.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  miniBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  miniBadgeText: {
    fontSize: 11,
    color: palette.primary,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.5,
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
});
