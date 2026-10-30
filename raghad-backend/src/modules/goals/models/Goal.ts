import mongoose, { Document, Schema, Types } from 'mongoose';

export type GoalScope = 'global' | 'project';
export type GoalStatus = 'active' | 'achieved' | 'paused';

export interface IGoal extends Document {
  userId: Types.ObjectId;
  title: string;
  scope: GoalScope;
  projectId?: Types.ObjectId | null;
  target: number;
  current: number;
  deadline?: Date | null;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
}

const goalSchema = new Schema<IGoal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    scope: { type: String, enum: ['global', 'project'], default: 'global' },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    target: { type: Number, required: true, min: 0 },
    current: { type: Number, default: 0, min: 0 },
    deadline: { type: Date, default: null },
    status: { type: String, enum: ['active', 'achieved', 'paused'], default: 'active' },
  },
  { timestamps: true }
);

goalSchema.index({ userId: 1, scope: 1, status: 1 });
goalSchema.index({ userId: 1, projectId: 1 });

export const Goal = mongoose.model<IGoal>('Goal', goalSchema);
