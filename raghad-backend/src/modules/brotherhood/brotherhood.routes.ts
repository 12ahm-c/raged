import { Router, Response } from 'express';
import mongoose, { Document, Schema, Types } from 'mongoose';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { successResponse } from '../../utils/apiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { endOfDay, startOfDay } from '../../utils/date.util';
import { requireUserId } from '../../utils/request';

interface IStudent extends Document {
  userId: Types.ObjectId;
  name: string;
  group: 'senior' | 'junior';
  materials: string[];
  lessons: Types.DocumentArray<{ title: string; status: 'done' | 'pending' }>;
  exercises: Types.DocumentArray<{ title: string; done: boolean }>;
  photos: string[];
}

interface ISession extends Document {
  userId: Types.ObjectId;
  studentId: Types.ObjectId;
  date: Date;
  durationMinutes: number;
  note?: string;
  status: 'done' | 'deferred';
}

const studentSchema = new Schema<IStudent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    group: { type: String, enum: ['senior', 'junior'], required: true },
    materials: { type: [String], default: [] },
    lessons: { type: [{ title: String, status: { type: String, enum: ['done', 'pending'], default: 'pending' } }], default: [] },
    exercises: { type: [{ title: String, done: { type: Boolean, default: false } }], default: [] },
    photos: { type: [String], default: [] },
  },
  { timestamps: true }
);
studentSchema.index({ userId: 1, group: 1, name: 1 });

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'BrotherhoodStudent', required: true, index: true },
    date: { type: Date, required: true },
    durationMinutes: { type: Number, default: 60 },
    note: { type: String },
    status: { type: String, enum: ['done', 'deferred'], default: 'done' },
  },
  { timestamps: true }
);
sessionSchema.index({ userId: 1, date: 1, studentId: 1 });

export const BrotherhoodStudent = mongoose.model<IStudent>('BrotherhoodStudent', studentSchema);
export const BrotherhoodSession = mongoose.model<ISession>('BrotherhoodSession', sessionSchema);

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const studentBody = z.object({
  name: z.string().min(1),
  group: z.enum(['senior', 'junior']),
  materials: z.array(z.string()).default([]),
});

const router = Router();
router.use(authMiddleware);

router.post('/students', validate(z.object({ body: studentBody })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json(successResponse(await BrotherhoodStudent.create({ ...req.body, userId: requireUserId(req) })));
}));

router.get('/students', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filter: Record<string, unknown> = { userId: requireUserId(req) };
  if (typeof req.query.group === 'string') filter.group = req.query.group;
  if (typeof req.query.search === 'string') filter.name = { $regex: req.query.search, $options: 'i' };
  res.json(successResponse(await BrotherhoodStudent.find(filter).sort({ name: 1 })));
}));

router.get('/students/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const student = await BrotherhoodStudent.findOne({ _id: req.params.id, userId });
  if (!student) throw new AppError('NOT_FOUND', 404, 'Student not found');
  const sessions = await BrotherhoodSession.find({ userId, studentId: student._id }).sort({ date: -1 });
  res.json(successResponse({ student, sessions }));
}));

router.put('/students/:id', validate(z.object({ params: z.object({ id: objectId }), body: studentBody.partial().extend({
  lessons: z.array(z.object({ title: z.string(), status: z.enum(['done', 'pending']).default('pending') })).optional(),
  exercises: z.array(z.object({ title: z.string(), done: z.boolean().default(false) })).optional(),
  photos: z.array(z.string().url()).optional(),
}) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const student = await BrotherhoodStudent.findOneAndUpdate({ _id: req.params.id, userId: requireUserId(req) }, req.body, { new: true, runValidators: true });
  if (!student) throw new AppError('NOT_FOUND', 404, 'Student not found');
  res.json(successResponse(student));
}));

router.delete('/students/:id', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const student = await BrotherhoodStudent.findOneAndDelete({ _id: req.params.id, userId: requireUserId(req) });
  if (!student) throw new AppError('NOT_FOUND', 404, 'Student not found');
  await BrotherhoodSession.deleteMany({ userId: requireUserId(req), studentId: student._id });
  res.status(204).send();
}));

router.post('/students/:id/lessons', validate(z.object({ params: z.object({ id: objectId }), body: z.object({ title: z.string().min(1) }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const student = await BrotherhoodStudent.findOne({ _id: req.params.id, userId: requireUserId(req) });
  if (!student) throw new AppError('NOT_FOUND', 404, 'Student not found');
  student.lessons.push({ title: req.body.title, status: 'pending' });
  await student.save();
  res.status(201).json(successResponse(student.lessons[student.lessons.length - 1]));
}));

router.patch('/students/:id/lessons/:lessonId', validate(z.object({ params: z.object({ id: objectId, lessonId: objectId }), body: z.object({ status: z.enum(['done', 'pending']) }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const student = await BrotherhoodStudent.findOne({ _id: req.params.id, userId: requireUserId(req) });
  const lesson = student?.lessons.id(req.params.lessonId);
  if (!student || !lesson) throw new AppError('NOT_FOUND', 404, 'Lesson not found');
  lesson.status = req.body.status;
  await student.save();
  res.json(successResponse(lesson));
}));

router.post('/students/:id/exercises', validate(z.object({ params: z.object({ id: objectId }), body: z.object({ title: z.string().min(1) }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const student = await BrotherhoodStudent.findOne({ _id: req.params.id, userId: requireUserId(req) });
  if (!student) throw new AppError('NOT_FOUND', 404, 'Student not found');
  student.exercises.push({ title: req.body.title, done: false });
  await student.save();
  res.status(201).json(successResponse(student.exercises[student.exercises.length - 1]));
}));

router.post('/students/:id/photos', validate(z.object({ params: z.object({ id: objectId }), body: z.object({ url: z.string().url() }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const student = await BrotherhoodStudent.findOne({ _id: req.params.id, userId: requireUserId(req) });
  if (!student) throw new AppError('NOT_FOUND', 404, 'Student not found');
  student.photos.push(req.body.url);
  await student.save();
  res.status(201).json(successResponse({ url: req.body.url }));
}));

router.post('/sessions', validate(z.object({ body: z.object({
  studentId: objectId,
  date: z.string(),
  durationMinutes: z.number().int().min(1).default(60),
  note: z.string().optional(),
}) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = requireUserId(req);
  const student = await BrotherhoodStudent.findOne({ _id: req.body.studentId, userId });
  if (!student) throw new AppError('NOT_FOUND', 404, 'Student not found');
  res.status(201).json(successResponse(await BrotherhoodSession.create({ ...req.body, userId, date: new Date(req.body.date) })));
}));

router.patch('/sessions/:id/defer', validate(z.object({ params: z.object({ id: objectId }) })), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const session = await BrotherhoodSession.findOneAndUpdate({ _id: req.params.id, userId: requireUserId(req) }, { status: 'deferred' }, { new: true });
  if (!session) throw new AppError('NOT_FOUND', 404, 'Session not found');
  res.json(successResponse(session));
}));

router.get('/sessions', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const filter: Record<string, unknown> = { userId: requireUserId(req) };
  if (typeof req.query.studentId === 'string') filter.studentId = req.query.studentId;
  if (typeof req.query.from === 'string' || typeof req.query.to === 'string') {
    filter.date = {
      ...(typeof req.query.from === 'string' ? { $gte: startOfDay(new Date(req.query.from)) } : {}),
      ...(typeof req.query.to === 'string' ? { $lte: endOfDay(new Date(req.query.to)) } : {}),
    };
  }
  res.json(successResponse(await BrotherhoodSession.find(filter).sort({ date: 1 })));
}));

export default router;
