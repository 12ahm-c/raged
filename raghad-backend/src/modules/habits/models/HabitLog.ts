import mongoose, { Document, Schema, Types } from 'mongoose';

export type HabitLogStatus = 'completed' | 'missed' | 'skipped' | 'pending';

export interface IHabitLog extends Document {
  userId: Types.ObjectId;
  habitId: Types.ObjectId;
  date: Date;
  status: HabitLogStatus;
  completedAt?: Date | null;
  points: number;
  note?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const habitLogSchema = new Schema<IHabitLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    habitId: { type: Schema.Types.ObjectId, ref: 'Habit', required: true, index: true },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ['completed', 'missed', 'skipped', 'pending'],
      required: true,
      default: 'completed',
    },
    completedAt: { type: Date, default: null },
    points: { type: Number, default: 0 },
    note: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

habitLogSchema.index({ habitId: 1, date: 1 }, { unique: true });
habitLogSchema.index({ userId: 1, date: 1, status: 1 });

export const HabitLog = mongoose.model<IHabitLog>('HabitLog', habitLogSchema);
