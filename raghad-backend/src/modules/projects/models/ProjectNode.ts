import mongoose, { Document, Schema, Types } from 'mongoose';

export type ProjectNodeType = 'file' | 'board' | 'column' | 'card' | 'leaf' | 'note' | 'goal' | 'level';
export type ProjectNodeStatus = 'todo' | 'in_progress' | 'done';

export interface IProjectNode extends Document {
  userId: Types.ObjectId;
  projectId: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  type: ProjectNodeType;
  title: string;
  status: ProjectNodeStatus;
  order: number;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const projectNodeSchema = new Schema<IProjectNode>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'ProjectNode', default: null },
    type: {
      type: String,
      enum: ['file', 'board', 'column', 'card', 'leaf', 'note', 'goal', 'level'],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
    order: { type: Number, default: 0 },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

projectNodeSchema.index({ userId: 1, projectId: 1, parentId: 1 });
projectNodeSchema.index({ userId: 1, projectId: 1, order: 1 });

export const ProjectNode = mongoose.model<IProjectNode>('ProjectNode', projectNodeSchema);
