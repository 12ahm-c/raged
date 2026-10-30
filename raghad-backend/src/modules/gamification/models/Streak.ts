import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IStreak extends Document {
  userId: Types.ObjectId;
  habitId: Types.ObjectId;
  current: number;
  longest: number;
  lastCompletedDate?: Date | null;
  updatedAt: Date;
}

const streakSchema = new Schema<IStreak>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    habitId: { type: Schema.Types.ObjectId, ref: 'Habit', required: true, index: true },
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastCompletedDate: { type: Date, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

streakSchema.index({ userId: 1, habitId: 1 }, { unique: true });

export const Streak = mongoose.model<IStreak>('Streak', streakSchema);
