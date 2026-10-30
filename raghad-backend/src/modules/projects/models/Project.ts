import mongoose, { Document, Schema, Types } from 'mongoose';

export type ProjectKey =
  | 'lb'
  | 'supnum'
  | 'basma_tech'
  | 'competitions'
  | 'messages_gaza'
  | 'hasaniya'
  | 'ai_depth';
export type ProjectStructureType =
  | 'notes_board'
  | 'tree_cards'
  | 'goals_pages'
  | 'calendar_notes'
  | 'level_game'
  | 'card_sets';

export interface IProject extends Document {
  userId: Types.ObjectId;
  key: ProjectKey;
  name: string;
  structureType: ProjectStructureType;
  description?: string;
  active: boolean;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    key: {
      type: String,
      enum: ['lb', 'supnum', 'basma_tech', 'competitions', 'messages_gaza', 'hasaniya', 'ai_depth'],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    structureType: {
      type: String,
      enum: ['notes_board', 'tree_cards', 'goals_pages', 'calendar_notes', 'level_game', 'card_sets'],
      required: true,
    },
    description: { type: String },
    active: { type: Boolean, default: true },
    progress: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

projectSchema.index({ userId: 1, key: 1 }, { unique: true });

export const Project = mongoose.model<IProject>('Project', projectSchema);
