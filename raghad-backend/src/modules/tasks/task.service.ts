import { FilterQuery } from 'mongoose';
import { AppError } from '../../middlewares/error.middleware';
import { endOfDay, startOfDay } from '../../utils/date.util';
import { pageOptions } from '../../utils/request';
import { awardPoints, removePoints } from '../gamification/services/gamification.service';
import { ITask, Task } from './models/Task';

function normalizeBody(body: Record<string, any>): Record<string, unknown> {
  return { ...body, date: body.date ? startOfDay(new Date(body.date)) : undefined };
}

export async function createTask(userId: string, body: Record<string, any>): Promise<ITask> {
  const task = await Task.create({ ...normalizeBody(body), userId });
  if (task.status === 'done') await awardTaskPoints(userId, task);
  return task;
}

export async function listTasks(userId: string, query: Record<string, unknown>): Promise<unknown> {
  const filter: FilterQuery<ITask> = { userId };
  if (typeof query.date === 'string') filter.date = { $gte: startOfDay(new Date(query.date)), $lte: endOfDay(new Date(query.date)) };
  if (typeof query.from === 'string' || typeof query.to === 'string') {
    filter.date = {
      ...(typeof query.from === 'string' ? { $gte: startOfDay(new Date(query.from)) } : {}),
      ...(typeof query.to === 'string' ? { $lte: endOfDay(new Date(query.to)) } : {}),
    };
  }
  if (typeof query.projectId === 'string') filter.projectId = query.projectId;
  if (typeof query.status === 'string') filter.status = query.status;
  if (typeof query.type === 'string') filter.type = query.type;
  const { page, limit, skip } = pageOptions(query);
  const [items, total] = await Promise.all([
    Task.find(filter).sort({ date: 1, startTime: 1 }).skip(skip).limit(limit),
    Task.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total } };
}

export async function getTask(userId: string, id: string): Promise<ITask> {
  const task = await Task.findOne({ _id: id, userId });
  if (!task) throw new AppError('NOT_FOUND', 404, 'Task not found');
  return task;
}

export async function updateTask(userId: string, id: string, body: Record<string, any>): Promise<ITask> {
  const task = await Task.findOneAndUpdate({ _id: id, userId }, normalizeBody(body), {
    new: true,
    runValidators: true,
  });
  if (!task) throw new AppError('NOT_FOUND', 404, 'Task not found');
  if (body.status === 'done') await awardTaskPoints(userId, task);
  if (body.status && body.status !== 'done') await removePoints(userId, `task:${task._id}:done`);
  return task;
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  const task = await getTask(userId, id);
  await removePoints(userId, `task:${task._id}:done`);
  await task.deleteOne();
}

async function awardTaskPoints(userId: string, task: ITask): Promise<number> {
  if (task.pointsReward <= 0) return 0;
  return awardPoints({
    userId,
    date: task.date,
    amount: task.pointsReward,
    reason: 'task_done',
    refType: 'task',
    refId: task._id,
    actionKey: `task:${task._id}:done`,
  });
}

export async function updateTaskStatus(userId: string, id: string, status: ITask['status']): Promise<unknown> {
  const task = await getTask(userId, id);
  task.status = status;
  await task.save();
  const pointsDelta = status === 'done' ? await awardTaskPoints(userId, task) : 0;
  if (status !== 'done') await removePoints(userId, `task:${task._id}:done`);
  return { task, pointsDelta };
}
