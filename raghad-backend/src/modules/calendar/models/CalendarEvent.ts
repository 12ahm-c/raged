import mongoose, { Document, Schema, Types } from 'mongoose';

export type CalendarEventType = 'task' | 'habit' | 'project' | 'goal' | 'reminder' | 'custom';

export interface ICalendarEvent extends Document {
  userId: Types.ObjectId;
  title: string;
  date: Date;
  endDate?: Date | null;
  type: CalendarEventType;
  refId?: Types.ObjectId | null;
  projectId?: Types.ObjectId | null;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const calendarEventSchema = new Schema<ICalendarEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    endDate: { type: Date, default: null },
    type: {
      type: String,
      enum: ['task', 'habit', 'project', 'goal', 'reminder', 'custom'],
      default: 'custom',
    },
    refId: { type: Schema.Types.ObjectId, default: null },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    note: { type: String },
  },
  { timestamps: true }
);

calendarEventSchema.index({ userId: 1, date: 1 });
calendarEventSchema.index({ userId: 1, projectId: 1 });
calendarEventSchema.index(
  { userId: 1, type: 1, refId: 1 },
  { unique: true, partialFilterExpression: { refId: { $type: 'objectId' } } }
);

export const CalendarEvent = mongoose.model<ICalendarEvent>('CalendarEvent', calendarEventSchema);
