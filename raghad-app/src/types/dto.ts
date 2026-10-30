export interface UserDTO {
  _id: string;
  name: string;
  email: string;
  role: 'owner';
  timezone: string;
  settings: UserSettingsDTO;
  createdAt: string;
  lastActiveAt: string;
}

export interface UserSettingsDTO {
  theme: 'light' | 'dark';
  language: 'ar';
  notificationsEnabled: boolean;
  reminderLeadMinutes: number;
}

export interface AuthTokensDTO {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface LoginRequestDTO {
  email: string;
  password: string;
}

export interface RegisterRequestDTO {
  name: string;
  email: string;
  password: string;
}

export interface RefreshRequestDTO {
  refreshToken: string;
}

export interface UpdateProfileRequestDTO {
  name?: string;
  password?: string;
  timezone?: string;
}

export interface UpdateUserSettingsRequestDTO {
  theme: 'light' | 'dark';
  language: 'ar';
  notificationsEnabled: boolean;
  reminderLeadMinutes: number;
}

export interface LoginResponseDTO {
  user: UserDTO;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface HabitDTO {
  _id: string;
  name: string;
  type: 'daily' | 'seasonal';
  category: 'spiritual' | 'health' | 'study' | 'social' | 'financial' | 'other';
  timeSlot: 'morning' | 'evening' | 'allTime' | 'flexible';
  isHobby: boolean;
  suggestedTime: string | null;
  /** تفاصيل تنفيذ العادة كما وردت في notes.md (كيفيتها، مداها، شروطها). */
  details?: string;
  order: number;
  active: boolean;
  config: {
    special: 'none' | 'quran' | 'reading' | 'english' | 'exercise' | 'brotherhood' | 'family' | 'pockets' | 'programs' | 'money' | 'beek';
    /** الحصة تُطلب كل N يوم (1 = يوميًا). */
    everyN?: number;
    /** أيام عطلة رسمية (0 = الأحد … 6 = السبت). */
    restWeekdays?: number[];
  };
  pointsPerCompletion: number;
  pointsPenaltyIfMissed: number;
}

export interface HabitCreateRequestDTO {
  name: string;
  type: 'daily' | 'seasonal';
  category: HabitDTO['category'];
  timeSlot: HabitDTO['timeSlot'];
  isHobby: boolean;
  suggestedTime?: string;
  details?: string;
  config: HabitDTO['config'];
}

export type HabitUpdateRequestDTO = Partial<HabitCreateRequestDTO>;

export interface HabitDetailDTO {
  habit: HabitDTO;
  streak: { current: number; longest: number } | null;
  stats: {
    doneDays: number;
    successRate: number;
    failureRate: number;
  };
}

export interface HabitLogDTO {
  _id: string;
  habitId: string;
  date: string;
  status: 'completed' | 'missed' | 'skipped' | 'pending';
  completedAt: string | null;
  points: number;
  note: string | null;
  metadata: Record<string, unknown>;
}

export interface HabitLogCreateRequestDTO {
  habitId: string;
  date: string;
  status: 'completed' | 'skipped';
  note?: string;
  metadata?: Record<string, unknown>;
}

export interface HabitLogCreateResponseDTO {
  log: HabitLogDTO;
  pointsDelta: number;
  streak: { current: number; longest: number } | null;
}

export interface HabitListDTO {
  items: HabitDTO[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface SeasonalScheduleRequestDTO {
  day: string;
  remindDaysBefore: number;
}

export interface GamificationPointsDTO {
  total: number | null;
  entries: PointEntryDTO[];
  meta?: {
    totalEarned?: number;
    totalLost?: number;
    net?: number;
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface GamificationStatsDTO {
  today?: { earned: number; lost: number; net?: number };
  week?: { ratePercent: number; completed?: number; total?: number };
  month?: { ratePercent: number; completed?: number; total?: number };
  habitsWeekly?: {
    habitId: string;
    habitName?: string | null;
    ratePercent: number;
    completed?: number;
    missed?: number;
  }[];
  points?: number;
  streakCount?: number;
  bestStreak?: number;
}

export interface GamificationLevelsDTO {
  currentLevel?: number;
  points?: number;
  nextLevelAt?: number;
  history?: unknown[];
  level?: number;
  currentLevelMin?: number;
}

export interface TaskDTO {
  _id: string;
  title: string;
  description: string | null;
  type: 'manual' | 'project' | 'study' | 'work' | 'islamic';
  projectId: string | null;
  nodeId: string | null;
  date: string;
  startTime: string | null;
  status: 'todo' | 'done' | 'deferred';
  priority: 'low' | 'medium' | 'high';
  source: 'recurring' | 'manual' | 'project';
  pointsReward: number;
}

export interface TaskCreateRequestDTO {
  title: string;
  description?: string;
  type: TaskDTO['type'];
  projectId?: string | null;
  nodeId?: string | null;
  date: string;
  startTime?: string | null;
  priority: TaskDTO['priority'];
  pointsReward?: number;
}

export type TaskUpdateRequestDTO = Partial<TaskCreateRequestDTO> & {
  status?: TaskDTO['status'];
};

export interface TaskStatusUpdateDTO {
  status: TaskDTO['status'];
}

export interface ProjectDTO {
  _id: string;
  key: 'lb' | 'supnum' | 'basma_tech' | 'competitions' | 'messages_gaza' | 'hasaniya' | 'ai_depth';
  name: string;
  structureType: 'notes_board' | 'tree_cards' | 'goals_pages' | 'calendar_notes' | 'level_game' | 'card_sets';
  description: string | null;
  active: boolean;
  progress: number;
}

export interface ProjectCreateRequestDTO {
  key: ProjectDTO['key'];
  name: string;
  structureType: ProjectDTO['structureType'];
  description?: string;
}

export type ProjectUpdateRequestDTO = Partial<ProjectCreateRequestDTO>;

export interface ProjectNodeDTO {
  _id: string;
  projectId: string;
  parentId: string | null;
  type: 'file' | 'board' | 'column' | 'card' | 'leaf' | 'note' | 'goal' | 'level';
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  order: number;
  data: Record<string, unknown>;
  /** يُعيَّد فقط عند إنهاء مستوى متأخر في مشروع رسائل من غزة. */
  latePenalty?: number;
}

export interface ProjectNodeCreateRequestDTO {
  parentId?: string | null;
  type: ProjectNodeDTO['type'];
  title: string;
  order?: number;
  status?: ProjectNodeDTO['status'];
  data?: Record<string, unknown>;
}

export type ProjectNodeUpdateRequestDTO = Partial<ProjectNodeCreateRequestDTO>;

export interface ProjectDetailDTO {
  project: ProjectDTO;
  nodes: ProjectNodeDTO[];
  stats?: { nodeCount: number };
}

export interface ProjectAchievementsDTO {
  milestones: {
    _id?: string;
    title?: string;
    type?: string;
    status?: string;
    updatedAt?: string;
  }[];
  progress: number;
}

export interface GoalDTO {
  _id: string;
  title: string;
  scope: 'global' | 'project';
  projectId: string | null;
  target: number;
  current: number;
  deadline: string | null;
  status: 'active' | 'achieved';
}

export interface GoalCreateRequestDTO {
  title: string;
  scope: GoalDTO['scope'];
  projectId?: string | null;
  target: number;
  current?: number;
  deadline?: string | null;
  status?: GoalDTO['status'];
}

export type GoalUpdateRequestDTO = Partial<GoalCreateRequestDTO>;

export interface GoalDetailDTO {
  goal: GoalDTO;
  progressPercent: number;
}

export interface CalendarEventDTO {
  _id: string;
  title: string;
  date: string;
  endDate: string | null;
  type: 'task' | 'habit' | 'project' | 'goal' | 'reminder' | 'custom';
  refId: string | null;
  projectId: string | null;
  note: string | null;
  /** حالة المهمة عندما يكون هذا العنصر مهمة مشروع مصدرها Task (غير قابل للتعديل من الروزنامة). */
  status?: 'todo' | 'done' | 'deferred';
  /** 'task' = مهمة مشروع مُجلبة من صفحاتها الخاصة؛ 'event' = حدث روزنامة عادي. */
  source?: 'event' | 'task';
}

export interface CalendarEventCreateRequestDTO {
  title: string;
  date: string;
  endDate?: string | null;
  type: CalendarEventDTO['type'];
  refId?: string | null;
  projectId?: string | null;
  note?: string;
}

export type CalendarEventUpdateRequestDTO = Partial<CalendarEventCreateRequestDTO>;

export interface CalendarMainDTO {
  past: CalendarEventDTO[];
  upcoming: CalendarEventDTO[];
}

export interface PointEntryDTO {
  _id: string;
  date: string;
  amount: number;
  reason: 'habit_completed' | 'habit_missed' | 'task_done' | 'level_up' | 'penalty';
  refType: 'habit' | 'task' | 'project' | 'level';
  refId: string | null;
  note: string | null;
}

export interface StreakDTO {
  habitId: string;
  habitName: string;
  current: number;
  longest: number;
}

export interface ProgressOverviewDTO {
  projects: {
    projectId: string;
    name: string;
    achievementPercent: number;
  }[];
  habits: {
    dailyCompletionPercent: number;
    totalPoints: number;
    activeStreakMax: number;
  };
  goals: {
    achieved: number;
    active: number;
  };
}

export interface ProjectProgressDTO {
  goalAchievement: number;
  milestones: {
    _id: string;
    title: string;
    type: string;
    status: string;
    updatedAt: string;
  }[];
  nodesProgress: Record<string, number>;
}

export interface DashboardDTO {
  todayStats: {
    habitsDone: number;
    habitsTotal: number;
    tasksDone: number;
    points: number;
  };
  streaks: {
    habitName: string;
    current: number;
  }[];
  upcomingEvents: CalendarEventDTO[];
  unreadNotifications: number;
}

export interface IntegrationStatusDTO {
  fcm: 'ok' | 'not_configured';
  huggingface: 'ok' | 'not_configured';
  maps: 'ok' | 'not_configured';
  storage: 'ok' | 'not_configured';
}

export interface NotificationDTO {
  _id: string;
  type: 'habit_reminder' | 'task_reminder' | 'daily_summary' | 'streak' | 'level_up' | 'system';
  title: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  data: Record<string, unknown>;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface NotificationListDTO {
  items: NotificationDTO[];
  meta: {
    page: number;
    limit: number;
    total: number;
    unreadCount: number;
  };
}

export interface DeviceTokenRegistrationRequestDTO {
  token: string;
  platform: 'web' | 'android' | 'ios';
}

export interface DailyResponseDTO {
  date: string;
  habits: DailyHabitItemDTO[];
  tasks: TaskDTO[];
  summary: {
    totalItems: number;
    completed: number;
    points: number;
  };
  endOfDay: {
    score: number;
    message: string | null;
  };
}

export interface DailyHabitItemDTO extends HabitDTO {
  logStatus: 'completed' | 'missed' | 'pending' | 'skipped';
  logId: string | null;
}

export interface EndOfDayResponseDTO {
  date: string;
  ratePercent: number;
  pointsEarned: number;
  pointsLost: number;
  mood: 'praise' | 'encourage' | 'blame';
  message: string;
}

export interface GPSRouteDTO {
  habitId: string;
  date: string;
  distanceKm: number;
  route: { lat: number; lng: number }[];
}

export type ReadingBookStatus = 'locked' | 'unlocked' | 'completed';

export interface ReadingBookDTO {
  _id: string;
  title: string;
  author: string;
  level: number;
  status: ReadingBookStatus;
  pdfUrl: string | null;
  bookmarkPage: number | null;
  notes: ReadingNoteDTO[];
  completedAt: string | null;
  createdAt?: string;
}

export interface ReadingNoteDTO {
  _id: string;
  bookId: string;
  text: string;
  page?: number | null;
  createdAt: string;
}

export interface ReadingBookCreateRequestDTO {
  title: string;
  author: string;
  level: number;
  pdfUrl?: string | null;
  status?: ReadingBookStatus;
}

export type ReadingBookUpdateRequestDTO = Partial<ReadingBookCreateRequestDTO> & {
  bookmarkPage?: number | null;
  status?: ReadingBookStatus;
};

export interface ReadingNoteCreateRequestDTO {
  text: string;
  page?: number | null;
}

export interface QuranPlanDTO {
  reviewHizbs: number;
  dailyHizbs: number;
  weeklyRestEnabled: boolean;
  currentHizb: number;
  currentPhase: string;
}

export interface QuranLogDTO {
  _id: string;
  date: string;
  hizb: number;
  phase: string;
  durationMinutes: number;
  completedAt: string;
}

export interface QuranLogCreateRequestDTO {
  date: string;
  hizb: number;
  phase: string;
  durationMinutes: number;
}

export interface QuranNextSuggestionDTO {
  suggestion: string;
  reason?: string;
  nextPhaseSuggestion?: string;
}

export type EnglishSkill = 'reading' | 'writing' | 'listening' | 'speaking';

export interface EnglishLevelDTO {
  _id: string;
  index: number;
  skill: EnglishSkill;
  title: string;
  status: 'locked' | 'unlocked' | 'completed';
  contentRef: string;
}

export interface EnglishProgressDTO {
  skill: EnglishSkill;
  currentLevel: number;
  completedLevels: number[];
  score: number;
}

export interface EnglishLevelCompleteResponseDTO {
  level: EnglishLevelDTO;
  progress: EnglishProgressDTO;
  nextUnlockedLevel?: EnglishLevelDTO | null;
  result?: string;
}

export interface BrotherhoodStudentDTO {
  _id: string;
  name: string;
  group: 'senior' | 'junior';
  materials: string[];
  lessons: Record<string, unknown>[];
  exercises: Record<string, unknown>[];
  photos: string[];
  createdAt?: string;
}

export interface BrotherhoodSessionDTO {
  _id: string;
  studentId: string;
  date: string;
  durationMinutes: number;
  note: string | null;
  status: 'scheduled' | 'deferred' | 'completed';
}

export interface BrotherhoodLessonCreateRequestDTO {
  title: string;
  status?: 'pending' | 'done';
}

export interface BrotherhoodExerciseCreateRequestDTO {
  title: string;
  notes?: string;
}

export interface BrotherhoodSessionCreateRequestDTO {
  studentId: string;
  date: string;
  durationMinutes: number;
  note?: string;
}

export interface MoneyEntryDTO {
  _id: string;
  amount: number;
  source: string;
  note: string | null;
  date: string;
  createdAt: string;
}

export interface MoneyEntryCreateRequestDTO {
  amount: number;
  source: string;
  note?: string;
  date: string;
}

export interface MoneySummaryDTO {
  total: number;
  bySource: Record<string, number>;
  byMonth: Record<string, number>;
}

export interface MediaItemDTO {
  _id: string;
  kind: 'program' | 'journal' | 'beek_idea';
  title: string;
  body: string;
  projectId: string | null;
  watchedAt: string | null;
  tags: string[];
  createdAt: string;
}

export interface MediaItemCreateRequestDTO {
  kind: MediaItemDTO['kind'];
  title: string;
  body: string;
  projectId?: string | null;
  tags?: string[];
}

export type MediaItemUpdateRequestDTO = Partial<MediaItemCreateRequestDTO>;

export interface HasaniyaCardDTO {
  _id: string;
  type: 'hasaniya' | 'translated' | 'qa' | 'dictionary';
  text: string;
  translation: string | null;
  source: string | null;
  referenceMark: string | null;
  saved: boolean;
  createdAt: string;
}

export interface HasaniyaCardCreateRequestDTO {
  type: HasaniyaCardDTO['type'];
  text: string;
  translation?: string | null;
  source?: string | null;
  referenceMark?: string | null;
  saved?: boolean;
}

export type HasaniyaCardUpdateRequestDTO = Partial<HasaniyaCardCreateRequestDTO>;

export interface HasaniyaFetchRequestDTO {
  count?: number;
  prompt?: string;
}

export interface HasaniyaFetchResponseDTO {
  cards: HasaniyaCardDTO[];
  totalCount?: number;
}

export interface HasaniyaStatsDTO {
  total: number;
  byType: Record<string, number>;
}
