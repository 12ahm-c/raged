import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { api, setAccessToken } from './client';
import { tokenStorage } from './storage';

jest.mock('./storage', () => ({
  tokenStorage: {
    getRefreshToken: jest.fn(),
    setRefreshToken: jest.fn(),
    clear: jest.fn(),
  },
}));

function response(status: number, payload?: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => payload,
  } as Response;
}

describe('API client', () => {
  const fetchMock = jest.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >();

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = fetchMock;
    setAccessToken(null);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns data from the standard response envelope', async () => {
    const user = { _id: 'user-id', name: 'Raghad' };
    fetchMock.mockResolvedValueOnce(
      response(200, { success: true, data: user, error: null, meta: null })
    );

    await expect(api.me()).resolves.toEqual(user);
  });

  it('exposes documented API errors and field errors', async () => {
    fetchMock.mockResolvedValueOnce(
      response(400, {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'بيانات غير صالحة',
          fields: { email: 'البريد مطلوب' },
        },
        meta: null,
      })
    );

    await expect(api.login({ email: '', password: '' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
      fields: { email: 'البريد مطلوب' },
    });
  });

  it('refreshes once and retries a request with the new access token', async () => {
    const session = {
      accessToken: 'new-access',
      refreshToken: 'rotated-refresh',
      accessTokenExpiresAt: '2026-10-24T13:00:00.000Z',
      refreshTokenExpiresAt: '2026-10-31T13:00:00.000Z',
      user: { _id: 'user-id', name: 'Raghad' },
    };
    const user = { _id: 'user-id', name: 'Raghad' };
    jest.mocked(tokenStorage.getRefreshToken).mockResolvedValue('old-refresh');
    fetchMock
      .mockResolvedValueOnce(
        response(401, {
          success: false,
          data: null,
          error: { code: 'TOKEN_EXPIRED', message: 'expired' },
          meta: null,
        })
      )
      .mockResolvedValueOnce(
        response(200, { success: true, data: session, error: null, meta: null })
      )
      .mockResolvedValueOnce(
        response(200, { success: true, data: user, error: null, meta: null })
      );

    await expect(api.me()).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh');
    expect(fetchMock.mock.calls[2][1]?.headers).toMatchObject({
      Authorization: 'Bearer new-access',
    });
    expect(tokenStorage.setRefreshToken).toHaveBeenCalledWith('rotated-refresh');
  });

  it('clears stored credentials when refresh is rejected', async () => {
    jest.mocked(tokenStorage.getRefreshToken).mockResolvedValue('expired-refresh');
    fetchMock
      .mockResolvedValueOnce(
        response(401, {
          success: false,
          data: null,
          error: { code: 'TOKEN_EXPIRED', message: 'expired' },
          meta: null,
        })
      )
      .mockResolvedValueOnce(
        response(401, {
          success: false,
          data: null,
          error: { code: 'TOKEN_INVALID', message: 'invalid' },
          meta: null,
        })
      );

    await expect(api.me()).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
    expect(tokenStorage.clear).toHaveBeenCalledTimes(1);
  });

  it('sends contract-defined habit completion data', async () => {
    const result = {
      log: {
        _id: 'log-id',
        habitId: 'habit-id',
        date: '2026-10-24T00:00:00.000Z',
        status: 'completed',
      },
      pointsDelta: 1,
      streak: { current: 1, longest: 1 },
    };
    fetchMock.mockResolvedValueOnce(
      response(201, { success: true, data: result, error: null, meta: null })
    );
    setAccessToken('access-token');

    await expect(
      api.createHabitLog({
        habitId: 'habit-id',
        date: '2026-10-24T00:00:00.000Z',
        status: 'completed',
      })
    ).resolves.toEqual(result);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/habit-logs'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer access-token',
        }),
        body: JSON.stringify({
          habitId: 'habit-id',
          date: '2026-10-24T00:00:00.000Z',
          status: 'completed',
        }),
      })
    );
  });

  it('normalizes the backend daily habit wrapper without deriving summary values', async () => {
    const habit = {
      _id: 'habit-id',
      name: 'القراءة',
      type: 'daily',
      category: 'study',
      timeSlot: 'flexible',
      isHobby: false,
      suggestedTime: null,
      order: 1,
      active: true,
      config: { special: 'reading' },
      pointsPerCompletion: 1,
      pointsPenaltyIfMissed: 1,
    };
    fetchMock.mockResolvedValueOnce(
      response(200, {
        success: true,
        data: {
          date: '2026-10-24T00:00:00.000Z',
          habits: [{ habit, log: null }],
          tasks: [],
          summary: { totalItems: 1, completed: 0, points: 2 },
          endOfDay: { score: 0, message: 'ابدأ الآن' },
        },
        error: null,
        meta: null,
      })
    );

    const daily = await api.getDaily('2026-10-24T00:00:00.000Z');

    expect(daily.habits[0]).toMatchObject({
      _id: 'habit-id',
      logStatus: 'pending',
      logId: null,
    });
    expect(daily.summary).toEqual({ totalItems: 1, completed: 0, points: 2 });
  });

  it('uses documented filters and preserves top-level pagination metadata', async () => {
    const habit = {
      _id: 'habit-id',
      name: 'القراءة',
      type: 'daily',
      category: 'study',
      timeSlot: 'flexible',
      isHobby: false,
      suggestedTime: null,
      order: 1,
      active: true,
      config: { special: 'reading' },
      pointsPerCompletion: 1,
      pointsPenaltyIfMissed: 1,
    };
    fetchMock.mockResolvedValueOnce(
      response(200, {
        success: true,
        data: [habit],
        error: null,
        meta: { page: 2, limit: 10, total: 24 },
      })
    );

    const result = await api.listHabits({
      page: 2,
      limit: 10,
      type: 'daily',
      category: 'study',
      timeSlot: 'flexible',
      isHobby: false,
      active: true,
    });

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/habits?page=2&limit=10&type=daily&category=study&timeSlot=flexible&isHobby=false&active=true'
    );
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 24 });
  });

  it('normalizes task status responses and preserves server points delta', async () => {
    const task = {
      _id: 'task-id',
      title: 'مراجعة',
      description: null,
      type: 'study',
      projectId: null,
      nodeId: null,
      date: '2026-10-24T00:00:00.000Z',
      startTime: null,
      status: 'done',
      priority: 'medium',
      source: 'manual',
      pointsReward: 2,
    };
    fetchMock.mockResolvedValueOnce(
      response(200, {
        success: true,
        data: { task, pointsDelta: 2 },
        error: null,
        meta: null,
      })
    );
    setAccessToken('access-token');

    await expect(api.updateTaskStatus('task-id', { status: 'done' })).resolves.toMatchObject({
      _id: 'task-id',
      status: 'done',
      pointsDelta: 2,
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/tasks/task-id/status');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ status: 'done' }),
    });
  });

  it('builds task filters and returns paginated task metadata', async () => {
    fetchMock.mockResolvedValueOnce(
      response(200, {
        success: true,
        data: {
          items: [{
            _id: 'task-id',
            title: 'مراجعة',
            description: null,
            type: 'study',
            projectId: 'project-id',
            nodeId: null,
            date: '2026-10-24T00:00:00.000Z',
            startTime: '09:00',
            status: 'todo',
            priority: 'high',
            source: 'project',
            pointsReward: 1,
          }],
          meta: { page: 2, limit: 10, total: 15 },
        },
        error: null,
        meta: null,
      })
    );
    setAccessToken('access-token');

    const result = await api.listTasks({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-31T00:00:00.000Z',
      projectId: 'project-id',
      status: 'todo',
      type: 'study',
      page: 2,
      limit: 10,
    });

    expect(fetchMock.mock.calls[0][0]).toContain(
      '/tasks?from=2026-10-01T00%3A00%3A00.000Z&to=2026-10-31T00%3A00%3A00.000Z&projectId=project-id&status=todo&type=study&page=2&limit=10'
    );
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 15 });
    expect(result.items[0].title).toBe('مراجعة');
  });

  it('loads backend goal progress and calendar ranges without local calculations', async () => {
    const goal = {
      _id: 'goal-id',
      title: 'قراءة كتب',
      scope: 'global',
      projectId: null,
      target: 10,
      current: 3,
      deadline: null,
      status: 'active',
    };
    fetchMock
      .mockResolvedValueOnce(response(200, {
        success: true,
        data: { goal, progressPercent: 27 },
        error: null,
        meta: null,
      }))
      .mockResolvedValueOnce(response(200, {
        success: true,
        data: { past: [], upcoming: [] },
        error: null,
        meta: null,
      }));
    setAccessToken('access-token');

    await expect(api.getGoal('goal-id')).resolves.toEqual({ goal, progressPercent: 27 });
    await expect(api.getCalendarMain('2026-10-01', '2026-10-31')).resolves.toEqual({
      past: [],
      upcoming: [],
    });
    expect(fetchMock.mock.calls[1][0]).toContain(
      '/calendar/main?from=2026-10-01&to=2026-10-31'
    );
  });

  it('normalizes project pagination and constructs nested-node and calendar mutations', async () => {
    const project = {
      _id: 'project-id',
      key: 'lb',
      name: 'مشروع',
      structureType: 'tree_cards',
      description: null,
      active: true,
      progress: 12,
    };
    const node = {
      _id: 'node-id',
      projectId: 'project-id',
      parentId: null,
      type: 'card',
      title: 'بطاقة',
      status: 'todo',
      order: 0,
      data: {},
    };
    const event = {
      _id: 'event-id',
      title: 'موعد',
      date: '2026-10-24T00:00:00.000Z',
      endDate: null,
      type: 'project',
      refId: null,
      projectId: 'project-id',
      note: null,
    };
    fetchMock
      .mockResolvedValueOnce(response(200, {
        success: true,
        data: { items: [project], meta: { page: 1, limit: 10, total: 1 } },
        error: null,
        meta: null,
      }))
      .mockResolvedValueOnce(response(200, {
        success: true, data: [node], error: null, meta: null,
      }))
      .mockResolvedValueOnce(response(201, {
        success: true, data: node, error: null, meta: null,
      }))
      .mockResolvedValueOnce(response(201, {
        success: true, data: event, error: null, meta: null,
      }))
      .mockResolvedValueOnce(response(204));
    setAccessToken('access-token');

    await expect(api.listProjects({ page: 1, limit: 10 })).resolves.toMatchObject({
      items: [project],
      meta: { page: 1, limit: 10, total: 1 },
    });
    await expect(api.listProjectNodes('project-id', {
      parentId: null, status: 'todo', page: 1, limit: 20,
    })).resolves.toEqual([node]);
    await expect(api.createProjectNode('project-id', {
      parentId: null, type: 'card', title: 'بطاقة', order: 0,
    })).resolves.toEqual(node);
    await expect(api.createCalendarEvent({
      title: 'موعد',
      date: event.date,
      type: 'project',
      projectId: 'project-id',
    })).resolves.toEqual(event);
    await expect(api.deleteCalendarEvent('event-id')).resolves.toBeUndefined();

    expect(fetchMock.mock.calls[1][0]).toContain(
      '/projects/project-id/nodes?parentId=null&status=todo&page=1&limit=20'
    );
  });
});
