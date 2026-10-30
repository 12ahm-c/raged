import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const dateString = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/));

export const taskBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['manual', 'project', 'study', 'work', 'islamic']).default('manual'),
  projectId: objectId.nullable().optional(),
  nodeId: objectId.nullable().optional(),
  date: dateString,
  startTime: z.string().optional(),
  status: z.enum(['todo', 'done', 'deferred']).default('todo'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  source: z.enum(['recurring', 'manual', 'project']).default('manual'),
  pointsReward: z.number().int().min(0).default(1),
});

export const createTaskSchema = z.object({ body: taskBody });
export const updateTaskSchema = z.object({
  params: z.object({ id: objectId }),
  body: taskBody.partial(),
});
export const taskIdSchema = z.object({ params: z.object({ id: objectId }) });
export const updateTaskStatusSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({ status: z.enum(['todo', 'done', 'deferred']) }),
});
