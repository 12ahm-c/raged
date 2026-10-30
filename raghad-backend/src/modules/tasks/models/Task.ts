import mongoose, { Document, Schema, Types } from 'mongoose';

export type TaskType = 'manual' | 'project' | 'study' | 'work' | 'islamic';
export type TaskStatus = 'todo' | 'done' | 'deferred';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskSource = 'recurring' | 'manual' | 'project';

export interface ITask extends Document {
  userId: Types.ObjectId;
  title: string;
  description?: string;
  type: TaskType;
  projectId?: Types.ObjectId | null;
  nodeId?: Types.ObjectId | null;
  date: Date;
  startTime?: string;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  pointsReward: number;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    type: { type: String, enum: ['manual', 'project', 'study', 'work', 'islamic'], default: 'manual' },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    nodeId: { type: Schema.Types.ObjectId, ref: 'ProjectNode', default: null },
    date: { type: Date, required: true },
    startTime: { type: String },
    status: { type: String, enum: ['todo', 'done', 'deferred'], default: 'todo' },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    source: { type: String, enum: ['recurring', 'manual', 'project'], default: 'manual' },
    pointsReward: { type: Number, default: 1 },
  },
  { timestamps: true }
);

taskSchema.index({ userId: 1, date: 1, status: 1 });
taskSchema.index({ userId: 1, projectId: 1 });

export const Task = mongoose.model<ITask>('Task', taskSchema);
