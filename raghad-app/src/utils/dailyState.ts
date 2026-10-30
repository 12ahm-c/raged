import type { DailyHabitItemDTO, DailyResponseDTO } from '../types/dto';

export function optimisticallyCompleteHabit(
  daily: DailyResponseDTO,
  habitId: string
): DailyResponseDTO {
  return {
    ...daily,
    habits: daily.habits.map((habit): DailyHabitItemDTO =>
      habit._id === habitId ? { ...habit, logStatus: 'completed' } : habit
    ),
  };
}

export function reconcileCompletedHabit(
  daily: DailyResponseDTO,
  habitId: string,
  logId: string,
  status: DailyHabitItemDTO['logStatus']
): DailyResponseDTO {
  return {
    ...daily,
    habits: daily.habits.map((habit) =>
      habit._id === habitId ? { ...habit, logStatus: status, logId } : habit
    ),
  };
}
