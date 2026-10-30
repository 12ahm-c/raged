# رغد — خطة التنفيذ الرئيسية (Master Development Plan)

| البند | القيمة |
|---|---|
| **المنتج** | تطبيق «رغد» — نظام إدارة الحياة المتكامل |
| **النسخة** | 1.0 — MVP + أساس التوسع |
| **مصدر الحقيقة** | هذه الوثيقة تُنسّق `architecture.md`, `api-contract.md`, `backend-plan.md`, `frontend-plan.md`, `infra-plan.md` |
| **الوثيقة العليا** | `cahier_charge.md` |

---

## 1. المبادئ الموجّهة (Guiding Principles)

- **Contract-first**: لا انحراف عن عقد الـ API. الـ mocks تطابق الـ endpoints الحقيقية تمامًا.
- **Incremental & safe**: كل مرحلة تنتج ميزة عاملة قابلة للاختبار. لا تكامل دفعة واحدة.
- **Parallel development**: Backend ينفّذ endpoints؛ Frontend يبني على mocks مطابقة للعقد؛ التكامل يتم لكل مرحلة.
- **Backend يملك قواعد العمل والبيانات والأمن.** Frontend يملك الواجهة والحالة والتفاعل.
- **Handshake إلزامي**: قبل اعتبار أي مرحلة مكتملة، يتحقق الفريقان من توافق العقد ويشغّلان اختبار تكامل أدنى.
- **لا Features خارج `cahier_charge.md`** إلا إذا كانت ضرورية تقنيًا لتنفيذ ميزة موجودة.

---

## 2. الجدول الزمني المقترح (MVP)

| المرحلة | المحور | Backend (أيام) | Frontend (أيام) | تكامل |
|---|---|---|---|---|
| 1 | الأساس والمصادقة | 5 | 4 | 1 |
| 2 | العادات + التحفيز + «يومي» | 6 | 6 | 1 |
| 3 | المهام والمشاريع والأهداف والروزنامة | 6 | 6 | 1 |
| 4 | الوحدات الخاصة | 6 | 6 | 1 |
| 5 | الإشعارات والمهام المجدولة | 4 | 3 | 1 |
| 6 | خريطة التقدم والتكاملات | 3 | 3 | 1 |
| 7 | الاختبار والتقسية | 3 | 3 | 1 |
| 8 | النشر والإطلاق | 2 | 2 | 1 |
| **المجموع** | **MVP** | **35** | **33** | **8** |

> *يفترض الجدول 1–2 مطور Backend و1–2 مطور Frontend. يُعدّل حسب حجم الفريق.*

---

## 3. تفاصيل المراحل (Phase Details)

### المرحلة 1 — الأساس والمصادقة (Foundation & Auth)

**الهدف:** بنية عاملة: تهيئة المستودع، هيكل Backend وFrontend، قاعدة البيانات، المصادقة، وواجهة رئيسية فارغة قابلة للتنقّل.

**Backend Tasks** (من `backend-plan.md` المرحلة 1):
- تهيئة مشروع Backend (Express, TS, Zod, Helmet, مغلّف الاستجابة، معالج أخطاء مركزي).
- اتصال MongoDB + نموذج `users` (فهرس `email` فريد).
- المصادقة: `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`.
- JWT (access قصير + refresh 7 أيام مخزّن في DB).
- الملف الشخصي والإعدادات: `PUT /users/me`, `GET/PUT /users/me/settings`.
- Seed الحساب الأول (بدون API عام).

**Frontend Tasks** (من `frontend-plan.md` المرحلة A):
- عميل API مركزي + مغلّف + معالج أخطاء + تخزين التوكن.
- شاشة الدخول (`/auth/login`) + `MainLayout` + `TabNavigator`.
- صفحة الملف الشخصي والإعدادات.
- حالات Loading/Error/Empty الأساسية.

**Database Tasks:**
- إنشاء cluster Atlas + database `raghad`.
- مجموعه `users` + الفهارس الأولى.

**Integration Tasks:**
- ربط الدخول بـ `/auth/login` واستدعاء `/auth/me` بعد الدخول.
- تجديد التوكن عند `TOKEN_EXPIRED`.

**Infrastructure Tasks** (من `infra-plan.md`):
- إعداد `.env.example` ومتغيرات البيئة الأساسية.
- تشغيل محلي عبر `npm run dev`.
- إعداد نشر مبدئي (Render/Railway + Expo Web).

**Testing Tasks:**
- اختبار تكامل: login → me → refresh → logout.
- اختبار وحدة لترميز/فك JWT.

**Dependencies:** لا شيء (نقطة البداية).

**Expected Output:** تسجيل دخول عامل، جلسة مستخدم، وواجهة رئيسية محمية.

**Completion Criteria:**
- [ ] `POST /auth/login` يُرجع DTO المستخدم + التوكنات.
- [ ] `GET /auth/me` يُرجع المستخدم المصادَق عليه.
- [ ] إعادة توجيه الواجهة بعد الدخول تعمل بتوكن حقيقي.
- [ ] `npm run lint`, `typecheck`, `build` تنجح.

---

### المرحلة 2 — العادات + التحفيز + «يومي» (Habits Core)

**الهدف:** قلب التطبيق: العادات اليومية/الموسمية، تسجيل التنفيذ، النقاط والسلاسل، ومحرّك التكرار، وصفحة «يومي».

**Backend Tasks** (من `backend-plan.md` المرحلة 2 و3):
- نموذج `habits` (daily 23 + seasonal 11) + CRUD + جدولة موسمية.
- نموذج `habit_logs` (فهرس `(habitId,date)` فريد) + CRUD + `GET /habits/:id/history`.
- `points.engine` (+1/−1) + `points_ledger` (شفافية) + مسارات `/gamification/points`.
- `streak.engine` + نموذج `streaks` + `/gamification/streaks`.
- `GET /gamification/stats`, `/gamification/levels`.
- **Recurrence Engine** الأساسي + `dailyReset.job`.
- `GET /daily` (تجميع) + `GET /daily/end-of-day` + `endOfDay.job`.

**Frontend Tasks** (من `frontend-plan.md` المرحلة B):
- صفحة «يومي»: رأس إحصائي، قائمة العادات، زر «تم التنفيذ» (تحديث متفائل)، نهاية اليوم.
- صفحة العادات + CRUD + فتح عادة → الرأس الإحصائي.
- حالات Locked/Empty/Error.

**Database Tasks:**
- مجموعات: `habits`, `habit_logs`, `points_ledger`, `streaks` + فهارسها.

**Integration Tasks:**
- مزامنة «تم التنفيذ» مع `POST /habit-logs` وإبطال كاش «يومي».
- عرض النقاط/السلاسل من Backend فقط.

**Infrastructure Tasks:**
- إعداد Cron محلي (محرّك المجدولة) لرفع `dailyReset`/`endOfDay`.

**Testing Tasks:**
- تكامل: تسجيل عادة → +نقطة → تحديث سلسلة.
- اختبار عدم التنفيذ → −نقطة.
- اختبار التكرار (عادات اليوم الصحيحة).

**Dependencies:** المرحلة 1.

**Expected Output:** يوم عمل كامل: عادات متجددة، تسجيل، نقاط، سلاسل، تقييم يومي.

**Completion Criteria:**
- [ ] سجل العادة لكل (عادة × يوم) فريد.
- [ ] النقاط تُحتسب وتُوثّق في `points_ledger` مرة واحدة لكل فعل.
- [ ] «يومي» يعرض العادات + النقاط الصحيحة.
- [ ] `endOfDay` يخصم ويولّد التقييم.
- [ ] Frontend responsive مع حالات اللمس.

---

### المرحلة 3 — المهام والمشاريع والأهداف والروزنامة

**الهدف:** إدارة المهام اليومية والمشاريع (7 بنى) والأهداف والروزنامة الرئيسية.

**Backend Tasks** (من `backend-plan.md` المرحلة 3 و4):
- نموذج `tasks` + CRUD + `PATCH /tasks/:id/status` + المهام الأساسية اليومية.
- نموذج `projects` (7 مفاتيح + `structureType`) + CRUD + `GET /projects/:id/achievements`.
- نموذج `project_nodes` (شجري) + CRUD + `PATCH /nodes/:id/status` + قفل `LEVEL_LOCKED`.
- نموذج `goals` + CRUD + حساب التقدم.
- نموذج `calendar_events` + CRUD + `GET /calendar/main`.

**Frontend Tasks** (من `frontend-plan.md` المرحلة C):
- إدارة المهام + دمجها في «يومي».
- صفحة المشاريع + بنى المشاريع حسب `structureType` (Board/Tree/Goals/Calendar/Level).
- الأهداف (قائمة + تقدم).
- الروزنامة (شهري/أسبوعي).

**Database Tasks:**
- مجموعات: `tasks`, `projects`, `project_nodes`, `goals`, `calendar_events` + فهارسها.

**Integration Tasks:**
- تجميع مهام المشاريع في `GET /daily`.
- قفل المستويات يعرض في الواجهة بدل زر الفتح.

**Infrastructure Tasks:**
- لا جديد (البنية قائمة).

**Testing Tasks:**
- تكامل: إنشاء مهمة → إتمامها → نقاط.
- حذف عقدة يحذف الأبناء.
- محاولة فتح مستوى قبل إنهاء السابق → `LEVEL_LOCKED`.

**Dependencies:** المرحلة 2.

**Expected Output:** مشاريع كاملة بالبنى الخاصة + مهام + أهداف + روزنامة.

**Completion Criteria:**
- [ ] بنى المشاريع الـ7 تعمل وتحفظ في `project_nodes`.
- [ ] المهام تتجمع في «يومي».
- [ ] الروزنامة تعرض السابق/القادم.
- [ ] الحذف الشجري وقفل المستويات مطبّقان.

---

### المرحلة 4 — الوحدات الخاصة (Special Feature Modules)

**الهدف:** الميزات المتخصصة: القراءة، القرآن، الإنجليزية، الأخوة، المصروف، الميديا، الحسانية.

> يمكن تنفيذ وحدات هذه المرحلة **بالتوازي** جزئيًا (شرط توافق العقود).

**Backend Tasks** (من `backend-plan.md` المرحلة 5):
- **Reading**: `books` + notes + مستويات + `LEVEL_LOCKED`.
- **Quran**: `quran_plan` + `quran_logs` + `GET /quran/next`.
- **English**: `english_levels` + `english_progress` (4 مهارات) + `complete`.
- **Brotherhood**: `brotherhood_students` + `brotherhood_sessions` + رفع الصور + تأجيل.
- **Money**: `money_entries` + ملخص.
- **Media**: `media_items` (برامج/مذكرات/أفكار بيك) + تسجيل المشاهدة.
- **Hasaniya**: `hasaniya_cards` + `POST /hasaniya/fetch` (Hugging Face) + إحصاءات.

**Frontend Tasks** (من `frontend-plan.md` المرحلة D):
- `/reading` (PDF مدمج + مستويات + ملاحظات).
- `/quran` (خطة + `next` + تسجيل).
- `/english` (4 مهارات × مستويات).
- `/brotherhood` (طلاب + ملف لكل طالب + جلسات).
- `/money` (إضافة + ملخص).
- `/media` (برامج/مذكرات/أفكار).
- `/hasaniya` (جلب → تعديل → حفظ + إحصاء).

**Database Tasks:**
- مجموعات كل وحدة + فهارسها.

**Integration Tasks:**
- رفع الصور عبر `multipart/form-data`.
- استدعاء Hugging Face عبر Backend.
- تشغيل التوكن/التخزين الموثّق.

**Infrastructure Tasks:**
- إعداد مفاتيح `HF_API_KEY`, `STORAGE_*`, وربط Cloud Storage.
- ضبط حد الأخطاء الخارجية (`EXTERNAL_SERVICE_ERROR`).

**Testing Tasks:**
- تكامل لكل وحدة (فتح مستوى، تسجيل قرآن، جلب HF، رفع صورة).
- فشل خدمة خارجية يُرجع `502`.

**Dependencies:** المرحلة 3 (للتجميع والربط).

**Expected Output:** كل الوحدات الخاصة عاملة ومتكاملة مع «يومي»/التحفيز.

**Completion Criteria:**
- [ ] مستويات القراءة/الإنجليزية تسلسلية.
- [ ] خطة القرآن تنظّم المراجعة/الحفظ تلقائيًا.
- [ ] الحسانية تجلب وتحفظ بنجاح.
- [ ] كل وحدة لها حالة Empty/Error/Loading.

---

### المرحلة 5 — الإشعارات والمهام المجدولة (Notifications & Cron)

**الهدف:** الإشعارات (in-app + FCM) والتذكيرات والمهام المجدولة الآلية.

**Backend Tasks** (من `backend-plan.md` المرحلة 6):
- نموذج `notifications` + CRUD القراءة + `POST /notifications/device-token`.
- تكامل FCM.
- `reminder.job`, `dailyReset.job`, `endOfDay.job`, `seasonalActivation.job`, `dailySummary.job`.

**Frontend Tasks** (من `frontend-plan.md` المرحلة E):
- مركز الإشعارات + عدد غير المقروء + تعليم كمقروء.
- تسجيل توكن FCM + استقبال الإشعارات in-app.

**Database Tasks:**
- مجموعة `notifications` + فهارس `(isRead)`, `(scheduledAt)`.

**Integration Tasks:**
- تذكيرات المواعيد (عادة/مهمة/مراجعة أخوة قبل 5 د).
- التقييم اليومي والملخص اليومي.

**Infrastructure Tasks:**
- إعداد Firebase Admin SDK + `FIREBASE_SERVICE_ACCOUNT_JSON`.
- ضبط جدولة Cron محليًا والإنتاج.

**Testing Tasks:**
- تكامل idempotent للمهام المجدولة (لا إشعار مزدوج).
- اختبار وصول الإشعار للجهاز عبر FCM sandbox.

**Dependencies:** المراحل 2–4 (المحرّكات والوحدات).

**Expected Output:** إشعارات وتذكيرات آلية موثوقة.

**Completion Criteria:**
- [ ] المهام المجدولة تعمل دون تكرار.
- [ ] الإشعارات تُعلَّم مقروءة وتُحدَّث العدّادات.
- [ ] احترام عدد الإشعارات اليومية القابل للضبط.

---

### المرحلة 6 — خريطة التقدم والتكاملات (Progress, Dashboard & Integrations)

**الهدف:** خريطة التقدم الشاملة ولوحة اليوم، وتكاملات GPS والتكاملات النهائية.

**Backend Tasks** (من `backend-plan.md` المرحلة 7):
- `GET /progress/overview`, `GET /progress/projects/:id`, `GET /dashboard`.
- `GET /integrations/status`, `POST /integrations/maps/route`.
- Aggregation pipelines مُفهرسة + Redis اختياري (TTL 5 د).

**Frontend Tasks** (من `frontend-plan.md` المرحلة E):
- خريطة التقدم (رسوم بيانية للمشاريع/العادات).
- لوحة اليوم.
- تتبّع GPS للرياضة الصباحية (خريطة + خط أحمر + كم).

**Database Tasks:**
- تحسين الفهارس لاستعلامات التجميع.

**Integration Tasks:**
- حفظ مسار GPS في `habit_logs.metadata`.
- عرض التجميعات من Backend فقط.

**Infrastructure Tasks:**
- تفعيل Redis (اختياري) إن ثبتت الحاجة.
- `MAPS_API_KEY`.

**Testing Tasks:**
- تكامل: تتبّع GPS → حفظ → عرض.
- اختبار كفاءة التجميعات (لا N+1).

**Dependencies:** المراحل 2–5.

**Expected Output:** تصور كامل للتقدم + لوحة + GPS.

**Completion Criteria:**
- [ ] خريطة التقدم تعرض نسب المشاريع والعادات.
- [ ] مسار GPS يُخزَّن ويُعرض.
- [ ] استجابات اللوحة بكفاءة.

---

### المرحلة 7 — الاختبار والتقسية (Testing & Hardening)

**الهدف:** تثبيت الجودة والأمن والأداء وقابلية الوصول.

**Testing Tasks:** (مشتركة)
- اختبارات تكامل للتدفقات الحرجة: تسجيل عادة، إتمام مهمة، نقاط/سلسلة، فتح/قفل مستوى، تدفّق «يومي».
- اختبار توافق العقد (Contract tests) ضد `api-contract.md`.
- اختبار حالات الخطأ والأكواد (`VALIDATION_ERROR`, `LEVEL_LOCKED`, `EXTERNAL_SERVICE_ERROR`).

**Backend Tasks:**
- تسجيل مُهيكل + Request IDs.
- مراجعة أمنية نهائية (Auth، النقاط، السلاسل، المستويات، الأدوية الخارجية).
- تدقيق الفهارس والأداء.

**Frontend Tasks** (من `frontend-plan.md` المرحلة F):
- تمرير A11y + Responsive + الأداء (lazy loading) + اتساق الحالات.
- تدقيق متغيّرات البيئة (لا أسرار).

**Infrastructure Tasks:**
- تفعيل المراقبة والتنبيهات استعدادًا للإنتاج.
- اختبار الاستعادة (Restore) ومسودة Runbook.

**Dependencies:** المراحل 1–6.

**Expected Output:** نظام مستقر ومختبَر وجاهز للإطلاق.

**Completion Criteria:**
- [ ] تغطية اختبار للتدفقات الحرجة.
- [ ] لا أخطاء lint/typecheck/build.
- [ ] تدقيق أمني مجتاز.
- [ ] اجتياز A11y/Responsive.

---

### المرحلة 8 — النشر والإطلاق (Deployment & Release)

**الهدف:** نشر نسخة 1.0 على الإنتاج والتحقق النهائي.

**Backend Tasks:**
- نشر Backend على Render/Railway + متغيّرات الإنتاج.
- تفعيل النسخ الاحتياطي الآلي.

**Frontend Tasks:**
- بناء ونشر Expo Web + بناء تطبيقات Android/iOS عبر EAS.

**Database Tasks:**
- إنشاء كل الفهارس في الإنتاج + تحقق النسخ الاحتياطي.

**Integration Tasks:**
- تحقق من نقاط الإنتاج (HTTPS) وFCM الحقيقي.

**Infrastructure Tasks:**
- إتمام قائمة جاهزية الإنتاج (`infra-plan.md` §15).
- تفعيل التنبيهات الكاملة وRunbook.

**Testing Tasks:**
- اختبار دخان (Smoke test) على الإنتاج.
- اختبار حمل للحمل المتوقع.

**Dependencies:** المرحلة 7.

**Expected Output:** نسخة 1.0 حيّة للمستخدم.

**Completion Criteria:**
- [ ] كل قائمة جاهزية الإنتاج مُنجزة.
- [ ] Smoke test ناجح.
- [ ] مراقبة وتنبيهات فعّالة.

---

## 4. استراتيجية التطوير المتوازي (Parallel Development)

| المرحلة | Backend يبدأ | Frontend يبدأ | نقطة التكامل |
|---|---|---|---|
| 1 | يوم 1 | يوم 2 | يوم 6 |
| 2 | يوم 7 | يوم 8 | يوم 14 |
| 3 | يوم 15 | يوم 16 | يوم 22 |
| 4 | يوم 23 | يوم 24 | يوم 30 |
| 5 | يوم 31 | يوم 32 | يوم 36 |
| 6 | يوم 37 | يوم 38 | يوم 42 |
| 7 | يوم 43 | يوم 44 | يوم 48 |
| 8 | يوم 49 | يوم 50 | يوم 53 |

**كيف يعمل Frontend قبل جهوزية endpoints:**
- استخدام mocks تطابق `api-contract.md` تمامًا (نفس DTOs، الصفحات، أكواد الخطأ).
- الـ mocks في `src/mocks/` وتُستبدل عبر adapter عميل API.
- عند جهوزية endpoint: تغيير سطر واحد في عميل API للإشارة إلى العنوان الحقيقي.

**كيف يتحقق Backend من توافق العقد:**
- تشغيل `npm run test:contract` ضد Backend محلي.
- فحوصات request/response مقابل `api-contract.md`.

---

## 5. تعريف الإنجاز لكل مرحلة (Definition of Done per Phase)

- [ ] كل endpoints المرحلة منفّذة وتطابق `api-contract.md`.
- [ ] كل شاشات المرحلة مبنية وتستخدم mocks (أو endpoints حقيقية).
- [ ] اختبارات Handshake تنجح (يدويًا أو آليًا).
- [ ] لا أخطاء lint/type في Backend أو Frontend.
- [ ] قواعد عمل المرحلة مغطّاة باختبارات تكامل.
- [ ] التحقق من Responsive على نافذة موبايل وأخرى سطح مكتب.
- [ ] نشر المرحلة على بيئة Staging مشتركة + عرض للفريق.

---

## 6. إدارة المخاطر وخطة التراجع (Risk & Rollback)

| المخاطرة | التخفيف | التراجع |
|---|---|---|
| تغيير كاسر في العقد | مراجعة أسبوعية للعقد؛ أي انحراف يتطلب تعليق PR + موافقة | إرجاع PR؛ إعادة نشر النسخة السابقة |
| تأخّر endpoint | Frontend يواصل بالـ mocks؛ تأجيل handshake | لا تراجع — الـ mocks تبقي Frontend غير متوقف |
| فشل FCM | إشعارات in-app كبديل داخل التطبيق | تعطيل push والاعتماد على in-app |
| خطأ ترحيل بيانات | كل الترحيلات idempotent ومُختبرة على Staging | استعادة من نسخة احتياطية + إعادة تطبيق الترحيلات |
| خطأ إنتاج في الواجهة | Feature flags لكل مرحلة | تعطيل العلم + نشر إصلاح فوري |
| فشل خدمة خارجية (HF/Maps) | معالجة `EXTERNAL_SERVICE_ERROR` وfallback واجهة | تعطيل الميزة مؤقتًا |

---

## 7. التواصل والاجتماعات

- **Standup يومي (15 د)** — تزامن على تقدم handshake والعوائق وتغييرات العقد.
- **اجتماع handshake للمرحلة (30 د)** — عرض التكامل، تحقق نقاط الفحص، توقيع الاعتماد.
- **مراجعة تغييرات العقد (async)** — أي PR يعدّل `api-contract.md` يتطلب موافقة الفريقين.

---

## 8. بعد MVP

- مزامنة أوفلاين كاملة.
- تحليلات وإحصاءات متقدمة.
- تعدد المستخدمين/المشاركة (توسيع وحدة Auth/User).
- اكتشاف ملاحظات مفتوحة: Q1–Q5 في `architecture.md`.
- مواد تفاعلية متقدمة للإنجليزية والقرآن.

---

> **هذه الوثيقة حيّة.** تُحدَّث كلما تغيّر عقد الـ API أو المعمارية بشكل جوهري.
