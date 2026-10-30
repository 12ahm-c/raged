# رغد — خطة فريق Backend (Backend Team Plan)

**وثيقة عمل فريق الـ Backend لتطبيق «رغد»**
مرافقة لـ `architecture.md` و`api-contract.md`

---

## 1. الغرض (Purpose)

تسمح هذه الوثيقة لفريق Backend بالعمل **بالتوازي** مع Frontend، مع حماية عقود الـ API، والقواعد المنطقية، وسلامة البيانات، والأمن. لا تُلغِي هذه الوثيقة عقد الـ API ولا وثيقة المعمارية؛ بل تُنظّم التنفيذ.

**مصادر الحقيقة:**
- **عقود الاتصال**: `new files/api-contract.md` (مصدر أشكال الطلب/الاستجابة).
- **المعمارية وقواعد الأعمال والبيانات والأمن**: `new files/architecture.md`.
- **ترتيب المراحل عبر الفرق**: `new files/master-plan.md` (يُنشأ في مرحلة لاحقة).
- **متطلبات المنتج الأصلية**: `cahier_charge.md`.

---

## 2. الملكية (Ownership)

يملك فريق Backend:

- `raghad-backend/src/**` (Node.js + Express، Monolithe modulaire).
- `raghad-backend/src/engine/**` (Recurrence, Streak, Points).
- `raghad-backend/src/jobs/**` (المهام المجدولة).
- اختبارات Backend (Unit + Integration).
- الأنواع المشتركة في `shared/types/**` بعد التنسيق مع Frontend.

لا يعدّل Backend كود واجهة Frontend إلا إذا أُوكل إليه ذلك صراحةً.

---

## 3. بيئة التشغيل الحالية (Current Runtime)

تشغيل الخادم:

```bash
npm run dev:backend
```

الاعتماديات المحلية:

```text
MongoDB: MongoDB Atlas عبر MONGODB_URI (database: raghad)
Firebase Admin SDK: للإشعارات FCM
Hugging Face: HF_API_KEY
Maps: MAPS_API_KEY
Storage: STORAGE_* (PDF/الصور)
```

**Assumption A6**: Redis اختياري للتخزين المؤقت؛ إن توفّر يُستعمل للتجميعات الثقيلة بـ TTL = 5 دقائق.

---

## 4. قواعد Backend (Backend Rules)

- **Controllers رقيقة**: تحليل الطلب، استدعاء الخدمة، تنسيق الاستجابة فقط.
- **قواعد الأعمال في Services**.
- **Models** تملك تعريف المخططات والفهارس والتحديثات الذرية.
- كل الاستجابات تستعمل `{ success, data, error, meta }` إلا عند `204 No Content`.
- أكواد الخطأ تطابق **Appendix B** في عقد الـ API.
- **الأمان**: لا تُستعمل بيانات JWT وحدها للقرارات الحساسة عند الحاجة لحالة DB حديثة.
- لا تُخزَّن الملفات أو الأسرار على ملفات الخادم — استخدم Cloud Storage.
- **لا يُخترَع** أي endpoint أو حقل DTO أو حقل مخطط أو متغيّر بيئة أو قاعدة عمل خارج `api-contract.md` و`architecture.md`.

---

## 5. قاعدة توافق العقد (Contract Compatibility Rule)

يجب أن يطبّق Backend نفس البنية بدقة في `api-contract.md` ليتمكّن Frontend من استبدال الـ mocks الحقيقية دون إعادة كتابة الشاشات.

- كل مسار، método، متطلب auth، جسم طلب، مُعامل استعلام، جسم استجابة، كود خطأ، وشكل Pagination يطابق العقد.
- كل استجابة بمغلّف `{ success, data, error, meta }` إلا `204`.
- أكواد الأخطاء الموثّقة + حقل `fields` لأخطاء التحقق.
- `ObjectId` نص 24 hex.
- التواريخ ISO 8601 UTC، والـ «يوم» بتوقيت المستخدم المحلي (`Africa/Nouakchott`).
- Pagination offset-based `(page, limit, total)`.
- منطق القفل (MALAM): مستويات القراءة/الإنجليزية والمشاريع بمستويات ترجع `409 LEVEL_LOCKED`.

**قاعدة تسليم Frontend**: عند اكتمال endpoint، يُبلّغ Frontend بـ: اسم النقطة، متطلّب auth، مثال استجابة، أكواد الأخطاء المدعومة، وأي بيانات اختبار.

---

## 6. مراحل عمل Backend (Phase-by-Phase)

### المرحلة 1 — الأساس والهوية (Foundation & Identity)

**المخرجات:**
- تهيئة مشروع Backend: Express, TypeScript, Zod, Helmet, CORS, مغلّف الاستجابة، معالج أخطاء مركزي.
- اتصال MongoDB + تعريف الاتصال في `app.ts`/`server.ts`.
- نموذج `users` مع فهارس `email` (unique)،`role`.
- المصادقة: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
- JWT: access قصير + refresh (7 أيام) مخزّن في DB.
- Middleware المصادقة + `error.middleware`.
- إنشاء الحساب: بذر الحساب الأول (Seed) + تسجيل عام عبر `POST /auth/register` (دور `owner` فقط).
- الملف الشخصي والإعدادات: `PUT /users/me`, `GET/PUT /users/me/settings`.

**قواعد حرجة:**
- `POST /auth/register` يقبل `name` + `email` + `password`، ويرد بـ 409 `DUPLICATE` إذا كان البريد مسجّلًا، ويعيد الجلسة مباشرة (access + refresh) بدور `owner` — لا يمكن تعيين أي دور آخر عبر API.
- تدوير refresh token: يُبطَل القديم عند الخروج/التجديد.
- تغيير كلمة المرور يُبطل كل refresh tokens.
- **مراجعة أمنية مطلوبة.**

---

### المرحلة 2 — العادات والسجل والنقاط (Habits, Logs & Gamification Core)

**المخرجات:**
- نموذج `habits` (daily 23 + seasonal 11) مع `config.special`، `timeSlot`, `isHobby`.
- CRUD العادات: `POST/GET/GET:id/PUT/DELETE /habits`.
- جدولة العادات الموسمية: `POST /habits/:id/seasonal-schedule`.
- نموذج `habit_logs` (فهرس `habitId+date` unique).
- تسجيل التنفيذ: `POST /habit-logs`, وتحديثه `PUT`, وحذفه, واستعراضه, و`GET /habits/:id/history`.
- **`points.engine`**: +1 عند التنفيذ، −1 عند عدم تنفيذ عادة قبل 23:00، مع سجل شفاف في `points_ledger`.
- **`streak.engine`**: حساب السلسلة الحالية/الأطول.
- نموذج `streaks`.
- مسارات التحفيز: `GET /gamification/points`, `/streaks`, `/stats`, `/levels`.
- **Recurrence Engine (أساسي)**: تحديد عادات اليوم وعدم إنشاء سجلات فارغة إلا عند الحاجة.

**قواعد حرجة:**
- سجل العادة لكل (عادة × يوم) فريد.
- النقاط تُحتسب وتُوثّق مرة واحدة لكل فعل.
- حذف سجل يعيد احتساب السلسلة والنقاط.
- **مراجعة أمنية مطلوبة للمنطق المالي للنقاط.**

---

### المرحلة 3 — المهام وصفحة «يومي» (Tasks & Daily)

**المخرجات:**
- نموذج `tasks` (manual/project/study/work/islamic) + فهارس `date,projectId,status`.
- CRUD: `POST/GET/GET:id/PUT/DELETE /tasks` + `PATCH /tasks/:id/status`.
- نوع المهام الأساسية اليومية (دراسة/عمل/عمل إسلامي).
- **Daily Aggregation**: `GET /daily` يجلب العادات + مهام المشاريع المستحقة + المهام اليدوية مرتبةً زمنيًا.
- `GET /daily/end-of-day` (المعدل + عبارة تفاعلية).

**قواعد حرجة:**
- «يومي» مسار أداء حرج — استعلامات مُفهرسة ومُجمَّعة بكفاءة.
- إتمام مهمة يمنح نقاطًا عبر `points.engine` (عند `pointsReward > 0`).
- الترتيب الزمني يعتمد `startTime` ثم الأولوية.
- `endOfDay` متاح بعد نهاية اليوم (يُولّد عبر cron أيضًا).

---

### المرحلة 4 — المشاريع والأهداف والروزنامة (Projects, Goals & Calendar)

**المخرجات:**
- نموذج `projects` (7 مشاريع، `key` + `structureType`).
- CRUD المشاريع + `GET /projects/:id/achievements`.
- نموذج `project_nodes` (شجري `parentId`) + CRUD + `PATCH /nodes/:id/status`.
- منطق القفل `LEVEL_LOCKED` للمشاريع بمستويات (`messages_gaza`, `ai_depth`).
- نموذج `goals` + CRUD + حساب التقدم.
- نموذج `calendar_events` + CRUD + `GET /calendar/main`.

**قواعد حرجة:**
- حذف عقدة يحذف أبناءها (cascade).
- المستويات لا تُفتح قبل إتمام السابق.
- الروزنامة تجمع الأحداث عبر الأنواع دون تكرار المصدر (`refType/refId`).

---

### المرحلة 5 — الميزات الخاصة (Feature Modules)

**المخرجات:**
- **Reading**: نماذج `books` (+ notes)، نظام مستويات، PDF URLs، `LEVEL_LOCKED`.
- **Quran**: `quran_plan` + `quran_logs` + `GET /quran/next` (اقتراح الحزب/المرحلة).
- **English**: `english_levels` + `english_progress` (4 مهارات × مستويات) + `complete`.
- **Brotherhood**: `brotherhood_students` + `brotherhood_sessions` + رفع الصور + التأجيل.
- **Money**: `money_entries` + الملخص.
- **Media**: `media_items` (برامج/مذكرات/أفكار بيك) + تسجيل المشاهدة.
- **Hasaniya**: `hasaniya_cards` + تكامل Hugging Face (`POST /hasaniya/fetch`) + إحصاءات.

**قواعد حرجة:**
- مستويات القراءة/الإنجليزية تسلسلية صارمة.
- خطة القرآن تنظّم تلقائيًا بين المراجعة والحفظ الجديد (25/15/البقية).
- `POST /hasaniya/fetch` يمرّ عبر Backend ويُرجع `502 EXTERNAL_SERVICE_ERROR` عند الفشل.
- رفع الصور عبر `multipart/form-data` → Cloud Storage.

---

### المرحلة 6 — الإشعارات والمهام المجدولة (Notifications & Cron Jobs)

**المخرجات:**
- نموذج `notifications` + CRUD القراءة: `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `POST /notifications/device-token`.
- تكامل FCM لإرسال push.
- `reminder.job`: تذكيرات المواعيد (عادة/مهمة/مراجعة أخوة قبل 5 د).
- `dailyReset.job`: تهيئة «يومي» عند 00:00.
- `endOfDay.job`: خصم النقاط + التقييم اليومي عند 23:00.
- `seasonalActivation.job`: تفعيل العادات الموسمية قرب نهاية الشهر.
- `dailySummary.job`: ملخص يومي عند 00:00.

**قواعد حرجة:**
- الإشعارات idempotent (لا تُرسل مرتين لنفس المحفّز).
- احترام عدد الإشعارات اليومية القابل للضبط.
- الجدولة بالتوقيت المحلي للمستخدم مع التخزين UTC.

---

### المرحلة 7 — خريطة التقدم والتكاملات والتقسية (Progress, Integrations & Hardening)

**المخرجات:**
- `GET /progress/overview`, `GET /progress/projects/:id`, `GET /dashboard`.
- `GET /integrations/status`, `POST /integrations/maps/route` (حفظ مسار GPS).
- Aggregation pipelines مُفهرسة للتجميعات.
- Redis (اختياري) TTL = 5 د للتجميعات.
- تسجيل مُهيكل (Winston/Pino) + Request IDs.
- اختبارات تكامل للتدفقات الحرجة: تسجيل عادة، إتمام مهمة، احتساب نقاط، تحديث سلسلة، فتح/قفل مستوى.
- قائمة جاهزية للـ Staging/Production (env vars، فهارس، نسخ احتياطي).

**قواعد حرجة:**
- بيانات لوحة التحكم مُجمّعة بكفاءة (لا استعلامات N+1).
- مسار GPS يُخزَّن ضمن `habit_logs.metadata`.
- **مراجعة أمنية نهائية مطلوبة.**

---

## 7. ترتيب التنفيذ والاعتماديات (Dependencies)

```
المرحلة 1 (Foundation & Auth)
      │
      ▼
المرحلة 2 (Habits + Gamification Core + Recurrence)
      │
      ▼
المرحلة 3 (Tasks + Daily)          ← يعتمد على العادات والنقاط
      │
      ▼
المرحلة 4 (Projects + Goals + Calendar)
      │
      ▼
المرحلة 5 (Feature Modules)        ← يمكن تنفيذ وحداتها بالتوازي جزئيًا
      │
      ▼
المرحلة 6 (Notifications + Cron)   ← يعتمد على المحركات والوحدات
      │
      ▼
المرحلة 7 (Progress + Integrations + Hardening)
```

- المراحل 5 يمكن تقسيمها بين عدة مطوّرين/وكلاء بالتوازي (Reading || Quran || English || Brotherhood || Money || Media || Hasaniya) شرط توافق العقود.
- المرحلة 6 تعتمد على وجود المحرّكات (نقاط/سلاسل/تكرار) وعلى الوحدات لتوليد الإشعارات.

---

## 8. تعريف الإنجاز (Definition Of Done)

- الـ endpoint موجود في `api-contract.md` قبل التنفيذ.
- البنية المطبّقة تطابق العقد (يستبدل Frontend الـ mocks دون إعادة كتابة شاشات).
- قاعدة العمل موجودة في `architecture.md` قبل التنفيذ.
- غلاف الاستجابة وأكواد الخطأ متوافقة.
- التحقق مركزي (Zod schemas) ومُختبَر.
- الخدمات تحمل منطق الأعمال؛ Controllers رقيقة.
- الوحدات الحرجة (Auth، النقاط، السلاسل، المستويات) اجتازت مراجعة أمنية.
- `npm run lint`, `npm run typecheck`, الاختبارات الموجّهة، و`npm run build` تنجح.
- لكل endpoint مكتمل: ملاحظة تسليم لـ Frontend (اسم النقطة، auth، مثال استجابة، الأخطاء المتوقّعة).

---

> هذه وثيقة عمل فريق Backend. أي انحراف عن `api-contract.md` أو `architecture.md` يُناقَش ويُعتمد قبل كتابة الكود.
