import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const dateString = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/));

export const habitBody = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(['daily', 'seasonal']),
  category: z.enum(['spiritual', 'health', 'study', 'social', 'financial', 'other']).default('other'),
  timeSlot: z.enum(['morning', 'evening', 'allTime', 'flexible']).default('flexible'),
  isHobby: z.boolean().default(false),
  suggestedTime: z.string().optional(),
  details: z.string().max(1000).optional(),
  order: z.number().int().optional(),
  config: z.object({
    special: z
      .enum([
        'none',
        'quran',
        'reading',
        'english',
        'exercise',
        'brotherhood',
        'family',
        'pockets',
        'programs',
        'money',
        'beek',
      ])
      .default('none'),
    everyN: z.number().int().min(1).max(30).default(1),
    restWeekdays: z.array(z.number().int().min(0).max(6)).default([]),
  }).default({ special: 'none', everyN: 1, restWeekdays: [] }),
  pointsPerCompletion: z.number().int().min(0).optional(),
  pointsPenaltyIfMissed: z.number().int().min(0).optional(),
});

export const createHabitSchema = z.object({ body: habitBody });
export const updateHabitSchema = z.object({ body: habitBody.partial() });
export const habitIdSchema = z.object({ params: z.object({ id: objectId }) });
export const seasonalScheduleSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    day: dateString,
    remindDaysBefore: z.number().int().min(0).default(3),
  }),
});

export const createHabitLogSchema = z.object({
  body: z.object({
    habitId: objectId,
    date: dateString.optional(),
    status: z.enum(['completed', 'missed', 'skipped', 'pending']).default('completed'),
    note: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export const updateHabitLogSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    status: z.enum(['completed', 'missed', 'skipped', 'pending']).optional(),
    note: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export const habitLogIdSchema = z.object({ params: z.object({ id: objectId }) });
