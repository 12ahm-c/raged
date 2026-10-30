import mongoose, { Document, Schema, Types } from 'mongoose';

export type PointReason = 'habit_completed' | 'habit_missed' | 'task_done' | 'level_up' | 'penalty';
export type PointRefType = 'habit' | 'task' | 'project' | 'level';

export interface IPointLedger extends Document {
  userId: Types.ObjectId;
  date: Date;
  amount: number;
  reason: PointReason;
  refType: PointRefType;
  refId: Types.ObjectId | null;
  actionKey: string;
  note?: string;
  createdAt: Date;
}

const pointLedgerSchema = new Schema<IPointLedger>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    amount: { type: Number, required: true },
    reason: {
      type: String,
      enum: ['habit_completed', 'habit_missed', 'task_done', 'level_up', 'penalty'],
      required: true,
    },
    refType: { type: String, enum: ['habit', 'task', 'project', 'level'], required: true },
    refId: { type: Schema.Types.ObjectId, default: null },
    actionKey: { type: String, required: true },
    note: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

pointLedgerSchema.index({ userId: 1, date: 1, refType: 1 });
pointLedgerSchema.index({ userId: 1, actionKey: 1 }, { unique: true });

export const PointLedger = mongoose.model<IPointLedger>('PointLedger', pointLedgerSchema);
