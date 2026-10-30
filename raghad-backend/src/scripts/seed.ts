import { Types } from 'mongoose';
import { User } from '../modules/auth/models/User';
import { Habit } from '../modules/habits/models/Habit';
import { Project } from '../modules/projects/models/Project';
import { Book } from '../modules/reading/reading.routes';
import { MediaItem } from '../modules/media/media.routes';
import { EnglishLevel } from '../modules/english/english.routes';
import { connectDB } from '../utils/db';

/**
 * بيانات البداية لتطبيق "رغد" كما هي موثقة في notes.md و cahier_charge.md:
 * - 22 عادة يومية + عادات موسمية.
 * - 7 مشاريع بهياكلها الصحيحة.
 * - 8 برامج بودكاست للمتابعة.
 * - الكتب المذكورة صراحةً في المرجع، مرتّبة كمستويات متتابعة.
 * السكربت آمن لإعادة التشغيل: لا يُنشئ ما هو موجود ولا يمسك تعديلاتك.
 */

interface SeedHabit {
  name: string;
  category: 'spiritual' | 'health' | 'study' | 'social' | 'financial' | 'other';
  timeSlot: 'morning' | 'evening' | 'allTime' | 'flexible';
  suggestedTime?: string;
  isHobby?: boolean;
  special?: 'none' | 'quran' | 'reading' | 'english' | 'exercise' | 'brotherhood' | 'family' | 'pockets' | 'programs' | 'money' | 'beek';
  /** تُطلب كل N يوم (1 = يوميًا). */
  everyN?: number;
  /** أيام عطلة رسمية (0 = الأحد … 6 = السبت). */
  restWeekdays?: number[];
  /** تفاصيل تنفيذ العادة كما وردت في notes.md (كيفيتها ومداها وشروطها). */
  details?: string;
}

/** العادات اليومية (22 عادة) بترتيب: صباحية → مسائية → مرونة → طوال الوقت، بتفاصيلها وتوقيتها المفضل من notes.md. */
const DAILY_HABITS: SeedHabit[] = [
  { name: 'الاستيقاظ المبكر', category: 'spiritual', timeSlot: 'morning', suggestedTime: '05:00', details: 'الساعة الخامسة فجرًا، بوضعها في النية، مع إحضار منبه ⏰.' },
  { name: 'قيام الليل', category: 'spiritual', timeSlot: 'morning', suggestedTime: '03:30', details: 'حزب كامل مع قراءة متأنية وخاشعة، وبرتداء ملابس خاصة به.' },
  { name: 'الدعاء', category: 'spiritual', timeSlot: 'morning', suggestedTime: '04:00', details: 'بعد القيام مباشرة، ويستحسن أن يكون في العتمة، دعاء ملح.' },
  { name: 'صلاة الفجر في المسجد', category: 'spiritual', timeSlot: 'morning', suggestedTime: '05:30', details: 'ارتداء ملابسه، والخشوع فيها.' },
  { name: 'الرياضة الصباحية', category: 'health', timeSlot: 'morning', suggestedTime: '06:30', special: 'exercise', details: 'مع الوالد إلى كرفور شارة، ويُستحسن مباشرة بعد صلاة الفجر إذا لم أكن ذاهبًا للجامعة في ذلك اليوم.' },
  { name: 'القرآن الكريم', category: 'spiritual', timeSlot: 'morning', suggestedTime: '07:00', special: 'quran', details: 'صباحًا قراءة ما نحفظه من القرآن، وفي الليل إضافة حزب جديد إلى قائمتنا (متابعة الحفظ).' },
  { name: 'الأذكار', category: 'spiritual', timeSlot: 'morning', suggestedTime: '06:00', details: 'قراءتهم من الهاتف في الصباح والمساء، ملءً للمرتين قبل قراءة القرآن.' },
  { name: 'تناول الإفطار', category: 'health', timeSlot: 'morning', suggestedTime: '08:00', details: 'أقوم بإعداده لنفسي.' },
  { name: 'الجلسة مع الأهل', category: 'social', timeSlot: 'evening', suggestedTime: '20:00', special: 'family', details: 'بعد إنهاء كل الأعمال، وقبل تناول العشاء أو في الضحى.' },
  { name: 'جلسة البيك', category: 'study', timeSlot: 'evening', suggestedTime: '19:00', special: 'beek', everyN: 2, details: 'نصف ساعة جلسة إبداع تختار موضوعًا محددًا تركّز عليه؛ توقيتها ليس ثابتًا بل تُختار وفق الظروف، وليست يومية بل كل يومين، في يوم ليست فيه مراجعة للطلاب.' },
  { name: 'البرامج', category: 'social', timeSlot: 'flexible', suggestedTime: '20:30', isHobby: true, special: 'programs', details: '40 دقيقة إلى ساعة من البرامج المختارة (بودكاست طارق السويدان، بودكاست مفضلة حتى لو مكررة، أيام الله، الشريعة والحياة، محيا رمضان، نايف بن نهار، مقابلات قادة المقاومة في غزة، بودكاست مفيدة).' },
  { name: 'الشفع والوتر', category: 'spiritual', timeSlot: 'evening', suggestedTime: '21:30', details: 'قبل النوم مباشرة: الشفع ثم الوتر، مع النية والخشوع.' },
  { name: 'جمع المصروف اليومي', category: 'financial', timeSlot: 'evening', suggestedTime: '21:00', special: 'money', details: 'نجمع من كل مصدر حلال، والإنفاق هذا العام سيقتصر على الضرورة، وكل ما يتعلق بالشهوات مرفوض (تابع لصندوق الادخار).' },
  { name: 'تدوين المذكرات', category: 'other', timeSlot: 'evening', suggestedTime: '22:30', details: 'كل ليلة قبل النوم.' },
  { name: 'النوم المبكر', category: 'health', timeSlot: 'evening', suggestedTime: '22:00', details: 'بعد العشاء مباشرة، أو الساعة 22 خارج المنزل لأن ذلك أحسن تهوية.' },
  { name: 'القراءة', category: 'study', timeSlot: 'flexible', isHobby: true, special: 'reading', details: 'ساعة كاملة، والهدف قراءة 100 كتاب لهذا العام من الكتب المختارة وفق الشروط والأقسام المعتمدة.' },
  { name: 'المطالعة التخصصية', category: 'study', timeSlot: 'flexible', suggestedTime: '10:00', isHobby: true, details: 'اشتراك في قنوات متخصصة، اقتناء كتب حديثة، قراءة مقالات يومية في مجالي، مدة 20–30 دقيقة (في الباص) — لتطوير المهارات والخيارات المطلوبة في سوق العمل.' },
  { name: 'المراجعة للأخوة', category: 'study', timeSlot: 'flexible', suggestedTime: '17:00', isHobby: true, special: 'brotherhood', details: 'أربعة أيام في الأسبوع: يومين للكبار ويومين للصغار، وتستغرق ساعة واحدة تُختار من ذلك اليوم.' },
  { name: 'النظافة الجسدية', category: 'health', timeSlot: 'flexible', suggestedTime: '09:00', isHobby: true, details: 'السواك بعد كل وجبة مباشرة بلا تأجيل، والاستحمام يوميًا في الصباح الباكر أو بعد الرجوع من المعهد — 30 دقيقة.' },
  { name: 'حصة الإنجليزية', category: 'study', timeSlot: 'flexible', suggestedTime: '18:00', isHobby: true, special: 'english', everyN: 2, restWeekdays: [0], details: 'ساعة واحدة تتعلم فيها مهارات اللغة الأربعة، وفق منهج الـ30 مستوى (A1→C1) — الجدول كل يومين وعطلة رسمية يوم الأحد، والهدف 3 مستويات كل أسبوع.' },
  { name: 'الأكل الصحي', category: 'health', timeSlot: 'allTime', details: 'اكتشاف طريقة تجعلني آكل أي غداء مهما كان (مثل أرز بالحوت الذي أكرهه) — فعائلتي تُعد طعامها حسب تفضيلهم لا تفضيلي — مع شراء فاكهة كالتفاح وأكلها أثناء عمل صعب ومركّز.' },
  { name: 'شرب الماء', category: 'health', timeSlot: 'allTime', details: 'وضع قنينة ماء بجانبي أملأها من جديد كل ساعة، وكوب كل نصف ساعة أثناء العمل.' },
];

const SEASONAL_HABITS: SeedHabit[] = [
  { name: 'صلة الأرحام', category: 'social', timeSlot: 'flexible' },
  { name: 'التواصل مع الأصدقاء', category: 'social', timeSlot: 'flexible' },
  { name: 'المشي', category: 'social', timeSlot: 'flexible' },
  { name: 'الذهاب للزيرة والخلوات منفردا', category: 'spiritual', timeSlot: 'flexible' },
  { name: 'السهر في الزيرة مع الأصحاب بعد إنجاز', category: 'social', timeSlot: 'evening' },
  { name: 'مشاهدة فيلم', category: 'social', timeSlot: 'evening' },
  { name: 'غسل الملابس', category: 'other', timeSlot: 'morning' },
  { name: 'رياضة الجري الليلي', category: 'health', timeSlot: 'evening' },
  { name: 'التقييم الأسبوعي', category: 'other', timeSlot: 'flexible' },
  { name: 'يوم الختم', category: 'spiritual', timeSlot: 'morning' },
];

interface SeedProject {
  key: 'lb' | 'supnum' | 'basma_tech' | 'competitions' | 'messages_gaza' | 'hasaniya' | 'ai_depth';
  name: string;
  structureType: 'notes_board' | 'tree_cards' | 'goals_pages' | 'calendar_notes' | 'level_game' | 'card_sets';
  description: string;
}

const PROJECTS: SeedProject[] = [
  { key: 'lb', name: 'مشروع LB', structureType: 'notes_board', description: 'ملفات (أهداف، خطط، ملاحظات) بنمط Notes مع صفحة مهام تلقائية.' },
  { key: 'supnum', name: 'المعهد العالي للرقمنة (SupNum)', structureType: 'tree_cards', description: 'بطاقات المواد، ولكل مادة شجرة مهام يمينًا ويسارًا.' },
  { key: 'basma_tech', name: 'مؤسسة بصمة تك', structureType: 'goals_pages', description: 'أهداف المؤسسة مع مهام كل هدف، وأفكار تطوير وتسويق وإقناع.' },
  { key: 'competitions', name: 'المسابقات', structureType: 'calendar_notes', description: 'روزنامة المسابقات مع أفكار كل مسابقة وقواعدها ومهامها.' },
  { key: 'messages_gaza', name: 'رسائل من غزة', structureType: 'level_game', description: 'لعبة تفاعلية بمستويات زمنية، مع عقوبة تأخير تجمع مهام المستوى.' },
  { key: 'hasaniya', name: 'مشروع الحسانية', structureType: 'card_sets', description: 'تنقيح جمل حسانية ومترجمة وأسئلة وأقواس من مصادر Hugging Face.' },
  { key: 'ai_depth', name: 'التعمق في الذكاء الاصطناعي', structureType: 'level_game', description: 'مسار تفاعلي بمستويات متدرجة لا يُفتح التالي إلا بإتمام السابق.' },
];

const PROGRAMS: { title: string; body: string; tags: string[] }[] = [
  { title: 'بودكاست طارق السويدان', body: 'حلقات لم تُشاهد بعد لطارق السويدان.', tags: ['بودكاست', 'تثقيف'] },
  { title: 'بودكاستي المفضلة', body: 'بودكاست مفضّلة حتى لو مكرّرة.', tags: ['بودكاست'] },
  { title: 'برنامج أيام الله', body: 'برنامج أيام الله.', tags: ['برنامج'] },
  { title: 'الشريعة والحياة', body: 'برنامج الشريعة والحياة.', tags: ['برنامج', 'ديني'] },
  { title: 'محيا رمضان', body: 'برنامج محيا رمضان.', tags: ['برنامج', 'موسمي'] },
  { title: 'بودكاست نايف بن نهار', body: 'بودكاست نايف بن نهار.', tags: ['بودكاست'] },
  { title: 'مقابلات وبودكاست لقادة المقاومة في غزة', body: 'مقابلات وبودكاست مع قادة المقاومة في غزة.', tags: ['بودكاست', 'غزة'] },
  { title: 'بودكاست مفيدة', body: 'بودكاست مفيدة.', tags: ['بودكاست'] },
];

/** الكتب المذكورة صراحة في notes.md، مرتّبة كمستويات متتابعة (لا يُفتح التالي إلا بإتمام السابق). */
const BOOKS: { title: string; author: string }[] = [
  // ١- روايات نجيب الكيلاني (الست الأساسية + باقي رواياته)
  { title: 'سراييفو وحبيبتي', author: 'نجيب الكيلاني' },
  { title: 'دموع الأمير', author: 'نجيب الكيلاني' },
  { title: 'تحت راية الإسلام', author: 'نجيب الكيلاني' },
  { title: 'النداء الخالد', author: 'نجيب الكيلاني' },
  { title: 'الرجل الذي آمن', author: 'نجيب الكيلاني' },
  { title: 'حكايات طبيب', author: 'نجيب الكيلاني' },
  { title: 'من دفاتر الحب والحنين', author: 'نجيب الكيلاني' },
  { title: 'رمال خليجية', author: 'نجيب الكيلاني' },
  // ٣- التاريخ الأوروبي
  { title: 'التاريخ الأوروبي الحديث من عصر النهضة إلى مؤتمر فيينا', author: 'مرجع تاريخي' },
  { title: 'أوروبا: تاريخ وجيز', author: 'مرجع تاريخي' },
  { title: 'قصة العرب في إسبانيا', author: 'مرجع تاريخي' },
  // ٤- كتب النهضة والمشاريع
  { title: 'من صفر إلى واحد', author: 'بيتر ثيل' },
  { title: 'طريق الشركات الناشئة', author: 'مرجع ريادي' },
  { title: 'كتاب إلى الجيل الصاعد', author: 'مرجع نهضوي' },
  // ٢- كتب الشيخ يوسف القرضاوي
  { title: 'الحلال والحرام في الإسلام', author: 'يوسف القرضاوي' },
  { title: 'في فقه الأولويات', author: 'يوسف القرضاوي' },
  { title: 'السياسة الشرعية في ضوء نصوص الشريعة ومقاصدها', author: 'يوسف القرضاوي' },
  { title: 'الإيمان والحياة', author: 'يوسف القرضاوي' },
  // ٧- كتب محمد الغزالي
  { title: 'مشكلات في طريق الحياة الإسلامية', author: 'محمد الغزالي' },
  { title: 'جدد حياتك', author: 'محمد الغزالي' },
  { title: 'نظرات في القرآن', author: 'محمد الغزالي' },
  { title: 'فقه الدعوة إلى الله', author: 'محمد الغزالي' },
  // ٥- كتب الأسير حسن سلامة
  { title: 'خمسة آلاف يوم في عالم البرزخ', author: 'عبد الرحمن حسن سلامة' },
  { title: 'ملحمة 14 عامًا في زنازين العزل', author: 'عبد الرحمن حسن سلامة' },
  { title: 'ثلاثة نفر', author: 'عبد الرحمن حسن سلامة' },
  // ٦- السيرة النبوية (ما لا تعرفه عن النبي ﷺ وكتب مماثلة)
  { title: 'ما لا نعرفه عن رسول الله ﷺ', author: 'حازم صلاح أبو إسماعيل' },
  { title: 'السيرة النبوية على ضوء القرآن والسنة', author: 'محمد أبو شهبة' },
  { title: 'السيرة المحمدية', author: 'محمد حسين هيكل' },
  // ٨- التاريخ والثقافة التركية
  { title: 'تاريخ الدولة العثمانية', author: 'يلماز أوزتونا' },
  { title: 'خواطر عثمانية', author: 'نور الله عماني' },
  { title: 'الفتح العثماني لمصر', author: 'رجب بلوط' },
  // ٩- كتب منتقاة لراشد الغنوشي
  { title: 'الديمقراطية وحقوق الإنسان في الإسلام', author: 'راشد الغنوشي' },
  { title: 'الحريات العامة في الدولة الإسلامية', author: 'راشد الغنوشي' },
  { title: 'مقاربات في العلمانية والمجتمع المدني', author: 'راشد الغنوشي' },
  // ١٠- كتب طارق السويدان
  { title: 'صناعة القائد', author: 'طارق السويدان' },
  { title: 'المنهج التربوي للرسول ﷺ', author: 'طارق السويدان' },
  { title: 'اختلافاتنا لا تفسد للود قضية', author: 'طارق السويدان' },
  // ١١- روايات أليف شافاق
  { title: 'قواعد العشق الأربعون', author: 'أليف شافاق' },
  { title: 'لقيطة إسطنبول', author: 'أليف شافاق' },
  { title: 'بنات حواء الثلاث', author: 'أليف شافاق' },
  { title: 'شرف', author: 'أليف شافاق' },
  // ١٢- كتب مالك بن نبي
  { title: 'شروط النهضة', author: 'مالك بن نبي' },
  { title: 'مشكلة الثقافة', author: 'مالك بن نبي' },
  { title: 'الظاهرة القرآنية', author: 'مالك بن نبي' },
  { title: 'مشكلات الحضارة', author: 'مالك بن نبي' },
  // ١٣- كتب جاسم سلطان
  { title: 'من الصحوة إلى اليقظة', author: 'جاسم سلطان' },
  { title: 'قوانين النهضة', author: 'جاسم سلطان' },
  { title: 'الجغرافيا والحلم العربي القادم: عندما تتحدث الجغرافيا', author: 'جاسم سلطان' },
  // ١٤- كتب نزار ريان
  { title: 'الشهادة والشهيد', author: 'نزار ريان' },
  { title: 'وفاة النبي ﷺ وأظلمت المدينة', author: 'نزار ريان' },
  { title: 'شرح كتاب الورع', author: 'نزار ريان' },
  // ١٥- كتب محمد زكي
  { title: 'مفاتيح القرب', author: 'محمد زكي الدين إبراهيم' },
  { title: 'أبجدية التصوف الإسلامي', author: 'محمد زكي الدين إبراهيم' },
  { title: 'يا ولدي', author: 'محمد زكي الدين إبراهيم' },
  // ١٦- كتب حسن الترابي
  { title: 'تجديد الفكر الإسلامي', author: 'حسن الترابي' },
  { title: 'السياسة والنظم السلطانية في الإسلام', author: 'حسن الترابي' },
  { title: 'المرأة بين الأصول والتقاليد', author: 'حسن الترابي' },
  // ١٨- كتب سلمان العودة
  { title: 'مع الله', author: 'سلمان العودة' },
  { title: 'كيف نختلف', author: 'سلمان العودة' },
  { title: 'الحقوق الأصلية في الإسلام', author: 'سلمان العودة' },
  // ١٩- كتب محمد المختار الشنقيطي
  { title: 'أحكام الجراحة الطبية والآثار المترتبة عليها', author: 'محمد المختار الشنقيطي' },
  { title: 'السنة السياسية في بناء السلطة وأدائها', author: 'محمد المختار الشنقيطي' },
  { title: 'الأزمة الدستورية في الحضارة الإسلامية من الفتنة الكبرى إلى الربيع العربي', author: 'محمد المختار الشنقيطي' },
  // ٢٠- كتب نايف بن نهار
  { title: 'مقدمة في علم العلاقات الدولية', author: 'نايف بن نهار' },
  { title: 'الديمقراطية كما هي', author: 'نايف بن نهار' },
  { title: 'دعوة التلازم المنطقي بين الإسلام والعلمانية', author: 'نايف بن نهار' },
  // ٢١- مصطفى صادق الرافعي
  { title: 'تاريخ القرآن الكريم', author: 'مصطفى صادق الرافعي' },
  { title: 'وحي القلم', author: 'مصطفى صادق الرافعي' },
  { title: 'مظاهر الإعجاز في القرآن', author: 'مصطفى صادق الرافعي' },
  // ٢٢- العقاد
  { title: 'الإسلام والعقلانية أوروبا', author: 'عباس محمود العقاد' },
  { title: 'عبقرية محمد', author: 'عباس محمود العقاد' },
  { title: 'عبقرية عثمان', author: 'عباس محمود العقاد' },
  { title: 'سيكولوجية الجماعات', author: 'عباس محمود العقاد' },
  // ٢٣- كتب السباعي
  { title: 'السيرة النبوية: دروس وعبر', author: 'مصطفى السباعي' },
  { title: 'السنة ومكانتها في التشريع الإسلامي', author: 'مصطفى السباعي' },
  { title: 'من روائع حضارتنا', author: 'مصطفى السباعي' },
  // ٢٤- كتب محمد أحمد الراشد
  { title: 'المنطلق', author: 'محمد أحمد الراشد' },
  { title: 'تنظيم التغيير', author: 'محمد أحمد الراشد' },
  { title: 'صناعة الحياة', author: 'محمد أحمد الراشد' },
  // ٢٥- كتب علي الصلابي
  { title: 'السيرة النبوية: البدايات والرسالات', author: 'علي الصلابي' },
  { title: 'خولة بنت الأزور', author: 'علي الصلابي' },
  { title: 'فارس بيت المقدس صلاح الدين', author: 'علي الصلابي' },
  // ٢٦- روايات أيمن العتوم
  { title: 'يا صاحبي السجن', author: 'أيمن العتوم' },
  { title: 'نفر من الجن', author: 'أيمن العتوم' },
  { title: 'يسمعون حسيسها', author: 'أيمن العتوم' },
  // ٢٧- كتابات عصام العطار
  { title: 'من بقايا الأيام', author: 'عصام العطار' },
  { title: 'أزمة روحية', author: 'عصام العطار' },
  // ٢٨- كتاب يوسف ندا (نحوله لترجمة ممتعة)
  { title: 'من داخل الإخوان المسلمين', author: 'يوسف ندا' },
  // كتب علي الطنطاوي
  { title: 'أيام من حياتي', author: 'علي الطنطاوي' },
  { title: 'الإسلام في مواجهة الشيوعية', author: 'علي الطنطاوي' },
  // ٣١- كتب مذكرات الشخصية
  { title: 'الأيام', author: 'طه حسين' },
  { title: 'رحلة ابن فطومة', author: 'نجيب محفوظ' },
  { title: 'الخبز الحافي', author: 'محمد شكري' },
  // ٢٩- كتب مرحلة الحركة والعمل الجماعي والمشاريع الخيرية والتنموية والشبابية والعمل النهضوي
  { title: 'نقطة التحول', author: 'مالكولم غلادويل' },
  { title: 'ابدأ بلماذا', author: 'سايمون سينك' },
  { title: 'عالم بلا فقر: دور الإقراض بالغ الصغر في التنمية', author: 'محمد يونس' },
  { title: 'الإسلام بين الشرق والغرب', author: 'علي عزت بيغوفيتش' },
  // ٣٠- باقة من أفضل الكتب العالمية
  { title: 'العادات السبع للناس الأكثر فعالية', author: 'ستيفن كوفي' },
  { title: 'الإنسان يبحث عن المعنى', author: 'فيكتور فرانكل' },
  { title: 'فن اللامبالاة', author: 'مارك مانسون' },
  { title: 'كيف تكسب الأصدقاء وتؤثر في الآخرين', author: 'ديل كارنيجي' },
  { title: 'العادة الذرية', author: 'جيمس كلير' },
  { title: 'مقدمة', author: 'ماركوس أوريليوس' },
];

type EnglishSkillKey = 'reading' | 'writing' | 'listening' | 'speaking';

/**
 * منهج الإنجليزية الكامل: 30 مستوى تصاعدي (A1 → C1)،
 * كل مستوى يحوي أربع مهارات (قراءة/كتابة/استماع/كلام) ويُشترط إتمامها للعبور،
 * والهدف: 3 مستويات كل أسبوع (عطلة رسمية يوم الأحد).
 */
const ENGLISH_LEVELS: {
  index: number;
  cefr: string;
  topic: string;
  tasks: Record<EnglishSkillKey, string>;
}[] = [
  { index: 1, cefr: 'A1', topic: 'التعريف بالنفس', tasks: {
    reading: 'اقرأ نص "My Name is…" (5–7 جمل: الاسم، العمر، البلد، المهنة).',
    writing: 'اكتب 5 جمل تعرّف فيها بنفسك (اسمك، عمرك، مدينتك، عملك/دراستك، هوايتك).',
    listening: 'استمع لمقطع 1 دقيقة: شخص يعرّف بنفسه ببطء.',
    speaking: 'حوار مع تطبيق: "عرّف بنفسك وأجب عن أسئلة بسيطة عن يومك."',
  } },
  { index: 2, cefr: 'A1', topic: 'العائلة', tasks: {
    reading: 'اقرأ نص "My Family" (أفراد الأسرة وأعمارهم).',
    writing: 'اكتب 5 جمل عن عائلتك (من هم؟ ماذا يعملون؟).',
    listening: 'استمع لمقطع 1 دقيقة: شخص يصف عائلته.',
    speaking: 'حوار: "تحدث عن عائلتك وأجب عن أسئلة عن إخوتك."',
  } },
  { index: 3, cefr: 'A1', topic: 'الروتين اليومي', tasks: {
    reading: 'اقرأ نص "My Daily Routine" (الاستيقاظ، العمل، النوم).',
    writing: 'اكتب 6 جمل عن روتينك اليومي باستخدام المضارع البسيط.',
    listening: 'استمع لمقطع 1.5 دقيقة: روتين يوم شخص.',
    speaking: 'حوار: "صف روتينك اليومي واسأل عن روتين الآخرين."',
  } },
  { index: 4, cefr: 'A1', topic: 'الطعام والشراب', tasks: {
    reading: 'اقرأ نص "At the Restaurant" (قائمة طعام وحوار طلب).',
    writing: 'اكتب 5 جمل عن طعامك المفضل ووجباتك.',
    listening: 'استمع لمقطع 1.5 دقيقة: طلب طعام في مطعم.',
    speaking: 'حوار: "اطلب طعاماً في مطعم وتحدث عن أطباقك المفضلة."',
  } },
  { index: 5, cefr: 'A2', topic: 'التسوق', tasks: {
    reading: 'اقرأ نص "Shopping for Clothes" (أسعار، مقاسات، دفع).',
    writing: 'اكتب 6 جمل عن آخر مرة تسوقت فيها.',
    listening: 'استمع لمقطع 2 دقيقة: حوار بائع ومشترٍ.',
    speaking: 'حوار: "اشترِ ملابس وتفاوض على السعر."',
  } },
  { index: 6, cefr: 'A2', topic: 'السفر', tasks: {
    reading: 'اقرأ نص "A Trip to the Airport" (إجراءات السفر).',
    writing: 'اكتب 7 جمل عن رحلة تريد القيام بها.',
    listening: 'استمع لمقطع 2 دقيقة: إعلان في مطار.',
    speaking: 'حوار: "اسأل عن رحلة في المطار واحجز تذكرة."',
  } },
  { index: 7, cefr: 'A2', topic: 'الوصف الماضي', tasks: {
    reading: 'اقرأ نص "My Last Weekend" (الماضي البسيط).',
    writing: 'اكتب 7 جمل عما فعلته الأسبوع الماضي.',
    listening: 'استمع لمقطع 2 دقيقة: شخص يروي عطلته.',
    speaking: 'حوار: "احكِ عن عطلتك الأخيرة وأجب عن أسئلة."',
  } },
  { index: 8, cefr: 'A2', topic: 'الصحة', tasks: {
    reading: 'اقرأ نص "At the Doctor" (أعراض ونصائح).',
    writing: 'اكتب 6 جمل عن عاداتك الصحية.',
    listening: 'استمع لمقطع 2 دقيقة: حوار طبيب ومريض.',
    speaking: 'حوار: "اشرح أعراضاً لطبيب واسأل عن نصائح."',
  } },
  { index: 9, cefr: 'A2', topic: 'الهوايات', tasks: {
    reading: 'اقرأ نص "Free Time Activities".',
    writing: 'اكتب 7 جمل عن هواياتك ولماذا تحبها.',
    listening: 'استمع لمقطع 2 دقيقة: شخص يتحدث عن هوايته.',
    speaking: 'حوار: "تحدث عن هواياتك واسأل عن هوايات الآخرين."',
  } },
  { index: 10, cefr: 'A2', topic: 'الاتجاهات والأماكن', tasks: {
    reading: 'اقرأ نص "Finding Your Way" (خرائط واتجاهات).',
    writing: 'اكتب 6 جمل تصف طريقك إلى مكان ما.',
    listening: 'استمع لمقطع 2 دقيقة: إعطاء اتجاهات.',
    speaking: 'حوار: "اسأل عن الطريق وأعطِ اتجاهات."',
  } },
  { index: 11, cefr: 'B1', topic: 'المستقبل والخطط', tasks: {
    reading: 'اقرأ نص "My Future Plans" (will / going to).',
    writing: 'اكتب 8 جمل عن خططك للسنة القادمة.',
    listening: 'استمع لمقطع 3 دقائق: شخص يتحدث عن أهدافه.',
    speaking: 'حوار: "تحدث عن خططك المستقبلية وأسبابها."',
  } },
  { index: 12, cefr: 'B1', topic: 'العمل والمهنة', tasks: {
    reading: 'اقرأ نص "Choosing a Career".',
    writing: 'اكتب 8 جمل عن وظيفتك المثالية ومتطلباتها.',
    listening: 'استمع لمقطع 3 دقائق: مقابلة عمل قصيرة.',
    speaking: 'حوار: "أجرِ مقابلة عمل قصيرة."',
  } },
  { index: 13, cefr: 'B1', topic: 'التعليم', tasks: {
    reading: 'اقرأ نص "Studying Abroad".',
    writing: 'اكتب 8 جمل عن تجربتك الدراسية وطموحك التعليمي.',
    listening: 'استمع لمقطع 3 دقائق: طالب يصف جامعته.',
    speaking: 'حوار: "تحدث عن دراستك وخططك الأكاديمية."',
  } },
  { index: 14, cefr: 'B1', topic: 'الرأي والمقارنة', tasks: {
    reading: 'اقرأ نص "City Life vs. Country Life".',
    writing: 'اكتب 8 جمل تقارن بين خيارين مع إبداء رأيك.',
    listening: 'استمع لمقطع 3 دقائق: نقاش بين شخصين.',
    speaking: 'حوار: "قارن بين خيارين ودافع عن رأيك."',
  } },
  { index: 15, cefr: 'B1', topic: 'المشاعر والتجارب', tasks: {
    reading: 'اقرأ نص "A Memorable Day".',
    writing: 'اكتب 8 جمل عن يوم لا تنساه ومشاعرك فيه.',
    listening: 'استمع لمقطع 3 دقائق: شخص يروي تجربة مؤثرة.',
    speaking: 'حوار: "احكِ تجربة مؤثرة وصف مشاعرك."',
  } },
  { index: 16, cefr: 'B1', topic: 'التكنولوجيا', tasks: {
    reading: 'اقرأ نص "Technology in Our Lives".',
    writing: 'اكتب 8 جمل عن استخدامك للتكنولوجيا وإيجابياتها وسلبياتها.',
    listening: 'استمع لمقطع 3 دقائق: بودكاست قصير عن التكنولوجيا.',
    speaking: 'حوار: "ناقش تأثير التكنولوجيا على حياتنا."',
  } },
  { index: 17, cefr: 'B1', topic: 'البيئة', tasks: {
    reading: 'اقرأ نص "Protecting the Environment".',
    writing: 'اكتب 8 جمل عن مشكلة بيئية وحلولها.',
    listening: 'استمع لمقطع 3 دقائق: تقرير بيئي مبسط.',
    speaking: 'حوار: "اقترح حلولاً لمشكلة بيئية."',
  } },
  { index: 18, cefr: 'B2', topic: 'الإقناع', tasks: {
    reading: 'اقرأ نص "The Art of Persuasion" (حجج وأدلة).',
    writing: 'اكتب 10 جمل تقنع فيها صديقاً بفكرة.',
    listening: 'استمع لمقطع 4 دقائق: خطاب إقناعي قصير.',
    speaking: 'حوار: "أقنع محاورك بوجهة نظرك."',
  } },
  { index: 19, cefr: 'B2', topic: 'الأخبار والإعلام', tasks: {
    reading: 'اقرأ مقالاً إخبارياً قصيراً (200 كلمة).',
    writing: 'لخّص المقال في 8 جمل مع رأيك.',
    listening: 'استمع لمقطع 4 دقائق: نشرة أخبار مبسطة.',
    speaking: 'حوار: "ناقش خبراً حديثاً وأثره."',
  } },
  { index: 20, cefr: 'B2', topic: 'الثقافة والاختلاف', tasks: {
    reading: 'اقرأ نص "Cultural Differences".',
    writing: 'اكتب 10 جمل عن اختلاف الثقافات وأهمية احترامها.',
    listening: 'استمع لمقطع 4 دقائق: شخص من ثقافة أخرى.',
    speaking: 'حوار: "ناقش الفروق الثقافية وتجاربك."',
  } },
  { index: 21, cefr: 'B2', topic: 'المشاكل الاجتماعية', tasks: {
    reading: 'اقرأ نص "Social Problems in Modern Cities".',
    writing: 'اكتب 10 جمل عن مشكلة اجتماعية وحلول مقترحة.',
    listening: 'استمع لمقطع 4 دقائق: نقاش اجتماعي.',
    speaking: 'حوار: "ناقش مشكلة اجتماعية واقترح حلولاً."',
  } },
  { index: 22, cefr: 'B2', topic: 'القيادة والعمل الجماعي', tasks: {
    reading: 'اقرأ نص "Leadership and Teamwork".',
    writing: 'اكتب 10 جمل عن صفات القائد الجيد.',
    listening: 'استمع لمقطع 4 دقائق: مدير يتحدث لفريقه.',
    speaking: 'حوار: "تحدث عن تجربة عمل جماعي وقيادة."',
  } },
  { index: 23, cefr: 'B2', topic: 'التفكير النقدي', tasks: {
    reading: 'اقرأ نص "Critical Thinking" (مغالطات وأدلة).',
    writing: 'اكتب 10 جمل تحلل فيها ادعاءً وتقيّمه.',
    listening: 'استمع لمقطع 4 دقائق: محاضرة قصيرة.',
    speaking: 'حوار: "حلّل فكرة وادعمها بأدلة."',
  } },
  { index: 24, cefr: 'B2', topic: 'ريادة الأعمال', tasks: {
    reading: 'اقرأ نص "Starting a Small Business".',
    writing: 'اكتب 10 جمل عن فكرة مشروعك وخطة تنفيذها.',
    listening: 'استمع لمقطع 4 دقائق: رائد أعمال يروي تجربته.',
    speaking: 'حوار: "اعرض فكرة مشروعك وأجب عن أسئلة المستثمر."',
  } },
  { index: 25, cefr: 'C1', topic: 'الكتابة الأكاديمية', tasks: {
    reading: 'اقرأ نصاً أكاديمياً قصيراً (250 كلمة).',
    writing: 'اكتب فقرة 120 كلمة بأسلوب أكاديمي (مقدمة/حجة/خاتمة).',
    listening: 'استمع لمحاضرة 5 دقائق.',
    speaking: 'حوار: "لخّص المحاضرة وناقش أفكارها."',
  } },
  { index: 26, cefr: 'C1', topic: 'العرض التقديمي', tasks: {
    reading: 'اقرأ نص "How to Give a Presentation".',
    writing: 'اكتب مخطط عرض تقديمي (5 نقاط).',
    listening: 'استمع لعرض تقديمي 5 دقائق.',
    speaking: 'حوار: "قدّم عرضاً قصيراً عن موضوع تختاره."',
  } },
  { index: 27, cefr: 'C1', topic: 'المفاوضة', tasks: {
    reading: 'اقرأ نص "Negotiation Skills".',
    writing: 'اكتب 10 جمل لسيناريو تفاوض.',
    listening: 'استمع لمقطع 5 دقائق: مفاوضة عمل.',
    speaking: 'حوار: "تفاوض على راتب أو اتفاق."',
  } },
  { index: 28, cefr: 'C1', topic: 'الفلسفة والقيم', tasks: {
    reading: 'اقرأ نص "Values and Ethics".',
    writing: 'اكتب 12 جملة عن قيمة تؤمن بها وحججك.',
    listening: 'استمع لمقطع 5 دقائق: نقاش فلسفي مبسط.',
    speaking: 'حوار: "ناقش قيمة أخلاقية من وجهات نظر مختلفة."',
  } },
  { index: 29, cefr: 'C1', topic: 'القيادة والتغيير', tasks: {
    reading: 'اقرأ نص "Leading Change".',
    writing: 'اكتب 12 جملة عن كيف تقود تغييراً في مؤسسة.',
    listening: 'استمع لمقطع 5 دقائق: قائد يتحدث عن التغيير.',
    speaking: 'حوار: "اقترح خطة تغيير ودافع عنها."',
  } },
  { index: 30, cefr: 'C1', topic: 'المشروع النهائي', tasks: {
    reading: 'اقرأ نصاً طويلاً (300–400 كلمة) في تخصصك.',
    writing: 'اكتب مقالاً 150–200 كلمة يلخص رؤيتك لمشروع أو فكرة.',
    listening: 'استمع لمقطع 6 دقائق: بودكاست متخصص.',
    speaking: 'حوار: "قدّم مشروعك النهائي في مقابلة تقييمية."',
  } },
];

async function upsertByFilter(model: any, filter: Record<string, unknown>, data: Record<string, unknown>): Promise<boolean> {
  const existing = await model.findOne(filter);
  if (existing) return false;
  await model.create(data);
  return true;
}

async function seedUserData(userId: Types.ObjectId): Promise<void> {
  const results: Record<string, number> = {
    'عادات يومية': 0,
    'عادات موسمية': 0,
    مشاريع: 0,
    برامج: 0,
    كتب: 0,
    'مستويات إنجليزية': 0,
  };

  for (const [index, habit] of DAILY_HABITS.entries()) {
    const created = await upsertByFilter(Habit, { userId, name: habit.name }, {
      userId,
      name: habit.name,
      type: 'daily',
      category: habit.category,
      timeSlot: habit.timeSlot,
      suggestedTime: habit.suggestedTime,
      details: habit.details,
      isHobby: habit.isHobby ?? false,
      order: index,
      config: {
        special: habit.special ?? 'none',
        everyN: habit.everyN ?? 1,
        restWeekdays: habit.restWeekdays ?? [],
      },
    });
    if (created) results['عادات يومية'] += 1;
  }

  for (const [index, habit] of SEASONAL_HABITS.entries()) {
    const created = await upsertByFilter(Habit, { userId, name: habit.name }, {
      userId,
      name: habit.name,
      type: 'seasonal',
      category: habit.category,
      timeSlot: habit.timeSlot,
      details: habit.details,
      isHobby: habit.isHobby ?? false,
      order: DAILY_HABITS.length + index,
      config: {
        special: habit.special ?? 'none',
        everyN: habit.everyN ?? 1,
        restWeekdays: habit.restWeekdays ?? [],
      },
    });
    if (created) results['عادات موسمية'] += 1;
  }

  for (const project of PROJECTS) {
    const created = await upsertByFilter(Project, { userId, key: project.key }, {
      userId,
      key: project.key,
      name: project.name,
      structureType: project.structureType,
      description: project.description,
    });
    if (created) results['مشاريع'] += 1;
  }

  for (const program of PROGRAMS) {
    const created = await upsertByFilter(MediaItem, { userId, kind: 'program', title: program.title }, {
      userId,
      kind: 'program',
      title: program.title,
      body: program.body,
      tags: program.tags,
    });
    if (created) results['برامج'] += 1;
  }

  // توزيع المستويات: كل كتاب يأخذ مستوى لم يشغله كتاب آخر (الفهرس {userId, level} فريد)،
  // والزرع يتعرّف على الكتب بعنوانها حتى لا تُكرر ولا تُمس كتب أضافها المستخدم بنفسه.
  const usedLevels = new Set<number>(
    (await Book.find({ userId }).select('level').lean<{ level: number }[]>()).map((row) => row.level)
  );
  for (const book of BOOKS) {
    const existing = await Book.findOne({ userId, title: book.title });
    if (existing) continue;
    let level = 1;
    while (usedLevels.has(level)) level += 1;
    const created = await upsertByFilter(Book, { userId, title: book.title }, {
      userId,
      title: book.title,
      author: book.author,
      level,
      status: level === 1 ? 'unlocked' : 'locked',
      pdfUrl: `https://example.com/books/level-${level}.pdf`,
      bookmarkPage: 1,
    });
    if (created) {
      usedLevels.add(level);
      results['كتب'] += 1;
    }
  }

  // منهج الإنجليزية: 30 مستوى × 4 مهارات (120 مستندًا)، التسلسل مقفل ما لم يُنجز المستخدم سابقًا.
  const ENGLISH_SKILLS: EnglishSkillKey[] = ['reading', 'writing', 'listening', 'speaking'];
  const SKILL_LABELS: Record<EnglishSkillKey, string> = {
    reading: 'القراءة',
    writing: 'الكتابة',
    listening: 'الاستماع',
    speaking: 'الكلام',
  };
  for (const level of ENGLISH_LEVELS) {
    for (const skill of ENGLISH_SKILLS) {
      const created = await upsertByFilter(
        EnglishLevel,
        { userId, skill, index: level.index },
        {
          userId,
          skill,
          index: level.index,
          title: `${level.topic} (${level.cefr}) — ${SKILL_LABELS[skill]}`,
          status: level.index === 1 ? 'unlocked' : 'locked',
          contentRef: level.tasks[skill],
          completedAt: null,
        }
      );
      if (created) results['مستويات إنجليزية'] += 1;
    }
  }

  for (const [label, count] of Object.entries(results)) {
    console.log(`[Seed] ${label}: أُضيف ${count} جديد (الموجود سابقًا لم يُمس).`);
  }
}

async function seed(): Promise<void> {
  await connectDB();

  if (process.argv.includes('--reset-password')) {
    const email = process.env.SEED_EMAIL?.trim().toLowerCase();
    const password = process.env.SEED_PASSWORD;

    if (!email || !password) {
      console.error('[Seed] Set SEED_EMAIL and SEED_PASSWORD to reset an owner password');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('[Seed] Password must be at least 8 characters');
      process.exit(1);
    }

    const user = await User.findOne({ email, role: 'owner' }).select('+passwordHash');
    if (!user) {
      console.error('[Seed] Owner account not found:', email);
      process.exit(1);
    }

    user.passwordHash = password;
    await user.save();
    console.log('[Seed] Owner password updated successfully:', user.email);
    process.exit(0);
  }

  const email = process.env.SEED_EMAIL ?? 'owner@example.com';
  const password = process.env.SEED_PASSWORD ?? 'password123';
  const name = process.env.SEED_NAME ?? 'Owner';

  if (password.length < 8) {
    console.error('[Seed] Password must be at least 8 characters');
    process.exit(1);
  }

  let owner = await User.findOne({ role: 'owner' });
  if (owner) {
    console.log('[Seed] Owner account already exists:', owner.email);
  } else {
    owner = await new User({
      name,
      email: email.toLowerCase(),
      passwordHash: password,
      role: 'owner',
      timezone: 'Africa/Nouakchott',
      settings: {
        theme: 'light',
        language: 'ar',
        notificationsEnabled: true,
        reminderLeadMinutes: 5,
      },
    }).save();
    console.log('[Seed] Owner account created successfully:', owner.email);
  }

  await seedUserData(owner._id as Types.ObjectId);
  console.log('[Seed] Done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Error:', err);
  process.exit(1);
});
