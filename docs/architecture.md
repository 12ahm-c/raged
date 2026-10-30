# رغد — وثيقة المعمارية التقنية والتصميم النظامي (Architecture & System Design)

| البند | القيمة |
|---|---|
| **المنتج** | تطبيق «رغد» — نظام إدارة الحياة المتكامل |
| **النسخة** | MVP |
| **الوثيقة المرجعية** | `cahier_charge.md` (المصدر الأعلى للمتطلبات) |
| **الجمهور** | فريق التطوير + AI Agents |
| **الحالة** | وثيقة مرجعية معمارية أساسية — تُعتمد عليها المراحل اللاحقة |

> هذه الوثيقة تصف **كيف** سيُبنى تطبيق «رغد» تقنيًا اعتمادًا على ما هو موجود في `cahier_charge.md` فقط.
> أي قرار غير مستنتج مباشرةً من دفتر الشروط موثّق صراحةً كـ **Assumption** أو **Open Question**.

---

## جدول المحتويات

1. نظرة عامة
2. المبادئ المعمارية
3. المعمارية الطبقية
4. بنية المشاريع (Backend / Frontend)
5. مستخدمو النظام والأدوار
6. المكوّنات الرئيسية (وحدةً وحدةً)
7. نموذج البيانات (Collections)
8. العلاقات بين الكيانات
9. التدفقات الرئيسية
10. محرك التكرار والتجديد اليومي (Recurrence Engine)
11. محرك التحفيز (Gamification Engine)
12. الإشعارات والتذكيرات
13. الميزات الخاصة لكل عادة/مشروع
14. التكاملات الخارجية
15. أمن النظام
16. تصميم الـ API (مبادئ عامة)
17. المهام المجدولة (Cron Jobs)
18. الأداء والتخزين المؤقت
19. معمارية النشر (MVP)
20. المتطلبات غير الوظيفية
21. الحدود بين أجزاء النظام
22. نطاق MVP مقابل المراحل اللاحقة
23. الافتراضات والأسئلة المفتوحة

---

## 1. نظرة عامة

«رغد» تطبيق شخصي متكامل لإدارة الحياة يدمج — في نظام واحد — العادات والمهام والمشاريع والأهداف والروزنامة، بأسلوب تفاعلي تحفيزي على غرار **Duolingo**، مع استلهام وظيفي من **Trello + Notion + Habitica**.

الوظائف الجوهرية التي يجب أن يدعمها النظام:

- **إدارة العادات**: عادات يومية (23) تُسجَّل مرة واحدة وتتجدد تلقائيًا كل يوم، وعادات موسمية (11) تُفعَّل قرب نهاية كل شهر.
- **إدارة المهام اليومية**: مهام أساسية (دراسة، أعمال Nucleuse، عمل إسلامي) + مهام المشاريع + مهام يدوية، تُجمَّع في صفحة «يومي».
- **إدارة المشاريع**: 7 مشاريع، لكل مشروع بنية داخلية خاصة (لوحات، أشجار مهام، بطاقات، ألعاب مستويات…).
- **إدارة الأهداف وقياس التقدم**.
- **نظام تحفيزي**: نقاط، سلاسل (Streak)، معدّلات يومية/أسبوعية/شهرية، مستويات، تقييم يومي تفاعلي.
- **روزنامة رئيسية**: كل الأحداث السابقة والقادمة للتخطيط والاستعداد.
- **مكان للتنفيذ وليس تذكيرًا فقط**: قراءة PDF داخل التطبيق، حوار، تمارين، ألعاب مستويات.
- **تكاملات**: GPS للرياضة الصباحية، Hugging Face للمشروع «الحسانية»، عرض PDF، إشعارات FCM.

النظام **شخصي (Single-User)** مع تصميم يسمح بالتوسع لاحقًا دون إعادة بناء.

---

## 2. المبادئ المعمارية

| المبدأ | القرار | المبررات |
|---|---|---|
| **Monolithe modulaire** | خادم Node.js واحد مقسّم إلى وحدات مجال (domain modules) | سرعة التطوير، سهولة النشر، إمكانية التطور لعناصر مستقلة لاحقًا |
| **API-First** | كل الوظائف مكشوفة عبر REST موحّد | التطبيق واجهة واحدة (React Native/Expo) تعمل على Web وMobile وتشارك نفس الـ API |
| **Single-User أولًا** | نموذج مستخدم واحد (Owner) مع تصميم علاقات يقبل التوسع | مطابق لدفتر الشروط «نظام شخصي مع إمكانية التوسع لاحقًا» |
| **Gamification Core** | وحدة مستقلة للنقاط والسلاسل والمستويات تُخدِم كل الوحدات | النقاط والتقدم خاصية عرضية تمسّ العادات والمشاريع معًا |
| **Recurrence Engine** | محرّك مركزي لتوليد تكرار العادات/المهام | القيمة المبتكرة الأساسية: تسجيل مرة واحدة + تجدد يومي تلقائي |
| **Stateless Backend** | JWT للتوثيق | قابلية التوسع الأفقي وبساطة البنية |
| **NoSQL** | MongoDB (Atlas) | مرونة المخططات، ملاءمة للبيانات المتداخلة (سلاسل، بطاقات، سجلات) |
| **Offline-tolerant** | واجهة PWA/موبايل مع تخزين محلي مؤقت | العادات والمهام تُسجّل غالبًا في ظروف اتصال متغيّرة |
| **API-First + Contract-First** | العقد (`api-contract.md`) هو مصدر الحقيقة للتكامل | تمكين Frontend وBackend من العمل المتوازي |

> **Assumption A1**: المنصة «app web pwd» فُهمت على أنها **تطبيق ويب قابل للتثبيت (PWA)** بالإضافة إلى تطبيق موبايل عبر React Native. *(Open Question Q1)*

---

## 3. المعمارية الطبقية

```
┌───────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                        │
│  React Native + Expo (Web + Android + iOS)  ·  Zustand/RQ     │
│  Screens: يومي · عاداتي · مشاريعي · الأهداف · خريطة التقدم     │
│           الروزنامة · الإعدادات · صفحات التفصيل               │
├───────────────────────────────────────────────────────────────┤
│                      REST  (JSON over HTTPS)                  │
├───────────────────────────────────────────────────────────────┤
│                        API LAYER                              │
│        Express Routes + Middlewares + Validation (Zod)       │
├───────────────────────────────────────────────────────────────┤
│                   BUSINESS LOGIC LAYER                        │
│  Services: Habit · Task · Project · Goal · Calendar ·         │
│            Gamification · Recurrence · Reading · Quran ·      │
│            English · Brotherhood · Money · Notification       │
├───────────────────────────────────────────────────────────────┤
│                    DATA ACCESS LAYER                          │
│             Mongoose Models + Aggregations                    │
├───────────────────────────────────────────────────────────────┤
│                   EXTERNAL SERVICES LAYER                     │
│   FCM (إشعارات) · Maps (GPS) · Hugging Face (نصوص) · Cloud    │
│   Storage (PDF/صور)                                            │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. بنية المشاريع

### 4.1 Backend — بنية بالوحدات (Modules)

```
raghad-backend/
├── src/
│   ├── modules/
│   │   ├── auth/            (login, refresh, logout, me)
│   │   ├── user/            (profile, settings)
│   │   ├── habit/           (CRUD عادات + إعداداتها)
│   │   ├── habitLog/        (تنفيذ العادات + السلاسل + النقاط)
│   │   ├── task/            (مهام اليوم + المهام اليدوية/المشاريع)
│   │   ├── project/         (المشاريع + العقد/اللوحات/الملاحظات)
│   │   ├── projectNode/     (شجرة المهام/اللوحات/البطاقات)
│   │   ├── goal/            (الأهداف + التقدم)
│   │   ├── calendar/        (الأحداث والروزنامة)
│   │   ├── daily/           (تجميع صفحة «يومي»)
│   │   ├── gamification/    (النقاط + المستويات + التقييم اليومي)
│   │   ├── reading/         (الكتب + المستويات + PDF + الملاحظات)
│   │   ├── quran/           (خطة الحفظ الذكية)
│   │   ├── english/         (4 مهارات × مستويات)
│   │   ├── brotherhood/     (الطلاب + الجلسات + المواد)
│   │   ├── money/           (جمع المصروف)
│   │   ├── media/           (البرامج + سجل المشاهدة + المذكرات + الأفكار)
│   │   ├── hasaniya/        (بطاقات الحسانية + تكامل Hugging Face)
│   │   ├── notification/    (إشعارات in-app)
│   │   └── progress/        (خريطة التقدم + Dashboards)
│   ├── engine/
│   │   ├── recurrence.engine.ts   (توليد التكرار اليومي/الموسمي)
│   │   ├── streak.engine.ts       (حساب السلاسل)
│   │   └── points.engine.ts       (احتساب النقاط)
│   ├── jobs/
│   │   ├── dailyReset.job.ts      (تجديد يومي عند 00:00)
│   │   ├── seasonalActivation.job.ts (تفعيل العادات الموسمية)
│   │   ├── reminder.job.ts        (تذكيرات المواعيد)
│   │   ├── endOfDay.job.ts        (خصم النقاط + التقييم اليومي)
│   │   └── dailySummary.job.ts    (ملخص يومي)
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── validate.middleware.ts
│   │   └── error.middleware.ts
│   └── utils/
│       ├── apiResponse.ts
│       ├── jwt.util.ts
│       └── date.util.ts          (توقيت محلي/UTC)
├── app.ts
└── server.ts
```

### 4.2 Frontend — بنية (React Native + Expo)

```
raghad-app/
├── src/
│   ├── screens/
│   │   ├── auth/            Login.tsx
│   │   ├── daily/           Today.tsx
│   │   ├── habits/          Habits.tsx · HabitDetail.tsx
│   │   ├── projects/        Projects.tsx · ProjectDetail.tsx
│   │   ├── goals/           Goals.tsx
│   │   ├── progress/        ProgressMap.tsx
│   │   ├── calendar/        Calendar.tsx
│   │   └── settings/        Settings.tsx
│   ├── features/            (تفاصيل خاصة: reading، quran، english…)
│   ├── components/          ui/ · charts/ · gamification/
│   ├── layouts/             MainLayout.tsx
│   ├── navigation/          RootNavigator.tsx · TabNavigator.tsx
│   ├── hooks/               useAuth · useToday · useNotifications
│   ├── services/            api.ts · authService.ts · storage.ts
│   └── store/               authStore · todayStore · settingsStore
```

---

## 5. مستخدمو النظام والأدوار

| الفاعل | الدور | الوصف | إنشاء الحساب |
|---|---|---|---|
| **المالك (Owner)** | مستخدم واحد كامل الصلاحيات | يمتلك كل بياناته: العادات، المهام، المشاريع، الأهداف، الإعدادات | حساب أول (Seed عند التثبيت) |

- لا يوجد تسجيل عام (Sign-up) في الـ MVP.
- **Assumption A2**: نموذج الصلاحيات مبني على **حساب واحد (Owner)**؛ مع إبقاء حقل `role` جاهزًا في نموذج المستخدم للتوسع مستقبلًا (مثال: أفراد الأسرة/مدير). لم تُضف أي صلاحيات أخرى لعدم وجودها في دفتر الشروط.
- **Open Question Q2**: هل يتطلب التوسع المستقبلي أدوارًا (مثل «مدير» و«مستخدم عادي») ومشاركة بيانات؟ يُترك مفتوحًا.

---

## 6. المكوّنات الرئيسية (وحدةً وحدةً)

### 6.1 وحدة Auth
- تسجيل دخول بجلسة مستخدم واحد (بريد/معرّف + كلمة مرور).
- توليد JWT (access + refresh)، تجديد، خروج.
- **Open Question Q3**: طريقة الدخول الدقيقة (بريد إلكتروني؟ رمز؟ PIN؟) غير محددة في دفتر الشروط.

### 6.2 وحدة Habit (العادات)
- CRUD للعادات.
- تصنيف: `daily` (23) و `seasonal` (11).
- خصائص: الاسم، النوع، التصنيف الزمني (صباحي/مسائي/طوال الوقت/مرن)، الفئة (روحي/صحي/علمي/اجتماعي/مالي)، التوقيت المقترح، مؤشر «هواية» (يُنفّذ بعد الأساسيات فقط)، إعدادات خاصة (config).
- تجديد يومي: لا يُنشأ سجل جديد إلا عند الحاجة، بل يعتمد النظام على **Recurrence Engine** لعرض عادات اليوم.

### 6.3 وحدة HabitLog (سجل التنفيذ)
- سجل لكل (عادة × يوم): `status`, `completedAt`, `points`, `note`, `metadata`.
- احتساب السلاسل (Streak)، النجاح/الإخفاق، عدد أيام القيام.
- القاعدة التحفيزية: زر «تم التنفيذ» = +نقطة، وعدم التنفيذ قبل 23:00 = −نقطة.

### 6.4 وحدة Task (المهام)
- أنواع المهام: `manual` (يدوية)، `project` (مشروع)، `study`/`work`/`islamic` (المهام الأساسية اليومية).
- حقول: العنوان، الوصف، التاريخ/الوقت، الحالة، الأولوية، المشروع المرتبط.
- المهام الأساسية اليومية: دراسة جامعية (3 ساعات)، أعمال Nucleuse، العمل الإسلامي.

### 6.5 وحدة Daily (صفحة «يومي»)
- تجميع (Aggregation) عبر عدة مصادر: العادات الثابتة اليوم + مهام المشاريع المستحقة اليوم + المهام اليدوية.
- ترتيب زمني، تعديل/حذف، إشعارات قرب الوقت.
- نهاية اليوم: معدل + عبارة تقدير/تأنيب تفاعلية.

### 6.6 وحدة Project (المشاريع)
- 7 مشاريع، لكل مشروع `structureType` يحدد واجهته وبنيته الداخلية.
- جدول المشاريع:

| المشروع | Key | نوع البنية | المكوّنات |
|---|---|---|---|
| LB | `lb` | Notes + Board | ملفات (أهداف/خطط) + ملاحظات + لوحة مهام Trello-style |
| Supnum | `supnum` | Tree + Cards | بطاقة لكل مادة → شجرة؛ المهام أوراق يمين/يسار |
| بصمة تك | `basma_tech` | Goals + Pages | أهداف → مهام + صفحات: أفكار تطوير، تسويق، إقناع |
| المسابقات | `competitions` | Calendar + Notes | روزنامة (قادمة/سابقة) → Notes أفكار + قواعد + قائمة مهام |
| رسائل من غزة | `messages_gaza` | Level Game | مستويات بتاريخ ومدة، التأخير = عقوبة بجمع المهام، تقدم حتى 100% |
| الحسانية | `hasaniya` | Card Sets | جلب جمل من Hugging Face → تعديل/تنقيح → حفظ؛ بطاقات (حسانية/مترجمة/Q&A/قاموس) + إحصائية |
| التعمق في الذكاء الاصطناعي | `ai_depth` | Level Game | مستويات، لا يُكشف التالي إلا بإتمام الحالي |

- لكل مشروع: صفحة خاصة + مهام يومية (Calendrier خاص + العام + «يومي») + صفحة إنجازات خاصة وعامة.

### 6.7 وحدة ProjectNode
- نموذج شجري عام (`parentId`) يمثّل اللوحات، الأعمدة، البطاقات، الأوراق، العقد.
- الحقول: المشروع، الأب، النوع (`file|board|column|card|leaf|note`)، العنوان، الحالة، الترتيب، البيانات الخاصة.

### 6.8 وحدة Goal (الأهداف)
- أهداف عامة وأهداف مشاريع.
- نسبة تقدم محسوبة، تُعرض عند اللمس.

### 6.9 وحدة Calendar (الروزنامة)
- أحداث (سابقة/قادمة)، مرتبطة اختياريًا بمشروع/مهمة/عادة.
- روزنامة رئيسية + روزنامة لكل مشروع.

### 6.10 وحدة Gamification
- **Points Ledger**: سجل كل نقطة مكتسبة/مخصومة بتاريخها وسببها (شفافية — من قيم النظام).
- **Streak**: سلسلة أيام لكل عادة.
- **Metrics**: معدل أسبوعي منفصل لكل عادة/مهمة + معدل عام شهري + تقييم يومي.
- **Levels**: مستويات عامة تُفتح تدريجيًا (Nuolingo-style).

### 6.11 وحدة Reading (القراءة)
- كتب بهدف 100 كتاب/سنة، بنظام مستويات: كل مستوى = كتاب، لا يُفتح التالي إلا بإتمام السابق + كتابة ملاحظات.
- عرض PDF داخل التطبيق، علامة استرجاع (bookmark)، قائمة أبجدية، ملاحظات لكل كتاب.

### 6.12 وحدة Quran (القرآن)
- خطة حفظ ذكية: أول 25 حزبًا مراجعة، 15 التالية حزب/يوم، البقية حزب/أسبوع.
- تنظيم تلقائي بين الحفظ الجديد والمراجعة، سجل يومي (الحزب، المدة، التوقيت).

### 6.13 وحدة English (الإنجليزية)
- لعبة تفاعلية بمستويات × 4 مهارات: قراءة، كتابة، استماع، كلام.
- لا يُفتح مستوى إلا بإتمام السابق.
- **Assumption A3**: منهجية التعلم الفعلية «تُحدد بعد بحث» (ملحق د) — تُترك كنقطة تفصيلية تُملأ لاحقًا.
- **Open Question Q4**: تطبيق الحوار/الكلام المختص (تكامل خارجي) غير محدد.

### 6.14 وحدة Brotherhood (المراجعة للأخوة)
- 4 أيام/أسبوع (2 كبار + 2 صغار)، ساعة لكل جلسة.
- قائمة الطلاب + صفحة لكل طالب (المواد، الدروس، التمارين، التصوير).
- إشعار قبل 5 دقائق + زر تأجيل.

### 6.15 وحدة Money (جمع المصروف)
- زر إضافة مبلغ + ملاحظة + قائمة سابقة + إحصائية إجمالي.
- المصادر الحلال، الإنفاق للضرورة فقط.

### 6.16 وحدة Media
- **البرامج**: قائمة برامج + سجل مشاهدة.
- **تدوين المذكرات**: محرر نصوص + أرشيف.
- **جلسة البيك**: Noté بقائمة المشاريع + ملاحظات وأفكار.

### 6.17 وحدة Hasaniya (تكامل Hugging Face)
- جلب جمل → تعديل/تنقيح → علامة مرجعية → حفظ ورفع.
- بطاقات: جمل حسانية / مترجمة / Q&A / قاموس + إحصائية عدد.

### 6.18 وحدة Notification
- توليد إشعارات in-app + تذكيرات مواعيد + ملخص يومي.
- قنوات: in-app وFCM (حسب دفتر الشروط: Firebase Cloud Messaging).

### 6.19 وحدة Progress (خريطة التقدم)
- **المشاريع**: نسبة تحقيق الأهداف.
- **العادات**: التنفيذ اليومي + النقاط.
- Dashboards مُجمّعة.

---

## 7. نموذج البيانات (Collections)

> جميع المعرّفات `ObjectId`، والتواريخ UTC ISO-8601، والنقاط أعداد صحيحة.

### 7.1 `users`
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string (unique)",
  "passwordHash": "string",
  "role": "owner",
  "timezone": "string (default: Africa/Nouakchott)",
  "settings": {
    "theme": "light|dark",
    "language": "ar",
    "notificationsEnabled": true,
    "reminderLeadMinutes": 5
  },
  "createdAt": "Date",
  "lastActiveAt": "Date"
}
```

### 7.2 `habits`
```json
{
  "_id": "ObjectId",
  "name": "string",
  "type": "daily|seasonal",
  "category": "spiritual|health|study|social|financial|other",
  "timeSlot": "morning|evening|allTime|flexible",
  "isHobby": false,
  "suggestedTime": "string (HH:mm, optional)",
  "order": 0,
  "active": true,
  "config": {
    "special": "none|quran|reading|english|exercise|brotherhood|family|pockets|programs|money|beek"
  },
  "pointsPerCompletion": 1,
  "pointsPenaltyIfMissed": 1,
  "createdAt": "Date"
}
```

### 7.3 `habit_logs`
```json
{
  "_id": "ObjectId",
  "habitId": "ObjectId",
  "date": "Date (00:00 local)",
  "status": "completed|missed|skipped|pending",
  "completedAt": "Date|null",
  "points": 1,
  "note": "string",
  "metadata": {
    "hizb": "string", "durationMinutes": 30,
    "distanceKm": 3.2, "route": [ { "lat": 18.0, "lng": -15.9 } ],
    "bookId": "ObjectId", "levelId": "ObjectId"
  },
  "createdAt": "Date"
}
```
Index: `habitId` + `date` (unique).

### 7.4 `tasks`
```json
{
  "_id": "ObjectId",
  "title": "string",
  "description": "string",
  "type": "manual|project|study|work|islamic",
  "projectId": "ObjectId|null",
  "nodeId": "ObjectId|null",
  "date": "Date",
  "startTime": "string (HH:mm)",
  "status": "todo|done|deferred",
  "priority": "low|medium|high",
  "source": "recurring|manual|project",
  "pointsReward": 1,
  "createdAt": "Date"
}
```
Index: `date`, `projectId`, `status`.

### 7.5 `projects`
```json
{
  "_id": "ObjectId",
  "key": "lb|supnum|basma_tech|competitions|messages_gaza|hasaniya|ai_depth",
  "name": "string",
  "structureType": "notes_board|tree_cards|goals_pages|calendar_notes|level_game|card_sets",
  "description": "string",
  "active": true,
  "progress": 0,
  "createdAt": "Date"
}
```

### 7.6 `project_nodes`
```json
{
  "_id": "ObjectId",
  "projectId": "ObjectId",
  "parentId": "ObjectId|null",
  "type": "file|board|column|card|leaf|note|goal|level",
  "title": "string",
  "status": "todo|in_progress|done",
  "order": 0,
  "data": { }
}
```
Index: `projectId`, `parentId`.

### 7.7 `goals`
```json
{
  "_id": "ObjectId",
  "title": "string",
  "scope": "global|project",
  "projectId": "ObjectId|null",
  "target": 100,
  "current": 40,
  "deadline": "Date|null",
  "status": "active|achieved|paused",
  "createdAt": "Date"
}
```

### 7.8 `calendar_events`
```json
{
  "_id": "ObjectId",
  "title": "string",
  "date": "Date",
  "endDate": "Date|null",
  "type": "task|habit|project|goal|reminder|custom",
  "refId": "ObjectId|null",
  "projectId": "ObjectId|null",
  "note": "string",
  "createdAt": "Date"
}
```
Index: `date`, `projectId`.

### 7.9 `points_ledger`
```json
{
  "_id": "ObjectId",
  "date": "Date",
  "amount": 1,
  "reason": "habit_completed|habit_missed|task_done|level_up|penalty",
  "refType": "habit|task|project|level",
  "refId": "ObjectId|null",
  "note": "string",
  "createdAt": "Date"
}
```
Index: `date`, `refType`.

### 7.10 `streaks`
```json
{
  "_id": "ObjectId",
  "habitId": "ObjectId",
  "current": 12,
  "longest": 30,
  "lastCompletedDate": "Date"
}
```

### 7.11 `books` (القراءة)
```json
{
  "_id": "ObjectId",
  "title": "string",
  "author": "string",
  "level": 3,
  "status": "locked|unlocked|in_progress|completed",
  "pdfUrl": "string (cloud)",
  "bookmarkPage": 42,
  "notes": "string",
  "completedAt": "Date|null"
}
```
Index: `level` (unique).

### 7.12 `quran_plan` / `quran_logs`
```json
{
  "plan": {
    "reviewHizbs": 25,
    "dailyHizbs": 15,
    "weeklyHizbsRest": "rest",
    "currentHizb": 3,
    "currentPhase": "review|new_daily|new_weekly"
  },
  "log": {
    "_id": "ObjectId",
    "date": "Date",
    "hizb": "string",
    "phase": "review|new_daily|new_weekly",
    "durationMinutes": 30,
    "completedAt": "Date"
  }
}
```

### 7.13 `english_levels` / `english_progress`
```json
{
  "level": {
    "_id": "ObjectId",
    "index": 1,
    "skill": "reading|writing|listening|speaking",
    "title": "string",
    "status": "locked|unlocked|completed",
    "contentRef": "string"
  },
  "progress": {
    "skill": "reading",
    "currentLevel": 1,
    "completedLevels": [1],
    "score": 80
  }
}
```

### 7.14 `brotherhood_students` / `brotherhood_sessions`
```json
{
  "student": {
    "_id": "ObjectId",
    "name": "string",
    "group": "senior|junior",
    "materials": ["string"],
    "lessons": [ { "title": "string", "status": "done|pending" } ],
    "exercises": [ { "title": "string", "done": false } ],
    "photos": ["string (cloud url)"]
  },
  "session": {
    "_id": "ObjectId",
    "studentId": "ObjectId",
    "date": "Date",
    "durationMinutes": 60,
    "note": "string",
    "status": "done|deferred"
  }
}
```

### 7.15 `money_entries`
```json
{
  "_id": "ObjectId",
  "amount": 500,
  "source": "string",
  "note": "string",
  "date": "Date",
  "createdAt": "Date"
}
```

### 7.16 `media_items`
```json
{
  "_id": "ObjectId",
  "kind": "program|journal|beek_idea",
  "title": "string",
  "body": "string",
  "projectId": "ObjectId|null",
  "watchedAt": "Date|null",
  "tags": ["string"],
  "createdAt": "Date"
}
```

### 7.17 `hasaniya_cards`
```json
{
  "_id": "ObjectId",
  "type": "hasaniya|translated|qa|dictionary",
  "text": "string",
  "translation": "string",
  "source": "huggingface|manual",
  "referenceMark": "string",
  "saved": true,
  "createdAt": "Date"
}
```

### 7.18 `notifications`
```json
{
  "_id": "ObjectId",
  "type": "habit_reminder|task_reminder|daily_summary|streak|level_up|system",
  "title": "string",
  "body": "string",
  "isRead": false,
  "readAt": "Date|null",
  "data": { },
  "scheduledAt": "Date|null",
  "sentAt": "Date|null",
  "createdAt": "Date"
}
```
Index: `isRead`, `scheduledAt`.

---

## 8. العلاقات بين الكيانات

- `users` (1) → (0..n) `habits`, `tasks`, `projects`, `goals`, `calendar_events`, `notifications`.
- `habits` (1) → (0..n) `habit_logs` (سجل يومي).
- `habits` (1) → (0..1) `streaks`.
- `projects` (1) → (0..n) `project_nodes` (شجرة).
- `projects` (1) → (0..n) `goals`, `tasks`, `calendar_events`.
- `tasks` (0..1) → (1) `projects` (اختياري).
- `books` مستقل (نظام مستويات تسلسلي عبر `level`).
- `brotherhood_students` (1) → (0..n) `brotherhood_sessions`.
- `points_ledger` يشير إلى المصدر عبر `refType`/`refId` (polymorphic reference).

---

## 9. التدفقات الرئيسية

### 9.1 تدفق تسجيل عادة (يومي)
1. المستخدم يفتح صفحة «يومي» → يرى عادات اليوم (مولّدة من Recurrence Engine).
2. يضغط «تم التنفيذ» على العادة.
3. `POST /habit-logs` → إنشاء/تحديث سجل اليوم بحالة `completed`.
4. `points.engine` يضيف +نقطة إلى `points_ledger`.
5. `streak.engine` يحدّث السلسلة.
6. الواجهة تُحدّث فورًا (optimistic update).

### 9.2 تدفق نهاية اليوم (End of Day)
1. عند 23:00 (أو 00:00) يعمل `endOfDay.job`.
2. أي عادة يومية غير منفّذة → حالة `missed` و−نقطة.
3. حساب معدل اليوم + توليد عبارة تقدير/تأنيب تفاعلية.
4. إشعار in-app بالملخص.

### 9.3 تدفق التجديد اليومي (Recurrence)
1. عند 00:00 يعمل `dailyReset.job`.
2. تُحدَّد العادات اليومية النشطة + مهام المشاريع المتكررة المستحقة اليوم.
3. تُهيّأ قائمة «يومي» لليوم الجديد (بدون إنشاء سجلات فارغة إلا عند الحاجة).
4. `seasonalActivation.job` يفحص اقتراب تمام الشهر لتفعيل العادات الموسمية.

### 9.4 تدفق الرياضة الصباحية (GPS)
1. زر «ابدأ» → بدء تتبّع الموقع.
2. جمع نقاط المسار (lat/lng) عبر خدمات الخرائط.
3. عند الإيقاف: حساب الكيلومترات + رسم خط أحمر على الخريطة.
4. حفظ المسافة/المسار في `habit_logs.metadata` + تحديث السجل مؤرخًا.

### 9.5 تدفق مشروع الحسانية (Hugging Face)
1. طلب جمل من نموذج Hugging Face.
2. تعديل/تنقيح في الواجهة.
3. إضافة علامة مرجعية → حفظ البطاقة (حسانية/مترجمة/Q&A/قاموس).
4. تحديث إحصائية العدد.

### 9.6 تدفق المشاريع بمستويات (رسائل من غزة / التعمق في AI)
1. إتمام مستوى → فتح المستوى التالي (لا يُكشف التالي قبل الإتمام).
2. في «رسائل من غزة»: التأخير = عقوبة بجمع المهام.
3. تحديث نسبة التقدم حتى 100%.

### 9.7 تدفق خريطة التقدم
1. طلب `GET /progress/overview`.
2. تجميع: نسب تحقيق أهداف المشاريع + التنفيذ اليومي للعادات + النقاط.
3. عرض رسومي.

---

## 10. محرك التكرار والتجديد اليومي (Recurrence Engine)

هو قلب التطبيق والابتكار الأساسي («تسجيل مرة واحدة → تجدد يومي تلقائي»).

- **العادات اليومية**: تُعرض تلقائيًا كل يوم. لا حاجة لإنشاء سجل مسبق؛ يُنشأ السجل عند التنفيذ أو عند نهاية اليوم (missed).
- **العادات الموسمية**: تُفعَّل عند تمام كل شهر أو اقتراب 3 أيام من تمامه، ويُحدَّد لها يوم للقيام بها (`seasonalActivation.job`).
- **مهام المشاريع المتكررة**: تظهر في «يومي» حسب الروزنامة الخاصة بالمشروع.
- **قاعدة الهوايات**: العادات الموسومة `isHobby=true` تُعرض بعد الأساسيات فقط، ويمكن تأجيلها/تعويضها غدًا.

---

## 11. محرك التحفيز (Gamification Engine)

- **النقاط**: +1 عند التنفيذ، −1 عند عدم تنفيذ عادة قبل 23:00.
- **الشفافية**: كل نقطة تُسجَّل في `points_ledger` بتاريخها وسببها.
- **السلاسل (Streak)**: تُحدَّث عند كل إتمام؛ الهدف ≥ 30 يومًا (KPI).
- **المعدلات**: أسبوعي منفصل لكل عنصر + عام شهري + تقييم يومي.
- **المستويات العامة**: تُفتح تدريجيًا لتحفيز الاستمرارية.

---

## 12. الإشعارات والتذكيرات

| النوع | القناة | المحفّز |
|---|---|---|
| تذكير عادة | in-app + FCM | موعد العادة / قبل X دقائق |
| تذكير مهمة | in-app + FCM | موعد المهمة |
| إشعار مراجعة الأخوة | in-app + FCM | قبل 5 دقائق من الجلسة |
| التقييم اليومي | in-app | نهاية اليوم |
| الملخص اليومي | in-app | 00:00 |
| ترقية مستوى / سلسلة | in-app | عند الحدث |

- `reminder.job` يفحص المواعيد القريبة ويرسل التذكيرات.
- **Assumption A4**: عدد الإشعارات اليومية يُضبط ضمن الإعدادات لتفادي الإرهاق (من خطة تخفيف المخاطر في دفتر الشروط).

---

## 13. الميزات الخاصة لكل عادة/مشروع

### 13.1 العادات ذات الصفحات الخاصة
| العادة | الميزة الخاصة |
|---|---|
| قيام الليل | قائمة مؤرخة (تاريخ، توقيت الاكتمال، الحزب، المدة) |
| الرياضة الصباحية | زر ابدأ → GPS → خط أحمر على الخريطة → كيلومترات + ملاحظات |
| القراءة | مستويات Duolingo + عرض PDF + ملاحظات + قائمة أبجدية |
| القرآن | خطة حفظ ذكية (25/15/البقية) |
| المطالعة التخصصية | قائمة روابط + زر إضافة موقع |
| الجلسة مع الأهل | خطوات + قواعد تعامل |
| المراجعة للأخوة | قائمة طلاب + صفحة لكل طالب + إشعار قبل 5 د + تأجيل |
| جلسة البيك | Noté بمشاريع + ملاحظات وأفكار |
| جمع المصروف | زر إضافة + ملاحظة + إحصائية إجمالي |
| الإنجليزية | مستويات × 4 مهارات |
| البقية | إحصائيات + ملاحظات + تاريخ |

### 13.2 رأس مشترك لكل صفحة عادة
عدد أيام القيام، نسبة النجاح، نسبة الإخفاق.

---

## 14. التكاملات الخارجية

| التكامل | الاستخدام | معمارية الربط |
|---|---|---|
| **Firebase Cloud Messaging** | الإشعارات الفورية | Backend → FCM → الجهاز |
| **Google Maps / Mapbox** | GPS الرياضة الصباحية | Frontend SDK + حفظ المسار في Backend |
| **مكتبة عرض PDF مدمجة** | قراءة الكتب داخل التطبيق | Frontend فقط + ملفات PDF على Cloud Storage |
| **Hugging Face API** | جلب جمل مشروع الحسانية | Backend → HF API (حماية المفتاح) |
| **Cloud Storage** | تخزين PDF والصور والشعارات | روابط URL |

- **Assumption A5**: استدعاءات Hugging Face تمر عبر Backend لإخفاء المفتاح وتوحيد المعالجة.

---

## 15. أمن النظام

- **التوثيق**: JWT (access قصير + refresh) مخزّنًا في DB، مع إبطاله عند الخروج/تغيير كلمة المرور.
- **التحقق**: Zod على كل المدخلات.
- **الترويسات**: Helmet، HTTPS إلزامي في الإنتاج.
- **الأسرار**: متغيرات بيئة فقط (لا أسرار في المستودع).
- **الصلاحيات**: حساب واحد (Owner) في MVP، مع بنية جاهزة للتوسع.
- **النسخ الاحتياطي**: نسخ سحابي دوري (من خطة تخفيف المخاطر).

---

## 16. تصميم الـ API (مبادئ عامة)

- Base URL مُصدّر (v1)، مغلّف استجابة موحّد: `{ success, data, error, meta }`.
- Pagination offset-based للقوائم.
- التفاصيل الكاملة في `api-contract.md` (مصدر الحقيقة للتكامل).

---

## 17. المهام المجدولة (Cron Jobs)

| التوقيت | المهمة | الوصف |
|---|---|---|
| 00:00 يوميًا | `dailyReset.job` | تهيئة قائمة «يومي» والعادات الجديدة |
| 00:00 يوميًا | `dailySummary.job` | ملخص لليوم السابق |
| كل ساعة | `reminder.job` | تذكيرات المواعيد القريبة |
| 23:00 يوميًا | `endOfDay.job` | خصم النقاط + التقييم اليومي |
| يوميًا (فحص شهري) | `seasonalActivation.job` | تفعيل العادات الموسمية قرب نهاية الشهر |

---

## 18. الأداء والتخزين المؤقت

- Indexes على: `habit_logs(habitId,date)`, `tasks(date,projectId,status)`, `points_ledger(date)`, `notifications(isRead,scheduledAt)`.
- Aggregations لصفحة «يومي» وخريطة التقدم.
- **Assumption A6**: Redis اختياري (5 دقائق TTL) للتجميعات الثقيلة إن توفّر؛ وإلا يُحسب مباشرة في MVP.
- تخزين محلي (AsyncStorage) في الواجهة لحالة «يومي» لدعم العمل دون اتصال.

---

## 19. معمارية النشر (MVP)

```
[Vercel / Netlify / EAS Hosting] → واجهة PWA/Web (React Native Web)
[Railway / Render]               → Backend Node.js (instance واحدة)
[MongoDB Atlas]                  → قاعدة البيانات
[Cloud Storage]                  → PDF/الصور
[Firebase FCM]                   → الإشعارات
[Hugging Face API]              → نصوص مشروع الحسانية
```

**متغيرات البيئة**: `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FIREBASE_*`, `HF_API_KEY`, `MAPS_API_KEY`, `STORAGE_*`.

---

## 20. المتطلبات غير الوظيفية

- **التفاعلية**: تجربة سلسة على غرار Duolingo.
- **التصميم**: جميل ومتحرك (AI creative).
- **التوفر**: تجربة مقبولة مع اتصال متقطع.
- **الأداء**: استجابة سريعة لصفحة «يومي» (المسار الأكثر استخدامًا).
- **التنظيم**: مرونة ذكية، لا طغيان جانب على آخر، الاستمرارية قبل الكمال.
- **KPIs**: إتمام العادات ≥ 85%، المهام ≥ 80%، Streak ≥ 30 يومًا، 100 كتاب/سنة.

---

## 21. الحدود بين أجزاء النظام

| الحد | الوصف |
|---|---|
| **Backend ↔ Frontend** | عبر `api-contract.md` فقط، مغلّف موحّد |
| **Gamification ↔ باقي الوحدات** | عبر `points.engine` و`streak.engine` (فصل تام) |
| **Recurrence ↔ Habit/Task** | محرك مركزي، لا منطق تكرار داخل الواجهة |
| **Backend ↔ التكاملات** | الأسرار تبقى في Backend |
| **MVP ↔ ما بعده** | التوسع متعدد المستخدمين معزول في وحدة Auth/User |

---

## 22. نطاق MVP مقابل المراحل اللاحقة

| الميزة | MVP | لاحقًا |
|---|---|---|
| العادات اليومية + «يومي» + نقاط | ✅ | – |
| العادات الموسمية | ✅ | تحسين جدولة |
| المهام الأساسية والمشاريع الأساسية | ✅ | بنى مشاريع متقدمة |
| القراءة (مستويات + PDF) | ✅ | – |
| القرآن (خطة حفظ) | ✅ | – |
| الإنجليزية (مستويات × مهارات) | ✅ | محتوى تفاعلي متقدم |
| GPS الرياضة | ✅ | خرائط متقدمة |
| الحسانية (Hugging Face) | ✅ | نماذج متعددة |
| الإشعارات FCM | ✅ | جدولة ذكية |
| خريطة التقدم | ✅ | تحليلات متقدمة |
| تعدد المستخدمين/المشاركة | ❌ | ✅ |
| مزامنة أوفلاين كاملة | جزئي | ✅ |

---

## 23. الافتراضات والأسئلة المفتوحة

**Assumptions**
- **A1**: «app web pwd» = تطبيق ويب قابل للتثبيت (PWA) + موبايل عبر React Native.
- **A2**: نموذج حساب واحد (Owner) مع حقل `role` جاهز للتوسع.
- **A3**: منهجية الإنجليزية تُحدَّد لاحقًا (ملحق د).
- **A4**: عدد الإشعارات اليومية قابل للضبط في الإعدادات.
- **A5**: تكامل Hugging Face يمر عبر Backend.
- **A6**: Redis اختياري في MVP.
- **A7**: التعامل مع الوقت بالتوقيت المحلي `Africa/Nouakchott` مع تخزين UTC.

**Open Questions**
- **Q1**: نوع المنصة النهائي (PWA فقط أم موبايل أصلي أيضًا).
- **Q2**: متطلبات التوسع متعدد المستخدمين والأدوار.
- **Q3**: آلية الدخول الدقيقة.
- **Q4**: تطبيق الحوار/الكلام المختص لمهارة speaking.
- **Q5**: مصدر قوائم الكتب والبرامج (ملاحق أ/ب) وشكل استيرادها.

---

> **نهاية وثيقة المعمارية.** هذه الوثيقة هي المرجع المعماري الأساسي للمراحل اللاحقة (`api-contract.md`, `backend-plan.md`, `frontend-plan.md`, `infra-plan.md`).
