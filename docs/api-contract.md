# رغد — عقد الـ API (API Contract)

**مواصفة التواصل بين Frontend وBackend**
وثيقة مرافقة لـ `architecture.md`
النسخة 1.0 — MVP

> هذه الوثيقة هي **مصدر الحقيقة** لأشكال الطلب والاستجابة لكل نقطة نهاية HTTP.
> يجب على فريقي Frontend وBackend إبقاء الكود متوافقًا مع هذا الملف. عند وجود اختلاف: إمّا تُصحَّح الشفرة أو تُحدَّث الوثيقة — ولا يُترك أي انحراف.

---

## جدول المحتويات

1. الاتفاقيات (Conventions)
2. Auth
3. Users / Profile / Settings
4. Habits
5. Habit Logs
6. Tasks
7. Daily
8. Projects
9. Project Nodes
10. Goals
11. Calendar
12. Gamification (Points & Streaks)
13. Reading (Books)
14. Quran
15. English
16. Brotherhood (المراجعة للأخوة)
17. Money (جمع المصروف)
18. Media (Programs / Journal / Beek Ideas)
19. Hasaniya (Hugging Face)
20. Notifications
21. Progress & Dashboard
22. Integrations
23. Appendix A — Shared DTOs
24. Appendix B — Error Codes

**الإجمالي: 78 نقطة نهاية REST** *(يُحدَّث العدد عند أي تغيير).*

---

## 1. الاتفاقيات (Conventions)

### 1.1 Base URL والإصدارات

```
Production : https://api.raghad.app/v1
Staging    : https://api.staging.raghad.app/v1
Local      : http://localhost:3001/v1
```

### 1.2 التوثيق (Authentication)

كل النقاط تتطلب `Bearer token` إلا ما اتُّفق على أنه **Public**.

```
Authorization: Bearer <accessToken>
```

- عمر accessToken: قصير (15 دقيقة — **Assumption A8**، يُضبط حسب الحاجة).
- عمر refreshToken: 7 أيام، مخزّن في DB.
- عند 401 بالرمز `TOKEN_EXPIRED` يجب على الواجهة استدعاء `POST /auth/refresh` وإعادة المحاولة مرة واحدة.
- تغيير كلمة المرور يُبطل كل refresh tokens للمستخدم.

### 1.3 غلاف الاستجابة الموحّد

المغلّف موحّد لكل استجابة (نجاح أو فشل):

```json
{
  "success": true,
  "data": { },
  "error": null,
  "meta": null
}
```

عند الخطأ:

```json
{
  "success": false,
  "data": null,
  "error": { "code": "ERR_CODE", "message": "وصف مقروء", "fields": { "field": "reason" } },
  "meta": null
}
```

`meta` يُستعمل فقط في القوائم المُرقّمة:

```json
"meta": { "page": 1, "limit": 20, "total": 150 }
```

### 1.4 أكواد حالة HTTP

| الكود | متى |
|---|---|
| 200 OK | قراءة أو تحديث ناجح |
| 201 Created | إنشاء مورد |
| 204 No Content | نجاح الحذف بدون جسم |
| 400 Validation error | جسم/استعلام غير صالح |
| 401 Unauthenticated | توكن مفقود/غير صالح/منتهٍ |
| 403 Forbidden | مصرّح لكن بلا صلاحية |
| 404 Not found | المورد غير موجود |
| 409 Conflict | تكرار أو انتقال حالة غير مسموح |
| 422 Unprocessable | خطأ منطقي (مثال: نقص مخزون/مبلغ غير صالح) |
| 500 Internal server error | خطأ غير متوقّع |

### 1.5 أكواد الخطأ الموحّدة

| الكود | HTTP | الوصف |
|---|---|---|
| AUTH_REQUIRED | 401 | لا توكن مُقدَّم |
| TOKEN_EXPIRED | 401 | انتهت صلاحية access token — استدعِ /auth/refresh |
| TOKEN_INVALID | 401 | توقيع التوكن غير صالح أو مُبطَل |
| FORBIDDEN | 403 | لا صلاحية |
| NOT_FOUND | 404 | المورد غير موجود |
| VALIDATION_ERROR | 400 | فشل التحقق (تفاصيل في error.fields) |
| DUPLICATE | 409 | تعارض قيد فريد |
| INVALID_STATE | 409 | العملية غير مسموحة في الحالة الحالية |
| LEVEL_LOCKED | 409 | لا يمكن فتح مستوى قبل إنهاء السابق |
| UNPROCESSABLE | 422 | عملية غير منطقية (مثال: قيمة سالبة، ترتيب غير صالح) |
| EXTERNAL_SERVICE_ERROR | 502 | فشل خدمة خارجية (Hugging Face) |
| INTERNAL | 500 | خطأ خادم غير معالَج |

### 1.6 Pagination

Offset-based لكل قوائم العرض: `?page=1&limit=20`. الافتراضي `limit=20`، الأقصى `100`. الـ `meta` تحوي `page, limit, total`.

### 1.7 أنواع الحقول

- `ObjectId` → نص 24 hex: `"65f2a1b3c4d5e6f7a8b9c0d1"`
- `timestamp` → ISO 8601 UTC: `"2025-06-16T14:32:11.000Z"`
- `date` → تاريخ محلي (اليوم) كـ ISO: `"2025-06-16T00:00:00.000Z"`
- `points` / `amount` → أعداد صحيحة
- `HH:mm` → نص توقيت محلي

### 1.8 الترميز المستخدم في هذا المستند

```
### METHOD /path
**Auth:** Public | Bearer | **Role:** owner
```
- Auth: `Public` (بلا توكن) أو `Bearer`.
- Role: `owner` في MVP (حساب واحد).

---

## 2. Auth

### 2.1 POST /auth/register

**Auth:** Public
الوصف: إنشاء حساب جديد (دور `owner` فقط) — يعيد الجلسة مباشرة مثل تسجيل الدخول.

جسم الطلب
```json
{ "name": "string (min 2, max 100)", "email": "user@example.com", "password": "string (min 8)" }
```

استجابة النجاح (201)
```json
{
  "success": true,
  "data": {
    "user": { /* User DTO */ },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "accessTokenExpiresAt": "2025-06-16T15:00:00.000Z",
    "refreshTokenExpiresAt": "2025-06-23T14:32:11.000Z"
  },
  "error": null,
  "meta": null
}
```

أخطاء
| HTTP | Code | متى |
|---|---|---|
| 400 | VALIDATION_ERROR | حقل ناقص أو غير صالح |
| 409 | DUPLICATE | البريد الإلكتروني مسجّل بالفعل |
| 429 | RATE_LIMIT_EXCEEDED | تجاوز حد محاولات التسجيل |

### 2.2 POST /auth/login

**Auth:** Public
الوصف: تسجيل الدخول.

جسم الطلب
```json
{ "email": "user@example.com", "password": "string" }
```

استجابة النجاح (200)
```json
{
  "success": true,
  "data": {
    "user": { /* User DTO */ },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "accessTokenExpiresAt": "2025-06-16T15:00:00.000Z",
    "refreshTokenExpiresAt": "2025-06-23T14:32:11.000Z"
  },
  "error": null,
  "meta": null
}
```

أخطاء
| HTTP | Code | متى |
|---|---|---|
| 401 | AUTH_REQUIRED | بيانات الدخول خاطئة |
| 403 | FORBIDDEN | الحساب معطّل |

### 2.3 POST /auth/refresh
**Auth:** Public (refresh token في الجسم)
```json
{ "refreshToken": "string" }
```
استجابة 200 — نفس شكل `/auth/login`.

| HTTP | Code |
|---|---|
| 401 | TOKEN_INVALID |

### 2.4 POST /auth/logout
**Auth:** Bearer — الجسم فارغ. استجابة 204.

### 2.5 GET /auth/me
**Auth:** Bearer — استجابة 200: `User DTO`.

---

## 3. Users / Profile / Settings

### 3.1 PUT /users/me
**Auth:** Bearer | Role: owner
تحديث الملف الشخصي (الاسم، كلمة المرور).
```json
{ "name": "string", "password": "string (min 8)", "timezone": "string" }
```
استجابة 200: `User DTO`.

### 3.2 GET /users/me/settings
**Auth:** Bearer — استجابة 200: `UserSettings DTO`.

### 3.3 PUT /users/me/settings
**Auth:** Bearer
```json
{
  "theme": "light|dark",
  "language": "ar",
  "notificationsEnabled": true,
  "reminderLeadMinutes": 5
}
```
استجابة 200: `UserSettings DTO`.

---

## 4. Habits

### 4.1 POST /habits
**Auth:** Bearer
```json
{
  "name": "string (required, min 2, max 100)",
  "type": "daily|seasonal",
  "category": "spiritual|health|study|social|financial|other",
  "timeSlot": "morning|evening|allTime|flexible",
  "isHobby": false,
  "suggestedTime": "05:00",
  "config": { "special": "none|quran|reading|english|exercise|brotherhood|family|pockets|programs|money|beek" }
}
```
استجابة 201: `Habit DTO`.

### 4.2 GET /habits
**Auth:** Bearer
Query: `page`, `limit`, `type`, `category`, `timeSlot`, `isHobby`, `active`, `search`
استجابة 200: قائمة `Habit DTO`.

### 4.3 GET /habits/:id
**Auth:** Bearer — استجابة 200: `Habit DTO` + `streak` + `stats` (أيام القيام، نسبة النجاح، نسبة الإخفاق).

### 4.4 PUT /habits/:id
**Auth:** Bearer — نفس حقول الإنشاء (كلها اختيارية). استجابة 200: `Habit DTO`.

### 4.5 DELETE /habits/:id
**Auth:** Bearer — استجابة 204. (Soft-delete عبر `active=false` **Assumption A9** لحفظ السجلات التاريخية).

### 4.6 POST /habits/:id/seasonal-schedule
**Auth:** Bearer
جدولة عادة موسمية عند تمام الشهر أو اقتراب 3 أيام منه.
```json
{ "day": "2025-06-28T00:00:00.000Z", "remindDaysBefore": 3 }
```
استجابة 201: `SeasonalSchedule DTO`.

---

## 5. Habit Logs

### 5.1 POST /habit-logs
**Auth:** Bearer
تسجيل تنفيذ عادة (زر «تم التنفيذ») → +نقطة + تحديث السلسلة.
```json
{
  "habitId": "ObjectId",
  "date": "2025-06-16T00:00:00.000Z",
  "status": "completed|skipped",
  "note": "string (optional)",
  "metadata": {
    "hizb": "string", "durationMinutes": 30,
    "distanceKm": 3.2, "route": [ { "lat": 18.0, "lng": -15.9 } ]
  }
}
```
استجابة 201
```json
{
  "success": true,
  "data": {
    "log": { /* HabitLog DTO */ },
    "pointsDelta": 1,
    "streak": { "current": 13, "longest": 30 }
  },
  "error": null, "meta": null
}
```
أخطاء: `404 NOT_FOUND` (عادة غير موجودة)، `409 DUPLICATE` (سجل اليوم موجود — استخدم PUT).

### 5.2 GET /habit-logs
**Auth:** Bearer
Query: `habitId`, `from`, `to`, `status`, `page`, `limit`
استجابة 200: قائمة `HabitLog DTO`.

### 5.3 GET /habit-logs/:id
**Auth:** Bearer — استجابة 200: `HabitLog DTO`.

### 5.4 PUT /habit-logs/:id
**Auth:** Bearer — تحديث سجل (ملاحظة/حالة/metadata). استجابة 200: `HabitLog DTO`.

### 5.5 DELETE /habit-logs/:id
**Auth:** Bearer — استجابة 204 (يُعاد احتساب النقاط/السلسلة).

### 5.6 GET /habits/:id/history
**Auth:** Bearer — السجل المؤرخ للعادة (لصفحات مثل قيام الليل). استجابة 200: قائمة `HabitLog DTO`.

---

## 6. Tasks

### 6.1 POST /tasks
**Auth:** Bearer
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "type": "manual|project|study|work|islamic",
  "projectId": "ObjectId (optional)",
  "nodeId": "ObjectId (optional)",
  "date": "2025-06-16T00:00:00.000Z",
  "startTime": "14:00",
  "priority": "low|medium|high",
  "pointsReward": 1
}
```
استجابة 201: `Task DTO`.

### 6.2 GET /tasks
**Auth:** Bearer
Query: `date`, `from`, `to`, `projectId`, `status`, `type`, `page`, `limit`
استجابة 200: قائمة `Task DTO`.

### 6.3 GET /tasks/:id — استجابة 200: `Task DTO`.
### 6.4 PUT /tasks/:id — تحديث (بما فيه `status`). استجابة 200: `Task DTO`.
### 6.5 DELETE /tasks/:id — استجابة 204.
### 6.6 PATCH /tasks/:id/status
**Auth:** Bearer
```json
{ "status": "todo|done|deferred" }
```
استجابة 200: `Task DTO` + `pointsDelta`.

---

## 7. Daily (صفحة «يومي»)

### 7.1 GET /daily
**Auth:** Bearer
Query: `date` (افتراضي: اليوم)
الوصف: تجميع موحّد: العادات الثابتة + مهام المشاريع المستحقة + المهام اليدوية مرتبةً زمنيًا.
استجابة 200
```json
{
  "success": true,
  "data": {
    "date": "2025-06-16T00:00:00.000Z",
    "habits": [ { /* DailyHabitItem: Habit DTO + log status */ } ],
    "tasks": [ /* Task DTO[] */ ],
    "summary": { "totalItems": 20, "completed": 8, "points": 8 },
    "endOfDay": { "score": 40, "message": null }
  },
  "error": null, "meta": null
}
```

### 7.2 GET /daily/end-of-day
**Auth:** Bearer
Query: `date`
الوصف: معدل اليوم + عبارة تقدير/تأنيب تفاعلية.
استجابة 200
```json
{
  "success": true,
  "data": {
    "date": "2025-06-16T00:00:00.000Z",
    "ratePercent": 72,
    "pointsEarned": 8,
    "pointsLost": 2,
    "mood": "praise|encourage|blame",
    "message": "أحسنت! استمر ولا تقطع السلسلة."
  },
  "error": null, "meta": null
}
```

---

## 8. Projects

### 8.1 POST /projects
**Auth:** Bearer
```json
{
  "key": "lb|supnum|basma_tech|competitions|messages_gaza|hasaniya|ai_depth",
  "name": "string",
  "structureType": "notes_board|tree_cards|goals_pages|calendar_notes|level_game|card_sets",
  "description": "string (optional)"
}
```
استجابة 201: `Project DTO`.

### 8.2 GET /projects — استجابة 200: قائمة `Project DTO` (مع `progress`).
### 8.3 GET /projects/:id — استجابة 200: `Project DTO` + عقد/إحصاءات مختصرة.
### 8.4 PUT /projects/:id — استجابة 200: `Project DTO`.
### 8.5 DELETE /projects/:id — استجابة 204.
### 8.6 GET /projects/:id/achievements
**Auth:** Bearer — إنجازات المشروع (خاصة + عامة). استجابة 200: `{ milestones: [], progress: 0 }`.

---

## 9. Project Nodes

> بنية شجرية عامة تمثّل الملفات، اللوحات، الأعمدة، البطاقات، الأوراق، الملاحظات، الأهداف، المستويات داخل المشاريع.

### 9.1 POST /projects/:id/nodes
**Auth:** Bearer
```json
{
  "parentId": "ObjectId|null",
  "type": "file|board|column|card|leaf|note|goal|level",
  "title": "string",
  "order": 0,
  "data": { }
}
```
استجابة 201: `ProjectNode DTO`.

### 9.2 GET /projects/:id/nodes
Query: `parentId`, `type`, `status`, `page`, `limit`
استجابة 200: قائمة `ProjectNode DTO`.

### 9.3 PUT /nodes/:id — تحديث (بما فيه `status` و`order`). استجابة 200: `ProjectNode DTO`.
### 9.4 DELETE /nodes/:id — استجابة 204 (حذف شجري للأبناء).
### 9.5 PATCH /nodes/:id/status
```json
{ "status": "todo|in_progress|done" }
```
استجابة 200: `ProjectNode DTO`.
- أخطاء خاصة: `409 LEVEL_LOCKED` إذا حاول المستخدم إتمام/فتح مستوى دون إنهاء السابق.

---

## 10. Goals

### 10.1 POST /goals
**Auth:** Bearer
```json
{
  "title": "string",
  "scope": "global|project",
  "projectId": "ObjectId|null",
  "target": 100,
  "current": 0,
  "deadline": "2025-12-31T00:00:00.000Z|null"
}
```
استجابة 201: `Goal DTO`.

### 10.2 GET /goals — Query: `scope`, `projectId`, `status`. استجابة 200: قائمة `Goal DTO`.
### 10.3 GET /goals/:id — استجابة 200: `Goal DTO` + `progressPercent`.
### 10.4 PUT /goals/:id — استجابة 200: `Goal DTO`.
### 10.5 DELETE /goals/:id — استجابة 204.

---

## 11. Calendar

### 11.1 POST /calendar/events
**Auth:** Bearer
```json
{
  "title": "string",
  "date": "2025-06-16T00:00:00.000Z",
  "endDate": "null",
  "type": "task|habit|project|goal|reminder|custom",
  "refId": "ObjectId|null",
  "projectId": "ObjectId|null",
  "note": "string"
}
```
استجابة 201: `CalendarEvent DTO`.

### 11.2 GET /calendar/events
Query: `from`, `to`, `type`, `projectId`, `page`, `limit`
استجابة 200: قائمة `CalendarEvent DTO`.

### 11.3 GET /calendar/main
**Auth:** Bearer — الروزنامة الرئيسية (سابقة/قادمة).
Query: `from`, `to`
استجابة 200: `{ past: [], upcoming: [] }`.

### 11.4 GET /calendar/events/:id — استجابة 200: `CalendarEvent DTO`.
### 11.5 PUT /calendar/events/:id — استجابة 200: `CalendarEvent DTO`.
### 11.6 DELETE /calendar/events/:id — استجابة 204.

---

## 12. Gamification (Points & Streaks)

### 12.1 GET /gamification/points
**Auth:** Bearer
Query: `from`, `to`, `reason`, `page`, `limit`
استجابة 200: قائمة `PointEntry DTO` (سجل الشفافية).
`meta` إضافي: `{ "totalEarned": 120, "totalLost": 10, "net": 110 }`.

### 12.2 GET /gamification/streaks
**Auth:** Bearer — استجابة 200: قائمة `{ habitId, habitName, current, longest }`.
### 12.3 GET /gamification/stats
**Auth:** Bearer — معدلات يومية/أسبوعية/شهرية.
```json
{
  "success": true,
  "data": {
    "today": { "earned": 8, "lost": 2 },
    "week": { "ratePercent": 80 },
    "month": { "ratePercent": 76 },
    "habitsWeekly": [ { "habitId": "...", "ratePercent": 90 } ]
  }
}
```
### 12.4 GET /gamification/levels
**Auth:** Bearer — استجابة 200: `{ currentLevel: 3, points: 420, nextLevelAt: 500, history: [] }`.

---

## 13. Reading (القراءة)

### 13.1 GET /reading/books
Query: `status`, `search`, `sort` (أبجدي), `page`, `limit`
استجابة 200: قائمة `Book DTO`.

### 13.2 GET /reading/books/:id — استجابة 200: `Book DTO` + `notes`.
### 13.3 POST /reading/books
```json
{
  "title": "string",
  "author": "string",
  "pdfUrl": "string",
  "order": 1
}
```
استجابة 201: `Book DTO` (بحالة `locked` إلا إذا كان الأول).

### 13.4 PUT /reading/books/:id
```json
{ "bookmarkPage": 42, "notes": "string", "status": "completed" }
```
استجابة 200: `Book DTO`.
أخطاء: `409 LEVEL_LOCKED` عند محاولة فتح/إتمام كتاب يتجاوز المستوى غير المكتمل.

### 13.5 GET /reading/books/:id/notes — استجابة 200: قائمة الملاحظات.
### 13.6 POST /reading/books/:id/notes — `{ "text": "string", "page": 42 }` → 201.

---

## 14. Quran

### 14.1 GET /quran/plan
**Auth:** Bearer — استجابة 200: `QuranPlan DTO`.
### 14.2 PUT /quran/plan
```json
{
  "reviewHizbs": 25,
  "dailyHizbs": 15,
  "weeklyRestEnabled": true,
  "currentHizb": 3,
  "currentPhase": "review|new_daily|new_weekly"
}
```
استجابة 200: `QuranPlan DTO`.
### 14.3 POST /quran/logs
```json
{
  "date": "2025-06-16T00:00:00.000Z",
  "hizb": "string",
  "phase": "review|new_daily|new_weekly",
  "durationMinutes": 30
}
```
استجابة 201: `QuranLog DTO` + `nextPhaseSuggestion`.
### 14.4 GET /quran/logs — Query: `from`, `to`, `phase`. استجابة 200: قائمة `QuranLog DTO`.
### 14.5 GET /quran/next
**Auth:** Bearer — استجابة 200: `{ suggestedHizb: "string", phase: "review", reason: "string" }`.

---

## 15. English

### 15.1 GET /english/levels
Query: `skill` (reading|writing|listening|speaking)
استجابة 200: قائمة `EnglishLevel DTO` (مع حالة الفتح).
### 15.2 GET /english/progress
استجابة 200: `{ reading: {...}, writing: {...}, listening: {...}, speaking: {...} }`.
### 15.3 POST /english/levels/:id/complete
```json
{ "score": 80 }
```
استجابة 200: `{ level: {...}, unlockedNext: {...}, progress: {...} }`.
أخطاء: `409 LEVEL_LOCKED` عند إتمام مستوى قبل إنهاء السابق.
### 15.4 GET /english/levels/:id — استجابة 200: `EnglishLevel DTO` + المحتوى.

---

## 16. Brotherhood (المراجعة للأخوة)

### 16.1 POST /brotherhood/students
```json
{
  "name": "string",
  "group": "senior|junior",
  "materials": ["string"]
}
```
استجابة 201: `Student DTO`.

### 16.2 GET /brotherhood/students — Query: `group`, `search`. استجابة 200: قائمة `Student DTO`.
### 16.3 GET /brotherhood/students/:id — استجابة 200: `Student DTO` + `sessions`.
### 16.4 PUT /brotherhood/students/:id — تحديث (المواد، الدروس، التمارين، الصور). استجابة 200: `Student DTO`.
### 16.5 DELETE /brotherhood/students/:id — استجابة 204.
### 16.6 POST /brotherhood/students/:id/lessons — `{ "title": "string" }` → 201.
### 16.7 PATCH /brotherhood/students/:id/lessons/:lessonId
```json
{ "status": "done|pending" }
```
→ 200.
### 16.8 POST /brotherhood/students/:id/exercises — `{ "title": "string" }` → 201.
### 16.9 POST /brotherhood/students/:id/photos — `multipart/form-data` ملف صورة → 201: `{ "url": "..." }`.
### 16.10 POST /brotherhood/sessions
```json
{
  "studentId": "ObjectId",
  "date": "2025-06-16T00:00:00.000Z",
  "durationMinutes": 60,
  "note": "string"
}
```
استجابة 201: `BrotherhoodSession DTO`.
### 16.11 PATCH /brotherhood/sessions/:id/defer — زر تأجيل. استجابة 200.
### 16.12 GET /brotherhood/sessions — Query: `from`, `to`, `studentId`. استجابة 200: قائمة.

---

## 17. Money (جمع المصروف)

### 17.1 POST /money/entries
```json
{ "amount": 500, "source": "string", "note": "string", "date": "2025-06-16T00:00:00.000Z" }
```
استجابة 201: `MoneyEntry DTO`.
### 17.2 GET /money/entries — Query: `from`, `to`, `source`, `page`, `limit`. استجابة 200: قائمة + `meta.totalAmount`.
### 17.3 GET /money/summary — استجابة 200: `{ total: 12500, bySource: [...], byMonth: [...] }`.
### 17.4 DELETE /money/entries/:id — استجابة 204.

---

## 18. Media (Programs / Journal / Beek Ideas)

### 18.1 GET /media/items
Query: `kind` (program|journal|beek_idea), `projectId`, `from`, `to`, `page`, `limit`
استجابة 200: قائمة `MediaItem DTO`.
### 18.2 POST /media/items
```json
{
  "kind": "program|journal|beek_idea",
  "title": "string",
  "body": "string",
  "projectId": "ObjectId|null",
  "tags": ["string"]
}
```
استجابة 201: `MediaItem DTO`.
### 18.3 GET /media/items/:id — استجابة 200: `MediaItem DTO`.
### 18.4 PUT /media/items/:id — استجابة 200: `MediaItem DTO`.
### 18.5 DELETE /media/items/:id — استجابة 204.
### 18.6 POST /media/items/:id/watch — تسجيل مشاهدة برنامج. استجابة 200: `MediaItem DTO` (watchedAt محدّث).

---

## 19. Hasaniya (Hugging Face)

### 19.1 POST /hasaniya/fetch
**Auth:** Bearer
الوصف: جلب جمل من Hugging Face (يمرّ عبر Backend لإخفاء المفتاح).
```json
{ "count": 10, "prompt": "string (optional)" }
```
استجابة 200: قائمة `{ "text": "string", "translation": "string|null" }`.
أخطاء: `502 EXTERNAL_SERVICE_ERROR`.

### 19.2 GET /hasaniya/cards
Query: `type` (hasaniya|translated|qa|dictionary), `search`, `page`, `limit`
استجابة 200: قائمة `HasaniyaCard DTO` + `meta.totalCount`.
### 19.3 POST /hasaniya/cards
```json
{
  "type": "hasaniya|translated|qa|dictionary",
  "text": "string",
  "translation": "string",
  "referenceMark": "string",
  "source": "huggingface|manual"
}
```
استجابة 201: `HasaniyaCard DTO`.
### 19.4 PUT /hasaniya/cards/:id — استجابة 200: `HasaniyaCard DTO`.
### 19.5 DELETE /hasaniya/cards/:id — استجابة 204.
### 19.6 GET /hasaniya/stats — استجابة 200: `{ total: 240, byType: { hasaniya: 100, translated: 80, qa: 30, dictionary: 30 } }`.

---

## 20. Notifications

### 20.1 GET /notifications
Query: `unreadOnly`, `type`, `page`, `limit`
استجابة 200 + `meta.unreadCount`.
### 20.2 PATCH /notifications/:id/read — استجابة 200: `{ "_id": "...", "isRead": true, "readAt": "..." }`.
### 20.3 PATCH /notifications/read-all — استجابة 200: `{ "updatedCount": 12 }`.
### 20.4 POST /notifications/device-token
**Auth:** Bearer — تسجيل توكن FCM للجهاز.
```json
{ "token": "string", "platform": "web|android|ios" }
```
استجابة 201.

---

## 21. Progress & Dashboard

### 21.1 GET /progress/overview
**Auth:** Bearer — خريطة التقدم الشاملة.
```json
{
  "success": true,
  "data": {
    "projects": [ { "projectId": "...", "name": "LB", "achievementPercent": 60 } ],
    "habits": { "dailyCompletionPercent": 82, "totalPoints": 420, "activeStreakMax": 30 },
    "goals": { "achieved": 3, "active": 5 }
  }
}
```
### 21.2 GET /progress/projects/:id — تفصيل تقدم مشروع. استجابة 200: `{ goalAchievement: 0, milestones: [], nodesProgress: {} }`.
### 21.3 GET /dashboard
**Auth:** Bearer — لوحة اليوم.
```json
{
  "success": true,
  "data": {
    "todayStats": { "habitsDone": 8, "habitsTotal": 20, "tasksDone": 5, "points": 8 },
    "streaks": [ { "habitName": "القراءة", "current": 12 } ],
    "upcomingEvents": [ /* CalendarEvent DTO[], 5 */ ],
    "unreadNotifications": 3
  }
}
```

---

## 22. Integrations

### 22.1 GET /integrations/status
**Auth:** Bearer — حالة التكاملات (FCM, Maps, HF, Storage). استجابة 200: `{ fcm: "ok", huggingface: "ok", maps: "ok", storage: "ok" }`.
### 22.2 POST /integrations/maps/route
**Auth:** Bearer — حفظ مسار الرياضة الصباحية بعد التتبّع.
```json
{
  "habitId": "ObjectId",
  "date": "2025-06-16T00:00:00.000Z",
  "distanceKm": 3.2,
  "route": [ { "lat": 18.0, "lng": -15.9 } ]
}
```
استجابة 201: `HabitLog DTO` (يُحدَّث metadata).

---

## 23. Appendix A — Shared DTOs

### 23.1 User
```json
{
  "_id": "65f...",
  "name": "string",
  "email": "user@example.com",
  "role": "owner",
  "timezone": "Africa/Nouakchott",
  "settings": { "theme": "light", "language": "ar", "notificationsEnabled": true, "reminderLeadMinutes": 5 },
  "createdAt": "2025-06-01T00:00:00.000Z",
  "lastActiveAt": "2025-06-16T14:30:00.000Z"
}
```

### 23.2 Habit
```json
{
  "_id": "65f...",
  "name": "القراءة",
  "type": "daily",
  "category": "study",
  "timeSlot": "flexible",
  "isHobby": true,
  "suggestedTime": null,
  "order": 5,
  "active": true,
  "config": { "special": "reading" },
  "pointsPerCompletion": 1,
  "pointsPenaltyIfMissed": 1
}
```

### 23.3 HabitLog
```json
{
  "_id": "65f...",
  "habitId": "65f...",
  "date": "2025-06-16T00:00:00.000Z",
  "status": "completed",
  "completedAt": "2025-06-16T06:12:00.000Z",
  "points": 1,
  "note": "قرأت 30 صفحة",
  "metadata": { "bookId": "65f...", "page": 42 }
}
```

### 23.4 Task
```json
{
  "_id": "65f...",
  "title": "دراسة جامعية",
  "description": "",
  "type": "study",
  "projectId": null,
  "nodeId": null,
  "date": "2025-06-16T00:00:00.000Z",
  "startTime": "09:00",
  "status": "todo",
  "priority": "high",
  "source": "recurring",
  "pointsReward": 1
}
```

### 23.5 Project
```json
{
  "_id": "65f...",
  "key": "lb",
  "name": "LB",
  "structureType": "notes_board",
  "description": "string",
  "active": true,
  "progress": 60
}
```

### 23.6 ProjectNode
```json
{
  "_id": "65f...",
  "projectId": "65f...",
  "parentId": null,
  "type": "board",
  "title": "مهام",
  "status": "todo",
  "order": 0,
  "data": {}
}
```

### 23.7 Goal
```json
{
  "_id": "65f...",
  "title": "قراءة 100 كتاب",
  "scope": "global",
  "projectId": null,
  "target": 100,
  "current": 40,
  "deadline": "2025-12-31T00:00:00.000Z",
  "status": "active"
}
```

### 23.8 CalendarEvent
```json
{
  "_id": "65f...",
  "title": "مسابقة",
  "date": "2025-07-01T00:00:00.000Z",
  "endDate": null,
  "type": "project",
  "refId": "65f...",
  "projectId": "65f...",
  "note": "string"
}
```

### 23.9 PointEntry
```json
{
  "_id": "65f...",
  "date": "2025-06-16T00:00:00.000Z",
  "amount": 1,
  "reason": "habit_completed",
  "refType": "habit",
  "refId": "65f...",
  "note": "القراءة"
}
```

### 23.10 Book
```json
{
  "_id": "65f...",
  "title": "string",
  "author": "string",
  "level": 3,
  "status": "unlocked",
  "pdfUrl": "https://...",
  "bookmarkPage": 42,
  "notes": "string",
  "completedAt": null
}
```

### 23.11 QuranPlan
```json
{
  "reviewHizbs": 25,
  "dailyHizbs": 15,
  "weeklyRestEnabled": true,
  "currentHizb": 3,
  "currentPhase": "review"
}
```

### 23.12 EnglishLevel
```json
{
  "_id": "65f...",
  "index": 1,
  "skill": "reading",
  "title": "المستوى الأول",
  "status": "unlocked",
  "contentRef": "string"
}
```

### 23.13 Student
```json
{
  "_id": "65f...",
  "name": "string",
  "group": "senior",
  "materials": ["التفسير"],
  "lessons": [ { "id": "65f...", "title": "string", "status": "pending" } ],
  "exercises": [ { "id": "65f...", "title": "string", "done": false } ],
  "photos": ["https://..."]
}
```

### 23.14 MoneyEntry
```json
{
  "_id": "65f...",
  "amount": 500,
  "source": "عمل",
  "note": "string",
  "date": "2025-06-16T00:00:00.000Z"
}
```

### 23.15 MediaItem
```json
{
  "_id": "65f...",
  "kind": "program",
  "title": "بودكاست السويدان",
  "body": "string",
  "projectId": null,
  "watchedAt": "2025-06-16T20:00:00.000Z",
  "tags": ["برامج"]
}
```

### 23.16 HasaniyaCard
```json
{
  "_id": "65f...",
  "type": "hasaniya",
  "text": "string",
  "translation": "string",
  "source": "huggingface",
  "referenceMark": "string",
  "saved": true
}
```

### 23.17 Notification
```json
{
  "_id": "65f...",
  "type": "habit_reminder",
  "title": "تذكير: القراءة",
  "body": "حان وقت القراءة اليومية",
  "isRead": false,
  "readAt": null,
  "data": { "habitId": "65f..." },
  "scheduledAt": "2025-06-16T14:00:00.000Z",
  "sentAt": "2025-06-16T14:00:00.000Z",
  "createdAt": "2025-06-16T13:55:00.000Z"
}
```

---

## 24. Appendix B — Error Codes

| Code | HTTP | الوصف |
|---|---|---|
| AUTH_REQUIRED | 401 | لا توكن أو بيانات دخول خاطئة |
| TOKEN_EXPIRED | 401 | انتهت صلاحية access token |
| TOKEN_INVALID | 401 | توقيع التوكن غير صالح |
| FORBIDDEN | 403 | لا صلاحية |
| NOT_FOUND | 404 | المورد غير موجود |
| VALIDATION_ERROR | 400 | فشل التحقق من المدخلات |
| DUPLICATE | 409 | خرق قيد فريد |
| INVALID_STATE | 409 | عملية غير مسموحة |
| LEVEL_LOCKED | 409 | لا يُفتح مستوى قبل إنهاء السابق |
| UNPROCESSABLE | 422 | عملية غير منطقية |
| EXTERNAL_SERVICE_ERROR | 502 | فشل خدمة خارجية |
| INTERNAL | 500 | خطأ خادم |

---

> **رغد — API Contract — MVP.** مصدر الحقيقة: هذا الملف. يُزامَن مع `architecture.md` للمنطق المعماري وراء كل نقطة نهاية.
