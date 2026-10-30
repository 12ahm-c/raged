import { describe, expect, it } from '@jest/globals';
import type { DailyResponseDTO } from '../types/dto';
import {
  optimisticallyCompleteHabit,
  reconcileCompletedHabit,
} from './dailyState';

const dailyFixture: DailyResponseDTO = {
  date: '2026-10-24T00:00:00.000Z',
  habits: [
    {
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
      logStatus: 'pending',
      logId: null,
    },
  ],
  tasks: [],
  summary: { totalItems: 1, completed: 0, points: 4 },
  endOfDay: { score: 0, message: null },
};

describe('daily optimistic habit state', () => {
  it('updates only the requested habit and does not calculate summary metrics', () => {
    const optimistic = optimisticallyCompleteHabit(dailyFixture, 'habit-id');

    expect(optimistic.habits[0].logStatus).toBe('completed');
    expect(optimistic.habits[0].logId).toBeNull();
    expect(optimistic.summary).toEqual(dailyFixture.summary);
    expect(dailyFixture.habits[0].logStatus).toBe('pending');
  });

  it('reconciles the optimistic item from the backend log response', () => {
    const optimistic = optimisticallyCompleteHabit(dailyFixture, 'habit-id');
    const reconciled = reconcileCompletedHabit(
      optimistic,
      'habit-id',
      'log-id',
      'completed'
    );

    expect(reconciled.habits[0]).toMatchObject({
      logStatus: 'completed',
      logId: 'log-id',
    });
    expect(reconciled.summary).toEqual(dailyFixture.summary);
  });
});
