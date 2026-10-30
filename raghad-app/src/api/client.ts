import type { ApiResponse, ErrorCode } from '../types/api';
import type {
  DailyResponseDTO,
  DailyHabitItemDTO,
  CalendarEventCreateRequestDTO,
  CalendarEventDTO,
  CalendarEventUpdateRequestDTO,
  CalendarMainDTO,
  GoalCreateRequestDTO,
  GoalDTO,
  GoalDetailDTO,
  GoalUpdateRequestDTO,
  GamificationLevelsDTO,
  GamificationPointsDTO,
  GamificationStatsDTO,
  DashboardDTO,
  GPSRouteDTO,
  HabitCreateRequestDTO,
  IntegrationStatusDTO,
  ProgressOverviewDTO,
  ProjectProgressDTO,
  HabitDetailDTO,
  HabitDTO,
  HabitListDTO,
  HabitLogCreateRequestDTO,
  HabitLogCreateResponseDTO,
  HabitLogDTO,
  HabitUpdateRequestDTO,
  LoginRequestDTO,
  LoginResponseDTO,
  NotificationDTO,
  PointEntryDTO,
  ProjectAchievementsDTO,
  ProjectCreateRequestDTO,
  ProjectDTO,
  ProjectDetailDTO,
  ProjectNodeCreateRequestDTO,
  ProjectNodeDTO,
  ProjectNodeUpdateRequestDTO,
  ProjectUpdateRequestDTO,
  RegisterRequestDTO,
  SeasonalScheduleRequestDTO,
  StreakDTO,
  TaskCreateRequestDTO,
  TaskDTO,
  TaskStatusUpdateDTO,
  TaskUpdateRequestDTO,
  UpdateProfileRequestDTO,
  UpdateUserSettingsRequestDTO,
  UserDTO,
  UserSettingsDTO,
} from '../types/dto';
import { tokenStorage } from './storage';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

let accessToken: string | null = null;
let refreshInFlight: Promise<void> | null = null;
let onSessionExpired: (() => void) | null = null;

export class ApiClientError extends Error {
  readonly code: ErrorCode | string;
  readonly fields?: Record<string, string>;
  readonly status: number;

  constructor(
    code: ErrorCode | string,
    message: string,
    status: number,
    fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.fields = fields;
    this.status = status;
  }
}

export interface EndOfDayDisplayDTO {
  date: string;
  ratePercent?: number;
  pointsEarned?: number;
  pointsLost?: number;
  mood?: 'praise' | 'encourage' | 'blame';
  message: string | null;
  backendScore?: number;
  backendPoints?: number;
}

export const queryKeys = {
  daily: (date: string) => ['daily', date] as const,
  habits: (filters: Record<string, string | number | boolean | undefined>) =>
    ['habits', filters] as const,
  habit: (id: string) => ['habit', id] as const,
  habitHistory: (id: string) => ['habit-history', id] as const,
  points: ['gamification', 'points'] as const,
  streaks: ['gamification', 'streaks'] as const,
  stats: ['gamification', 'stats'] as const,
  levels: ['gamification', 'levels'] as const,
  tasks: (filters: Record<string, string | number | undefined>) =>
    ['tasks', filters] as const,
  task: (id: string) => ['task', id] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  goals: (filters: Record<string, string | undefined>) => ['goals', filters] as const,
  goal: (id: string) => ['goal', id] as const,
  progressOverview: ['phase6', 'progress', 'overview'] as const,
  projectProgress: (id: string) => ['phase6', 'progress', 'project', id] as const,
  dashboard: ['phase6', 'dashboard'] as const,
  integrationStatus: ['phase6', 'integrations', 'status'] as const,
  gpsRoute: ['phase6', 'integrations', 'route'] as const,
  calendar: (from: string, to: string) => ['calendar', from, to] as const,
  notifications: (filters: Record<string, string | number | boolean | undefined>) =>
    ['notifications', filters] as const,
  notification: (id: string) => ['notification', id] as const,
  readingBooks: (filters: Record<string, string | number | boolean | undefined>) =>
    ['phase4', 'reading', 'books', filters] as const,
  readingBook: (id: string) => ['phase4', 'reading', 'book', id] as const,
  quranPlan: ['phase4', 'quran', 'plan'] as const,
  quranLogs: (filters: Record<string, string | number | boolean | undefined>) =>
    ['phase4', 'quran', 'logs', filters] as const,
  englishLevels: (skill?: string) => ['phase4', 'english', 'levels', skill ?? 'all'] as const,
  englishProgress: ['phase4', 'english', 'progress'] as const,
  brotherhoodStudents: (filters: Record<string, string | number | boolean | undefined>) =>
    ['phase4', 'brotherhood', 'students', filters] as const,
  brotherhoodSessions: (filters: Record<string, string | number | boolean | undefined>) =>
    ['phase4', 'brotherhood', 'sessions', filters] as const,
  moneyEntries: (filters: Record<string, string | number | boolean | undefined>) =>
    ['phase4', 'money', 'entries', filters] as const,
  moneySummary: ['phase4', 'money', 'summary'] as const,
  mediaItems: (filters: Record<string, string | number | boolean | undefined>) =>
    ['phase4', 'media', 'items', filters] as const,
  hasaniyaCards: (filters: Record<string, string | number | boolean | undefined>) =>
    ['phase4', 'hasaniya', 'cards', filters] as const,
  hasaniyaStats: ['phase4', 'hasaniya', 'stats'] as const,
};

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

async function expireSession(): Promise<void> {
  accessToken = null;
  await tokenStorage.clear();
  onSessionExpired?.();
}

function isTerminalAuthError(error: unknown): error is ApiClientError {
  return (
    error instanceof ApiClientError &&
    ['TOKEN_INVALID', 'TOKEN_EXPIRED', 'AUTH_REQUIRED'].includes(error.code)
  );
}

function toApiError(response: Response, payload: ApiResponse<unknown>): ApiClientError {
  const error = payload.error;
  return new ApiClientError(
    error?.code ?? 'INTERNAL',
    error?.message ?? `تعذر إكمال الطلب (${response.status})`,
    response.status,
    error?.fields
  );
}

async function parseEnvelope<T>(response: Response): Promise<ApiResponse<T>> {
  if (response.status === 204) {
    return { success: true, data: null, error: null, meta: null };
  }

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(
      'INTERNAL',
      'استجابة الخادم غير صالحة',
      response.status
    );
  }

  if (!response.ok || !payload.success || payload.data === null) {
    throw toApiError(response, payload as ApiResponse<unknown>);
  }

  return payload;
}

async function sendEnvelope<T>(
  path: string,
  method: string,
  body?: unknown,
  authenticated = true
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (authenticated && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError(
      'INTERNAL',
      'تعذر الاتصال بالخادم. تحقق من اتصالك ثم أعد المحاولة.',
      0
    );
  }

  return parseEnvelope<T>(response);
}

async function refreshSession(): Promise<void> {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new ApiClientError('TOKEN_INVALID', 'انتهت الجلسة، يرجى تسجيل الدخول.', 401);
  }

  const envelope = await sendEnvelope<LoginResponseDTO>(
    '/auth/refresh',
    'POST',
    { refreshToken },
    false
  );
  const response = envelope.data;
  if (!response) {
    throw new ApiClientError('TOKEN_INVALID', 'استجابة تجديد الجلسة غير صالحة', 401);
  }
  accessToken = response.accessToken;
  await tokenStorage.setRefreshToken(response.refreshToken);
}

async function refreshOnce(): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession()
      .catch(async (error: unknown) => {
        if (isTerminalAuthError(error)) {
          await expireSession();
        }
        throw error;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  await refreshInFlight;
}

async function requestEnvelope<T>(
  path: string,
  method: string,
  body?: unknown,
  authenticated = true
): Promise<ApiResponse<T>> {
  try {
    return await sendEnvelope<T>(path, method, body, authenticated);
  } catch (error) {
    if (
      authenticated &&
      error instanceof ApiClientError &&
      error.code === 'TOKEN_EXPIRED'
    ) {
      await refreshOnce();
      try {
        return await sendEnvelope<T>(path, method, body, true);
      } catch (retryError) {
        if (isTerminalAuthError(retryError)) {
          await expireSession();
        }
        throw retryError;
      }
    }
    if (authenticated && isTerminalAuthError(error)) {
      await expireSession();
    }
    throw error;
  }
}

async function request<T>(
  path: string,
  method: string,
  body?: unknown,
  authenticated = true
): Promise<T> {
  const envelope = await requestEnvelope<T>(path, method, body, authenticated);
  return envelope.data === null ? (undefined as T) : envelope.data;
}

function queryString(
  params: Record<string, string | number | boolean | undefined>
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const value = query.toString();
  return value ? `?${value}` : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTaskDTO(value: unknown): value is TaskDTO & Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value._id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.date === 'string' &&
    (value.status === 'todo' || value.status === 'done' || value.status === 'deferred')
  );
}

function normalizeDailyHabit(value: unknown): DailyHabitItemDTO {
  if (!isRecord(value)) {
    throw new ApiClientError('INTERNAL', 'عنصر عادة اليوم غير صالح', 200);
  }

  if (isRecord(value.habit)) {
    const log = isRecord(value.log) ? value.log : null;
    return {
      ...value.habit,
      logStatus:
        log && typeof log.status === 'string'
          ? (log.status as DailyHabitItemDTO['logStatus'])
          : 'pending',
      logId: log && typeof log._id === 'string' ? log._id : null,
    } as DailyHabitItemDTO;
  }

  return value as unknown as DailyHabitItemDTO;
}

function normalizeDaily(value: unknown): DailyResponseDTO {
  if (!isRecord(value) || !Array.isArray(value.habits)) {
    throw new ApiClientError(
      'INTERNAL',
      'شكل استجابة اليوم لا يطابق عقد الواجهة',
      200
    );
  }
  return {
    ...(value as unknown as DailyResponseDTO),
    habits: value.habits.map(normalizeDailyHabit),
  };
}

function normalizeList<T>(
  value: unknown,
  fallbackLimit: number,
  envelopeMeta?: ApiResponse<unknown>['meta']
): { items: T[]; meta: { page: number; limit: number; total: number } } {
  if (Array.isArray(value)) {
    return {
      items: value as T[],
      meta: {
        page: Number(envelopeMeta?.page ?? 1),
        limit: Number(envelopeMeta?.limit ?? fallbackLimit),
        total: Number(envelopeMeta?.total ?? value.length),
      },
    };
  }
  if (isRecord(value) && Array.isArray(value.items) && isRecord(value.meta)) {
    return {
      items: value.items as T[],
      meta: {
        page: Number(value.meta.page ?? 1),
        limit: Number(value.meta.limit ?? fallbackLimit),
        total: Number(value.meta.total ?? value.items.length),
      },
    };
  }
  throw new ApiClientError('INTERNAL', 'شكل القائمة المستلمة غير صالح', 200);
}

export const api = {
  login(input: LoginRequestDTO): Promise<LoginResponseDTO> {
    return request('/auth/login', 'POST', input, false);
  },

  /** إنشاء حساب جديد — يعيد الجلسة مباشرة (accessToken + refreshToken). */
  register(input: RegisterRequestDTO): Promise<LoginResponseDTO> {
    return request('/auth/register', 'POST', input, false);
  },

  me(): Promise<UserDTO> {
    return request('/auth/me', 'GET');
  },

  logout(): Promise<void> {
    return request('/auth/logout', 'POST');
  },

  updateProfile(input: UpdateProfileRequestDTO): Promise<UserDTO> {
    return request('/users/me', 'PUT', input);
  },

  getSettings(): Promise<UserSettingsDTO> {
    return request('/users/me/settings', 'GET');
  },

  updateSettings(settings: UpdateUserSettingsRequestDTO): Promise<UserSettingsDTO> {
    return request('/users/me/settings', 'PUT', settings);
  },

  async getDaily(date: string): Promise<DailyResponseDTO> {
    const result = await request<unknown>(
      `/daily${queryString({ date })}`,
      'GET'
    );
    return normalizeDaily(result);
  },

  async getEndOfDay(date: string): Promise<EndOfDayDisplayDTO> {
    const result = await request<unknown>(
      `/daily/end-of-day${queryString({ date })}`,
      'GET'
    );
    if (!isRecord(result)) {
      throw new ApiClientError('INTERNAL', 'شكل تقييم نهاية اليوم غير صالح', 200);
    }
    if (typeof result.ratePercent === 'number') {
      return result as unknown as EndOfDayDisplayDTO;
    }
    if (
      isRecord(result.endOfDay) &&
      typeof result.endOfDay.score === 'number'
    ) {
      const endOfDay = result.endOfDay;
      const score = result.endOfDay.score;
      return {
        date: typeof result.date === 'string' ? result.date : date,
        message:
          typeof endOfDay.message === 'string'
            ? endOfDay.message
            : null,
        backendScore: score,
        ratePercent:
          typeof endOfDay.ratePercent === 'number'
            ? endOfDay.ratePercent
            : score,
        pointsEarned:
          typeof endOfDay.pointsEarned === 'number'
            ? endOfDay.pointsEarned
            : undefined,
        pointsLost:
          typeof endOfDay.pointsLost === 'number'
            ? endOfDay.pointsLost
            : undefined,
        mood:
          endOfDay.mood === 'praise' ||
          endOfDay.mood === 'encourage' ||
          endOfDay.mood === 'blame'
            ? endOfDay.mood
            : undefined,
        backendPoints:
          isRecord(result.summary) && typeof result.summary.points === 'number'
            ? result.summary.points
            : undefined,
      };
    }
    throw new ApiClientError(
      'INTERNAL',
      'استجابة تقييم نهاية اليوم لا تطابق عقد الواجهة',
      200
    );
  },

  async listHabits(filters: {
    page?: number;
    limit?: number;
    type?: HabitDTO['type'];
    category?: HabitDTO['category'];
    timeSlot?: HabitDTO['timeSlot'];
    isHobby?: boolean;
    active?: boolean;
    search?: string;
  } = {}): Promise<HabitListDTO> {
    const envelope = await requestEnvelope<unknown>(
      `/habits${queryString(filters)}`,
      'GET'
    );
    const normalized = normalizeList<HabitDTO>(
      envelope.data,
      filters.limit ?? 20,
      envelope.meta
    );
    return normalized;
  },

  createHabit(input: HabitCreateRequestDTO): Promise<HabitDTO> {
    return request('/habits', 'POST', input);
  },

  updateHabit(id: string, input: HabitUpdateRequestDTO): Promise<HabitDTO> {
    return request(`/habits/${encodeURIComponent(id)}`, 'PUT', input);
  },

  deleteHabit(id: string): Promise<void> {
    return request(`/habits/${encodeURIComponent(id)}`, 'DELETE');
  },

  async getHabit(id: string): Promise<HabitDetailDTO> {
    const result = await request<unknown>(
      `/habits/${encodeURIComponent(id)}`,
      'GET'
    );
    if (isRecord(result) && isRecord(result.habit)) {
      return result as unknown as HabitDetailDTO;
    }
    if (isRecord(result) && isRecord(result.stats) && typeof result._id === 'string') {
      return {
        habit: result as unknown as HabitDTO,
        streak: isRecord(result.streak)
          ? (result.streak as HabitDetailDTO['streak'])
          : null,
        stats: result.stats as HabitDetailDTO['stats'],
      };
    }
    throw new ApiClientError(
      'INTERNAL',
      'استجابة تفاصيل العادة لا تتضمن الإحصاءات المتوقعة',
      200
    );
  },

  async getHabitHistory(id: string): Promise<HabitLogDTO[]> {
    const envelope = await requestEnvelope<unknown>(
      `/habits/${encodeURIComponent(id)}/history`,
      'GET'
    );
    return normalizeList<HabitLogDTO>(envelope.data, 100, envelope.meta).items;
  },

  createSeasonalSchedule(
    id: string,
    input: SeasonalScheduleRequestDTO
  ): Promise<{ day: string; remindDaysBefore: number }> {
    return request(
      `/habits/${encodeURIComponent(id)}/seasonal-schedule`,
      'POST',
      input
    );
  },

  createHabitLog(input: HabitLogCreateRequestDTO): Promise<HabitLogCreateResponseDTO> {
    return request('/habit-logs', 'POST', input);
  },

  updateHabitLog(
    id: string,
    input: { status?: HabitLogDTO['status']; note?: string }
  ): Promise<HabitLogDTO> {
    return request(`/habit-logs/${encodeURIComponent(id)}`, 'PUT', input);
  },

  async getPoints(): Promise<GamificationPointsDTO> {
    const envelope = await requestEnvelope<unknown>(
      `/gamification/points${queryString({ page: 1, limit: 20 })}`,
      'GET'
    );
    const result = envelope.data;
    if (isRecord(result) && Array.isArray(result.entries)) {
      const totalEarned =
        typeof result.totalEarned === 'number'
          ? result.totalEarned
          : undefined;
      const totalLost =
        typeof result.totalLost === 'number' ? result.totalLost : undefined;
      const net = typeof result.net === 'number' ? result.net : undefined;
      return {
        total: typeof result.total === 'number' ? result.total : null,
        entries: result.entries as PointEntryDTO[],
        meta: {
          ...(envelope.meta ?? {}),
          ...(totalEarned !== undefined ? { totalEarned } : {}),
          ...(totalLost !== undefined ? { totalLost } : {}),
          ...(net !== undefined ? { net } : {}),
        },
      };
    }
    if (Array.isArray(result)) {
      const meta = envelope.meta as GamificationPointsDTO['meta'];
      return {
        total: typeof meta?.net === 'number' ? meta.net : null,
        entries: result as PointEntryDTO[],
        meta: meta ?? undefined,
      };
    }
    throw new ApiClientError('INTERNAL', 'شكل بيانات النقاط غير صالح', 200);
  },

  async getStreaks(): Promise<StreakDTO[]> {
    const envelope = await requestEnvelope<unknown>('/gamification/streaks', 'GET');
    return normalizeList<StreakDTO>(envelope.data, 100, envelope.meta).items;
  },

  getGamificationStats(): Promise<GamificationStatsDTO> {
    return request('/gamification/stats', 'GET');
  },

  getGamificationLevels(): Promise<GamificationLevelsDTO> {
    return request('/gamification/levels', 'GET');
  },

  getProgressOverview(): Promise<ProgressOverviewDTO> {
    return request('/progress/overview', 'GET');
  },

  getProjectProgress(id: string): Promise<ProjectProgressDTO> {
    return request(`/progress/projects/${encodeURIComponent(id)}`, 'GET');
  },

  getDashboard(): Promise<DashboardDTO> {
    return request('/dashboard', 'GET');
  },

  getIntegrationStatus(): Promise<IntegrationStatusDTO> {
    return request('/integrations/status', 'GET');
  },

  saveGPSRoute(input: GPSRouteDTO): Promise<{ success: boolean; route?: GPSRouteDTO; message?: string }> {
    return request('/integrations/maps/route', 'POST', input);
  },

  async listTasks(filters: {
    date?: string;
    from?: string;
    to?: string;
    projectId?: string;
    status?: TaskDTO['status'];
    type?: TaskDTO['type'];
    page?: number;
    limit?: number;
  } = {}): Promise<{ items: TaskDTO[]; meta: { page: number; limit: number; total: number } }> {
    const envelope = await requestEnvelope<unknown>(
      `/tasks${queryString(filters)}`,
      'GET'
    );
    return normalizeList<TaskDTO>(envelope.data, filters.limit ?? 20, envelope.meta);
  },

  getTask(id: string): Promise<TaskDTO> {
    return request(`/tasks/${encodeURIComponent(id)}`, 'GET');
  },

  createTask(input: TaskCreateRequestDTO): Promise<TaskDTO> {
    return request('/tasks', 'POST', input);
  },

  updateTask(id: string, input: TaskUpdateRequestDTO): Promise<TaskDTO> {
    return request(`/tasks/${encodeURIComponent(id)}`, 'PUT', input);
  },

  deleteTask(id: string): Promise<void> {
    return request(`/tasks/${encodeURIComponent(id)}`, 'DELETE');
  },

  updateTaskStatus(
    id: string,
    input: TaskStatusUpdateDTO
  ): Promise<TaskDTO & { pointsDelta?: number }> {
    return request<unknown>(`/tasks/${encodeURIComponent(id)}/status`, 'PATCH', input)
      .then((result) => {
        if (isRecord(result) && isRecord(result.task)) {
          if (!isTaskDTO(result.task)) {
            throw new ApiClientError('INTERNAL', 'استجابة تحديث المهمة غير صالحة', 200);
          }
          return {
            ...result.task,
            ...(typeof result.pointsDelta === 'number' ? { pointsDelta: result.pointsDelta } : {}),
          };
        }
        if (isTaskDTO(result)) {
          return {
            ...result,
            ...(typeof result.pointsDelta === 'number' ? { pointsDelta: result.pointsDelta } : {}),
          };
        }
        throw new ApiClientError('INTERNAL', 'استجابة تحديث المهمة غير صالحة', 200);
      });
  },

  async listProjects(filters: { page?: number; limit?: number } = {}): Promise<{
    items: ProjectDTO[];
    meta: { page: number; limit: number; total: number };
  }> {
    const envelope = await requestEnvelope<unknown>(
      `/projects${queryString(filters)}`,
      'GET'
    );
    return normalizeList<ProjectDTO>(envelope.data, filters.limit ?? 20, envelope.meta);
  },

  createProject(input: ProjectCreateRequestDTO): Promise<ProjectDTO> {
    return request('/projects', 'POST', input);
  },

  getProject(id: string): Promise<ProjectDetailDTO> {
    return request(`/projects/${encodeURIComponent(id)}`, 'GET');
  },

  updateProject(id: string, input: ProjectUpdateRequestDTO): Promise<ProjectDTO> {
    return request(`/projects/${encodeURIComponent(id)}`, 'PUT', input);
  },

  deleteProject(id: string): Promise<void> {
    return request(`/projects/${encodeURIComponent(id)}`, 'DELETE');
  },

  getProjectAchievements(id: string): Promise<ProjectAchievementsDTO> {
    return request(`/projects/${encodeURIComponent(id)}/achievements`, 'GET');
  },

  async listProjectNodes(
    projectId: string,
    filters: {
      parentId?: string | null;
      type?: ProjectNodeDTO['type'];
      status?: ProjectNodeDTO['status'];
      page?: number;
      limit?: number;
    } = {}
  ): Promise<ProjectNodeDTO[]> {
    const query = {
      ...filters,
      parentId: filters.parentId === null ? 'null' : filters.parentId,
    };
    const envelope = await requestEnvelope<unknown>(
      `/projects/${encodeURIComponent(projectId)}/nodes${queryString(query)}`,
      'GET'
    );
    return normalizeList<ProjectNodeDTO>(envelope.data, filters.limit ?? 100, envelope.meta).items;
  },

  createProjectNode(
    projectId: string,
    input: ProjectNodeCreateRequestDTO
  ): Promise<ProjectNodeDTO> {
    return request(`/projects/${encodeURIComponent(projectId)}/nodes`, 'POST', input);
  },

  updateProjectNode(
    id: string,
    input: ProjectNodeUpdateRequestDTO
  ): Promise<ProjectNodeDTO> {
    return request(`/nodes/${encodeURIComponent(id)}`, 'PUT', input);
  },

  deleteProjectNode(id: string): Promise<void> {
    return request(`/nodes/${encodeURIComponent(id)}`, 'DELETE');
  },

  updateProjectNodeStatus(
    id: string,
    status: ProjectNodeDTO['status']
  ): Promise<ProjectNodeDTO> {
    return request(`/nodes/${encodeURIComponent(id)}/status`, 'PATCH', { status });
  },

  async listGoals(filters: {
    scope?: GoalDTO['scope'];
    projectId?: string;
    status?: GoalDTO['status'];
  } = {}): Promise<GoalDTO[]> {
    const envelope = await requestEnvelope<unknown>(
      `/goals${queryString(filters)}`,
      'GET'
    );
    return Array.isArray(envelope.data)
      ? envelope.data as GoalDTO[]
      : normalizeList<GoalDTO>(envelope.data, 100, envelope.meta).items;
  },

  createGoal(input: GoalCreateRequestDTO): Promise<GoalDTO> {
    return request('/goals', 'POST', input);
  },

  async getGoal(id: string): Promise<GoalDetailDTO> {
    const result = await request<unknown>(`/goals/${encodeURIComponent(id)}`, 'GET');
    if (isRecord(result) && isRecord(result.goal) && typeof result.progressPercent === 'number') {
      return result as unknown as GoalDetailDTO;
    }
    throw new ApiClientError('INTERNAL', 'استجابة تفاصيل الهدف غير صالحة', 200);
  },

  updateGoal(id: string, input: GoalUpdateRequestDTO): Promise<GoalDTO> {
    return request(`/goals/${encodeURIComponent(id)}`, 'PUT', input);
  },

  deleteGoal(id: string): Promise<void> {
    return request(`/goals/${encodeURIComponent(id)}`, 'DELETE');
  },

  async listCalendarEvents(filters: {
    from?: string;
    to?: string;
    type?: CalendarEventDTO['type'];
    projectId?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ items: CalendarEventDTO[]; meta: { page: number; limit: number; total: number } }> {
    const envelope = await requestEnvelope<unknown>(
      `/calendar/events${queryString(filters)}`,
      'GET'
    );
    return normalizeList<CalendarEventDTO>(envelope.data, filters.limit ?? 20, envelope.meta);
  },

  async getCalendarMain(from: string, to: string, projectId?: string): Promise<CalendarMainDTO> {
    const result = await request<unknown>(
      `/calendar/main${queryString({ from, to, ...(projectId ? { projectId } : {}) })}`,
      'GET'
    );
    if (
      isRecord(result) &&
      Array.isArray(result.past) &&
      Array.isArray(result.upcoming)
    ) {
      return result as unknown as CalendarMainDTO;
    }
    throw new ApiClientError('INTERNAL', 'استجابة الروزنامة الرئيسية غير صالحة', 200);
  },

  getCalendarEvent(id: string): Promise<CalendarEventDTO> {
    return request(`/calendar/events/${encodeURIComponent(id)}`, 'GET');
  },

  createCalendarEvent(input: CalendarEventCreateRequestDTO): Promise<CalendarEventDTO> {
    return request('/calendar/events', 'POST', input);
  },

  updateCalendarEvent(
    id: string,
    input: CalendarEventUpdateRequestDTO
  ): Promise<CalendarEventDTO> {
    return request(`/calendar/events/${encodeURIComponent(id)}`, 'PUT', input);
  },

  deleteCalendarEvent(id: string): Promise<void> {
    return request(`/calendar/events/${encodeURIComponent(id)}`, 'DELETE');
  },

  async listNotifications(filters: {
    unreadOnly?: boolean;
    type?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    items: NotificationDTO[];
    meta: { page: number; limit: number; total: number; unreadCount: number };
  }> {
    const envelope = await requestEnvelope<unknown>(
      `/notifications${queryString(filters)}`,
      'GET'
    );
    const envelopeData = envelope.data as { items?: NotificationDTO[]; meta?: Record<string, unknown> } | null;
    if (!envelopeData || !Array.isArray(envelopeData.items) || !envelopeData.meta) {
      throw new ApiClientError('INTERNAL', 'استجابة الإشعارات غير صالحة', 200);
    }
    return {
      items: envelopeData.items,
      meta: {
        page: Number(envelopeData.meta.page ?? 1),
        limit: Number(envelopeData.meta.limit ?? filters.limit ?? 20),
        total: Number(envelopeData.meta.total ?? envelopeData.items.length),
        unreadCount: Number(envelopeData.meta.unreadCount ?? 0),
      },
    };
  },

  async markNotificationRead(id: string): Promise<NotificationDTO> {
    const result = await request<unknown>(`/notifications/${encodeURIComponent(id)}/read`, 'PATCH');
    if (isRecord(result) && typeof result._id === 'string') {
      return result as unknown as NotificationDTO;
    }
    throw new ApiClientError('INTERNAL', 'استجابة تحديث الإشعار غير صالحة', 200);
  },

  async markAllNotificationsRead(): Promise<{ updatedCount: number }> {
    const result = await request<unknown>('/notifications/read-all', 'PATCH');
    if (isRecord(result) && typeof result.updatedCount === 'number') {
      return result as { updatedCount: number };
    }
    throw new ApiClientError('INTERNAL', 'استجابة تحديث كل الإشعارات غير صالحة', 200);
  },

  registerDeviceToken(input: { token: string; platform: 'web' | 'android' | 'ios' }): Promise<{ registered: boolean }> {
    return request('/notifications/device-token', 'POST', input);
  },

  /** مفتاح VAPID العام للإشعارات (Web Push) — يُطلب قبل إنشاء الاشتراك. */
  async getPushPublicKey(): Promise<string | null> {
    const result = await request<unknown>('/notifications/push/public-key', 'GET');
    if (isRecord(result) && (typeof result.publicKey === 'string' || result.publicKey === null)) {
      return result.publicKey;
    }
    return null;
  },

  /** تسجيل اشتراك Push عند الخادم. */
  subscribePush(subscription: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<{ subscribed: boolean }> {
    return request('/notifications/push/subscribe', 'POST', subscription);
  },

  /** إلغاء اشتراك Push عند الخادم. */
  unsubscribePush(endpoint: string): Promise<{ unsubscribed: boolean }> {
    return request('/notifications/push/unsubscribe', 'POST', { endpoint });
  },

  getReadingBooks(filters: Record<string, string | number | boolean | undefined> = {}): Promise<{
    items: unknown[];
    meta: { page: number; limit: number; total: number };
  }> {
    return request(`/reading/books${queryString(filters)}`, 'GET');
  },

  getReadingBook(id: string): Promise<unknown> {
    return request(`/reading/books/${encodeURIComponent(id)}`, 'GET');
  },

  createReadingBook(input: Record<string, unknown>): Promise<unknown> {
    return request('/reading/books', 'POST', input);
  },

  updateReadingBook(id: string, input: Record<string, unknown>): Promise<unknown> {
    return request(`/reading/books/${encodeURIComponent(id)}`, 'PUT', input);
  },

  listReadingNotes(id: string): Promise<unknown[]> {
    return request(`/reading/books/${encodeURIComponent(id)}/notes`, 'GET');
  },

  createReadingNote(id: string, input: Record<string, unknown>): Promise<unknown> {
    return request(`/reading/books/${encodeURIComponent(id)}/notes`, 'POST', input);
  },

  getQuranPlan(): Promise<unknown> {
    return request('/quran/plan', 'GET');
  },

  updateQuranPlan(input: Record<string, unknown>): Promise<unknown> {
    return request('/quran/plan', 'PUT', input);
  },

  getQuranNextSuggestion(): Promise<unknown> {
    return request('/quran/next', 'GET');
  },

  createQuranLog(input: Record<string, unknown>): Promise<unknown> {
    return request('/quran/logs', 'POST', input);
  },

  getQuranLogs(filters: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return request(`/quran/logs${queryString(filters)}`, 'GET');
  },

  getEnglishLevels(skill?: string): Promise<unknown> {
    return request(`/english/levels${skill ? queryString({ skill }) : ''}`, 'GET');
  },

  getEnglishProgress(): Promise<unknown> {
    return request('/english/progress', 'GET');
  },

  completeEnglishLevel(levelId: string, input: { score?: number } = {}): Promise<unknown> {
    return request(`/english/levels/${encodeURIComponent(levelId)}/complete`, 'POST', input);
  },

  listBrotherhoodStudents(filters: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return request(`/brotherhood/students${queryString(filters)}`, 'GET');
  },

  getBrotherhoodStudent(id: string): Promise<unknown> {
    return request(`/brotherhood/students/${encodeURIComponent(id)}`, 'GET');
  },

  createBrotherhoodStudent(input: Record<string, unknown>): Promise<unknown> {
    return request('/brotherhood/students', 'POST', input);
  },

  updateBrotherhoodStudent(id: string, input: Record<string, unknown>): Promise<unknown> {
    return request(`/brotherhood/students/${encodeURIComponent(id)}`, 'PUT', input);
  },

  deleteBrotherhoodStudent(id: string): Promise<void> {
    return request(`/brotherhood/students/${encodeURIComponent(id)}`, 'DELETE');
  },

  createBrotherhoodLesson(studentId: string, input: Record<string, unknown>): Promise<unknown> {
    return request(`/brotherhood/students/${encodeURIComponent(studentId)}/lessons`, 'POST', input);
  },

  createBrotherhoodExercise(studentId: string, input: Record<string, unknown>): Promise<unknown> {
    return request(`/brotherhood/students/${encodeURIComponent(studentId)}/exercises`, 'POST', input);
  },

  listBrotherhoodSessions(filters: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return request(`/brotherhood/sessions${queryString(filters)}`, 'GET');
  },

  createBrotherhoodSession(input: Record<string, unknown>): Promise<unknown> {
    return request('/brotherhood/sessions', 'POST', input);
  },

  deferBrotherhoodSession(id: string, input: Record<string, unknown> = {}): Promise<unknown> {
    return request(`/brotherhood/sessions/${encodeURIComponent(id)}/defer`, 'PATCH', input);
  },

  uploadBrotherhoodPhoto(studentId: string, formData: FormData): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return fetch(`${API_BASE_URL}/brotherhood/students/${encodeURIComponent(studentId)}/photos`, {
      method: 'POST',
      headers,
      body: formData,
    }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw toApiError(response, payload as ApiResponse<unknown>);
      }
      return payload.data;
    });
  },

  listMoneyEntries(filters: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return request(`/money/entries${queryString(filters)}`, 'GET');
  },

  createMoneyEntry(input: Record<string, unknown>): Promise<unknown> {
    return request('/money/entries', 'POST', input);
  },

  deleteMoneyEntry(id: string): Promise<void> {
    return request(`/money/entries/${encodeURIComponent(id)}`, 'DELETE');
  },

  getMoneySummary(): Promise<unknown> {
    return request('/money/summary', 'GET');
  },

  listMediaItems(filters: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return request(`/media/items${queryString(filters)}`, 'GET');
  },

  getMediaItem(id: string): Promise<unknown> {
    return request(`/media/items/${encodeURIComponent(id)}`, 'GET');
  },

  createMediaItem(input: Record<string, unknown>): Promise<unknown> {
    return request('/media/items', 'POST', input);
  },

  updateMediaItem(id: string, input: Record<string, unknown>): Promise<unknown> {
    return request(`/media/items/${encodeURIComponent(id)}`, 'PUT', input);
  },

  deleteMediaItem(id: string): Promise<void> {
    return request(`/media/items/${encodeURIComponent(id)}`, 'DELETE');
  },

  registerMediaWatch(id: string): Promise<unknown> {
    return request(`/media/items/${encodeURIComponent(id)}/watch`, 'POST');
  },

  fetchHasaniyaCards(input: Record<string, unknown> = {}): Promise<unknown> {
    return request('/hasaniya/fetch', 'POST', input);
  },

  listHasaniyaCards(filters: Record<string, string | number | boolean | undefined> = {}): Promise<unknown> {
    return request(`/hasaniya/cards${queryString(filters)}`, 'GET');
  },

  createHasaniyaCard(input: Record<string, unknown>): Promise<unknown> {
    return request('/hasaniya/cards', 'POST', input);
  },

  updateHasaniyaCard(id: string, input: Record<string, unknown>): Promise<unknown> {
    return request(`/hasaniya/cards/${encodeURIComponent(id)}`, 'PUT', input);
  },

  deleteHasaniyaCard(id: string): Promise<void> {
    return request(`/hasaniya/cards/${encodeURIComponent(id)}`, 'DELETE');
  },

  getHasaniyaStats(): Promise<unknown> {
    return request('/hasaniya/stats', 'GET');
  },

  async restoreSession(): Promise<UserDTO> {
    await refreshOnce();
    return api.me();
  },
};
