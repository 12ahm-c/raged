import mongoose, { Document, Schema, Types } from 'mongoose';

export type HabitType = 'daily' | 'seasonal';
export type HabitCategory = 'spiritual' | 'health' | 'study' | 'social' | 'financial' | 'other';
export type HabitTimeSlot = 'morning' | 'evening' | 'allTime' | 'flexible';
export type HabitSpecial =
  | 'none'
  | 'quran'
  | 'reading'
  | 'english'
  | 'exercise'
  | 'brotherhood'
  | 'family'
  | 'pockets'
  | 'programs'
  | 'money'
  | 'beek';

export interface ISeasonalSchedule {
  day: Date;
  remindDaysBefore: number;
}

export interface IHabit extends Document {
  userId: Types.ObjectId;
  name: string;
  type: HabitType;
  category: HabitCategory;
  timeSlot: HabitTimeSlot;
  isHobby: boolean;
  suggestedTime?: string;
  /** تفاصيل تنفيذ العادة كما وردت في notes.md (كيفيتها، مداها، شروطها). */
  details?: string;
  order: number;
  active: boolean;
  config: {
    special: HabitSpecial;
    /** الحصة تُطلب كل N يوم (1 = يوميًا). */
    everyN: number;
    /** أيام الأسبوع رسمية عطلة (0 = الأحد … 6 = السبت) فلا تُطلب فيها ولا تُخصم غيابًا. */
    restWeekdays: number[];
  };
  seasonalSchedule: ISeasonalSchedule[];
  pointsPerCompletion: number;
  pointsPenaltyIfMissed: number;
  createdAt: Date;
  updatedAt: Date;
}

const seasonalScheduleSchema = new Schema<ISeasonalSchedule>(
  {
    day: { type: Date, required: true },
    remindDaysBefore: { type: Number, default: 3, min: 0 },
  },
  { _id: false }
);

const habitSchema = new Schema<IHabit>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    type: { type: String, enum: ['daily', 'seasonal'], required: true },
    category: {
      type: String,
      enum: ['spiritual', 'health', 'study', 'social', 'financial', 'other'],
      default: 'other',
    },
    timeSlot: {
      type: String,
      enum: ['morning', 'evening', 'allTime', 'flexible'],
      default: 'flexible',
    },
    isHobby: { type: Boolean, default: false },
    suggestedTime: { type: String },
    details: { type: String, maxlength: 1000 },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true, index: true },
    config: {
      special: {
        type: String,
        enum: [
          'none',
          'quran',
          'reading',
          'english',
          'exercise',
          'brotherhood',
          'family',
          'pockets',
          'programs',
          'money',
          'beek',
        ],
        default: 'none',
      },
      everyN: { type: Number, default: 1, min: 1 },
      restWeekdays: { type: [Number], default: [] },
    },
    seasonalSchedule: { type: [seasonalScheduleSchema], default: [] },
    pointsPerCompletion: { type: Number, default: 1 },
    pointsPenaltyIfMissed: { type: Number, default: 1 },
  },
  { timestamps: true }
);

habitSchema.index({ userId: 1, type: 1, active: 1, order: 1 });
habitSchema.index({ userId: 1, category: 1, timeSlot: 1 });
habitSchema.index({ userId: 1, name: 'text' });

export const Habit = mongoose.model<IHabit>('Habit', habitSchema);
