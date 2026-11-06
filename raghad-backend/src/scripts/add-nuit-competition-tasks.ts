import { Types } from 'mongoose';
import { connectDB, disconnectDB } from '../utils/db';
import { User } from '../modules/auth/models/User';
import { Project } from '../modules/projects/models/Project';
import { ProjectNode } from '../modules/projects/models/ProjectNode';
import { Task } from '../modules/tasks/models/Task';
import { z } from 'zod';

const CARD_TITLE = 'nuit de l\u2019info';
const TODAY = '2026-11-04';

const TASKS: string[] = [
  'بناء وثيقة الأدوار والمسؤوليات لكل عضو',
  'جدولة تدريب أسبوعي يحاكي بيئة المسابقة',
  'دراسة رابط التحديات + الموقع الرسمي وتصنيفها',
  'وضع معايير اختيار التحديات قبل المسابقة',
  'تحديد الـ Stack المناسب لكل نمط تحدٍّ',
  'حصر متطلبات كل تحدٍّ (رابط / عرض / فيديو)',
  'بناء خريطة الأدوات والتقنيات والتحقق من جاهزيتها',
  'دراسة مشاريع أعضاء الفريق والمشاركين الآخرين',
  'دراسة مشاريع الفائزين وطلب موادهم من CM',
  'تحديد عوامل الفوز وآلية التقييم (مقابلات + بحث)',
  'استخدام AI لتوقع تحديات العام بناءً على الأرشيف',
  'قراءة قوانين وإرشادات الموقع الرسمي كاملة',
  'معرفة المتطلبات الإلزامية (Accessibility، تسجيل الدخول، آلية الرفع)',
  'بناء نظام توزيع الأدوار والتوقيت وتنظيم العمل',
  'إعداد قائمة أسئلة لـ CM وقادة الفرق السابقين',
  'حجز أيام تدريب مكثفة في المعهد (يوم/يومين أسبوعياً)',
  'الحصول على تفاصيل تسجيل الفريق من الإدارة',
  'وضع خطة طوارئ',
];

const RULES_CONTENT = `1. الالتزام بموعد التسجيل النهائي للفريق وعدم التأخر عنه
2. قراءة قوانين المسابقة كاملة قبل البدء
3. عدم الاستعانة بأشخاص خارج الفريق في حل التحدي
4. الالتزام بالمدة الزمنية المحددة لكل تحدٍّ
6. تسليم المطلوب قبل انتهاء الوقت بساعات وليس في اللحظة الأخيرة
7. معرفة صيغة التسليم المطلوبة (رابط / ملف / عرض / فيديو)
8. التدرب مسبقا قبل المسابقة بأسابيع لضمان الاستعداد`;

const IDEAS: string[] = [
  'المحاكاة الكاملة: التدريب بنفس بيئة المسابقة (ضغط وقت، نفس الأدوات، نفس القيود) لا مجرد تدريب عادي',
  'بنك التحديات: تصنيف التحديات مسبقاً حسب (النمط، الوقت، الـ Stack، فرصة الفوز) لتقليل وقت الاختيار إلى دقائق',
  'قاعدة البيانات المعرفية: توثيق كل ما نتعلمه من مشاريع الآخرين والفائزين في مستند مرجعي موحد',
  'الاستباقية بالـ AI: تحليل أرشيف التحديات السابقة لاكتشاف الأنماط المتكررة وتوقع ما قد يأتي',
  'الجاهزية التقنية المسبقة: التأكد أن كل الأدوات تعمل قبل المسابقة بوقت كافٍ — لا مفاجآت يوم المسابقة',
  'التعلم من الفائزين مباشرة: التواصل مع CM للحصول على مواد الفائزين بدل الاعتماد على التخمين',
  'التدريب التشخيصي: كل تدريب يهدف لاكتشاف نقطة ضعف محددة وإصلاحها، لا مجرد "التدرب"',
  'خطة الطوارئ: وجود بديل جاهز لكل سيناريو (تعطل أداة، مرض عضو، ضيق وقت، فشل فكرة)',
  'الأسئلة الموجهة: الأسئلة محددة (عن التقييم، الأخطاء الشائعة، ما كانوا سيغيرونه) لا عامة',
  'الوثيقة الحية: وثيقة الأدوار تُحدَّث بعد كل تدريب بناءً على الأداء الفعلي',
];

function parseEmail(args: string[]): string {
  if (args.length !== 2 || args[0] !== '--email') {
    throw new Error('Usage: npm run nuit:tasks -- --email <email>');
  }

  return z.string().trim().email().parse(args[1]).toLowerCase();
}

async function main(): Promise<void> {
  const email = parseEmail(process.argv.slice(2));

  await connectDB();
  try {
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error(`User not found: ${email}`);
    }
    const userId = user._id as Types.ObjectId;

    let project = await Project.findOne({ userId, key: 'competitions' });
    if (!project) {
      project = await Project.create({
        userId,
        key: 'competitions',
        name: 'المسابقات',
        structureType: 'calendar_notes',
        description: 'روزنامة المسابقات مع أفكار كل مسابقة وقواعدها ومهامها.',
      });
      console.log('[Nuit] Created competitions project.');
    }

    // Find existing card whose title contains "nuit" (case-insensitive).
    let card = await ProjectNode.findOne({
      userId,
      projectId: project._id,
      type: 'card',
      parentId: null,
      title: { $regex: /nuit/i },
    });

    if (!card) {
      card = await ProjectNode.create({
        userId,
        projectId: project._id,
        parentId: null,
        type: 'card',
        title: CARD_TITLE,
        order: await ProjectNode.countDocuments({
          userId,
          projectId: project._id,
          type: 'card',
          parentId: null,
        }),
        status: 'todo',
        data: {
          date: TODAY,
          days: 1,
          endDate: TODAY,
        },
      });
      console.log('[Nuit] Created competition card:', CARD_TITLE);
    } else {
      if (!/nuit de l.info/i.test(card.title)) {
        card.title = CARD_TITLE;
        await card.save();
      }
      console.log('[Nuit] Found competition card:', card.title, String(card._id));
    }

    const cardId = card._id as Types.ObjectId;

    // Add tasks (idempotent).
    let addedTasks = 0;
    for (const [index, title] of TASKS.entries()) {
      const exists = await Task.findOne({ userId, nodeId: cardId, title });
      if (exists) continue;
      await Task.create({
        userId,
        title,
        type: 'project',
        projectId: project._id,
        nodeId: cardId,
        date: new Date(`${TODAY}T00:00:00.000Z`),
        status: 'todo',
        priority: 'medium',
        source: 'project',
        pointsReward: 1,
      });
      addedTasks += 1;
    }

    // Add ideas as notes (idempotent).
    let addedIdeas = 0;
    const existingIdeasCount = await ProjectNode.countDocuments({
      userId,
      projectId: project._id,
      parentId: cardId,
      type: 'note',
    });
    for (const [index, title] of IDEAS.entries()) {
      const exists = await ProjectNode.findOne({
        userId,
        projectId: project._id,
        parentId: cardId,
        type: 'note',
        title,
      });
      if (exists) continue;
      await ProjectNode.create({
        userId,
        projectId: project._id,
        parentId: cardId,
        type: 'note',
        title,
        order: existingIdeasCount + index,
        status: 'todo',
        data: { addedAt: TODAY },
      });
      addedIdeas += 1;
    }

    console.log(`[Nuit] Added ${addedTasks} new tasks (of ${TASKS.length}).`);
    // Upsert general rules note.
    const existingRules = await ProjectNode.findOne({
      userId,
      projectId: project._id,
      type: 'note',
      'data.fixed': 'rules',
    });
    if (existingRules) {
      existingRules.title = 'القواعد العامة';
      existingRules.data = {
        ...(existingRules.data ?? {}),
        fixed: 'rules',
        content: RULES_CONTENT,
        addedAt: new Date().toISOString(),
      };
      await existingRules.save();
      console.log('[Nuit] Updated general rules note.');
    } else {
      await ProjectNode.create({
        userId,
        projectId: project._id,
        parentId: null,
        type: 'note',
        title: 'القواعد العامة',
        order: 0,
        status: 'todo',
        data: { fixed: 'rules', content: RULES_CONTENT, addedAt: new Date().toISOString() },
      });
      console.log('[Nuit] Created general rules note.');
    }

    console.log(`[Nuit] Added ${addedIdeas} new ideas (of ${IDEAS.length}).`);
    console.log('[Nuit] Done.');
  } finally {
    await disconnectDB();
  }
}

main().catch((error: unknown) => {
  console.error('[Nuit] Failed:', error);
  process.exitCode = 1;
});
