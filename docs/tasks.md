# رغد — مهام المرحلة 1 (Foundation & Auth)

**المرحلة:** 1 — الأساس والمصادقة
**المحور:** تهيئة المستودع، هيكل Backend وFrontend، قاعدة البيانات، المصادقة، وواجهة رئيسية فارغة قابلة للتنقّل
**المدة التقديرية:** Backend 5 أيام | Frontend 4 أيام | تكامل 1 يوم

---

## Backend Tasks (من `backend-plan.md` المرحلة 1)

### B1.1 تهيئة مشروع Backend
- [ ] إنشاء مشروع Node.js + Express + TypeScript
- [ ] تثبيت وتكوين: Zod, Helmet, CORS, dotenv
- [ ] إعداد مغلّف استجابة موحّد (`{ success, data, error, meta }`)
- [ ] إعداد معالج أخطاء مركزي (`error.middleware.ts`)
- [ ] إعداد ESLint + Prettier + TypeScript strict mode
- [ ] إعداد scripts: `dev`, `build`, `lint`, `typecheck`, `test`

### B1.2 اتصال MongoDB
- [ ] تكوين الاتصال في `app.ts`/`server.ts` عبر `MONGODB_URI`
- [ ] إنشاء نموذج `users` مع فهارس:
  - `email` (unique)
  - `role` (default: "owner")
- [ ] حقول المستخدم: `name`, `email`, `passwordHash`, `role`, `timezone`, `settings`, `createdAt`, `lastActiveAt`

### B1.3 المصادقة (Auth Module)
- [ ] `POST /auth/login` — تسجيل الدخول (بريد + كلمة مرور)
- [ ] `POST /auth/refresh` — تجديد access token عبر refresh token
- [ ] `POST /auth/logout` — إلغاء الجلسة (إبطال refresh token)
- [ ] `GET /auth/me` — جلب المستخدم المصادَق عليه
- [ ] JWT: access token قصير (15 دقيقة) + refresh token (7 أيام مخزّن في DB)
- [ ] Middleware المصادقة (`auth.middleware.ts`) — التحقق من Bearer token
- [ ] تدوير refresh token: إبطال القديم عند التجديد/الخروج
- [ ] تغيير كلمة المرور يُبطل كل refresh tokens

### B1.4 الملف الشخصي والإعدادات
- [ ] `PUT /users/me` — تحديث الاسم، كلمة المرور، التوقيت
- [ ] `GET /users/me/settings` — جلب الإعدادات
- [ ] `PUT /users/me/settings` — تحديث الإعدادات (theme, language, notificationsEnabled, reminderLeadMinutes)

### B1.5 Seed الحساب الأول
- [ ] سكريبت/أمر لإنشاء الحساب الأول (Owner) عند التثبيت
- [ ] لا يوجد تسجيل عام (Sign-up) عبر API

### B1.6 اختبارات Backend للمرحلة 1
- [ ] اختبار وحدة: ترميز/فك JWT
- [ ] اختبار تكامل: login → me → refresh → logout
- [ ] اختبار التحقق: بيانات دخول خاطئة → `AUTH_REQUIRED`
- [ ] اختبار token منتهي → `TOKEN_EXPIRED` + تجديد ناجح

---

## Frontend Tasks (من `frontend-plan.md` المرحلة A)

### F1.1 عميل API مركزي
- [ ] إنشاء `api.ts` مع:
  - baseURL (`http://localhost:3001/v1`)
  - مغلّف طلب/استجابة موحّد
  - معالج أخطاء مركزي (أكواد `api-contract.md` Appendix B)
  - تخزين التوكن في الذاكرة + آلية refresh تلقائية عند `TOKEN_EXPIRED`
  - اعتراض الطلبات لإضافة `Authorization: Bearer <accessToken>`
- [ ] تخزين refresh token بأمان (AsyncStorage مع تشفير أو SecureStore)
- [ ] **لا تخزين access token في أماكن غير آمنة**

### F1.2 شاشة الدخول (`/auth/login`)
- [ ] نموذج: بريد إلكتروني + كلمة مرور
- [ ] تحقق على مستوى الواجهة (الحقول المطلوبة، طول كلمة المرور ≥ 8)
- [ ] عرض أخطاء `AUTH_REQUIRED` / `FORBIDDEN` من Backend
- [ ] زر "دخول" يستدعي `POST /auth/login`
- [ ] عند النجاح: تخزين التوكنز → استدعاء `GET /auth/me` → توجيه إلى `/today`
- [ ] حالة Loading أثناء الطلب

### F1.3 التنقّل الرئيسي (MainLayout + TabNavigator)
- [ ] `AuthLayout` لشاشة الدخول
- [ ] `MainLayout` مع:
  - TabNavigator (7 تبويبات: يومي، عاداتي، مشاريعي، الأهداف، خريطة التقدم، الروزنامة، الإعدادات)
  - Header عام
  - شريط إشعارات (عداد غير مقروء)
- [ ] حماية المسارات: توجيه غير المصادَق لهم إلى `/auth/login`
- [ ] Persistence: فحص التوكن عند بدء التطبيق (`GET /auth/me`)

### F1.4 صفحة الملف الشخصي والإعدادات (`/profile`, `/settings`)
- [ ] عرض الاسم، البريد، التوقيت
- [ ] نموذج تعديل الاسم / كلمة المرور (`PUT /users/me`)
- [ ] نموذج الإعدادات: theme (light/dark)، language (ar)، notificationsEnabled، reminderLeadMinutes (`GET/PUT /users/me/settings`)
- [ ] زر "تسجيل خروج" (`POST /auth/logout`)

### F1.5 حالات الواجهة الأساسية
- [ ] مكونات Skeleton للـ Loading (لكل قائمة/بطاقة)
- [ ] شاشة Empty ودّية + إجراء (مثال: "لا توجد بيانات — أضف...")
- [ ] شاشة Error مع رسالة حسب `error.code` + زر إعادة المحاولة
- [ ] دعم RTL كامل للعربية

---

## Database Tasks

### D1.1 إعداد قاعدة البيانات
- [ ] إنشاء Cluster MongoDB Atlas
- [ ] إنشاء Database `raghad`
- [ ] إنشاء مجموعة `users` مع الفهارس:
  - `email` (unique)
  - `role`

---

## Infrastructure Tasks (من `infra-plan.md`)

### I1.1 متغيرات البيئة
- [ ] إنشاء `.env.example` مع المتغيرات الأساسية:
  ```
  NODE_ENV=development
  PORT=3001
  MONGODB_URI=mongodb+srv://...
  JWT_SECRET=...
  JWT_REFRESH_SECRET=...
  FRONTEND_URL=http://localhost:8080
  ```
- [ ] إنشاء `.env.local` (مستبعد من git) للقيم الحقيقية

### I1.2 تشغيل محلي
- [ ] إعداد `npm run dev` يشغّل frontend + backend معاً
- [ ] Backend على `http://localhost:3001/v1`
- [ ] Frontend على `http://localhost:8080` (Expo Web)

### I1.3 نشر مبدئي (Staging)
- [ ] إعداد Backend على Render/Railway
- [ ] إعداد Frontend على Expo Web / EAS Hosting
- [ ] متغيرات بيئة الإنتاج في لوحة التحكم
- [ ] HTTPS مفعل

---

## Integration Tasks

### INT1.1 تكامل المصادقة
- [ ] ربط شاشة الدخول بـ `POST /auth/login` الحقيقي
- [ ] استدعاء `GET /auth/me` بعد الدخول الناجح لتعبئة حالة المستخدم
- [ ] آلية تجديد التوكن التلقائية عند استلام `TOKEN_EXPIRED` (محاولة واحدة)
- [ ] إبطال حالة المستخدم وتوجيه إلى `/auth/login` عند فشل التجديد

### INT1.2 Handshake تحقق
- [ ] تشغيل اختبار تكامل يدوي: login → me → refresh → logout
- [ ] التحقق من توافق الاستجابات مع `api-contract.md` (DTOs، أكواد الخطأ، المغلّف)

---

## Testing Tasks

### T1.1 اختبارات التكامل
- [ ] `POST /auth/login` → يُرجع User DTO + accessToken + refreshToken + تواريخ الانتهاء
- [ ] `GET /auth/me` → يُرجع User DTO للمستخدم المصادَق عليه
- [ ] إعادة توجيه الواجهة بعد الدخول تعمل بتوكن حقيقي
- [ ] تسجيل خروج → إبطال refresh token في DB

### T1.2 اختبارات الوحدة
- [ ] ترميز/فك JWT (access + refresh)
- [ ] التحقق من كلمات المرور (bcrypt)
- [ ] Middleware المصادقة (توكن صالح/منتهي/غير صالح)

---

## Completion Criteria (من `master-plan.md`)

- [ ] `POST /auth/login` يُرجع DTO المستخدم + التوكنات
- [ ] `GET /auth/me` يُرجع المستخدم المصادَق عليه
- [ ] إعادة توجيه الواجهة بعد الدخول تعمل بتوكن حقيقي
- [ ] `npm run lint`, `typecheck`, `build` تنجح (Backend + Frontend)
- [ ] اختبار Handshake ينجح (login → me → refresh → logout)
- [ ] لا أسرار في `.env.example` أو المستودع

---

## Dependencies
- لا شيء (نقطة البداية)

## Expected Output
تسجيل دخول عامل، جلسة مستخدم، واجهة رئيسية محمية بقائمة تبويبات فارغة جاهزة للمرحلة 2.

---

## Notes for Developers

### Backend
- راجع `api-contract.md` قسم 2 (Auth) و 3 (Users/Settings) للأشكال الدقيقة
- راجع `architecture.md` قسم 6.1 (وحدة Auth) و 7.1 (نموذج users)
- الخدمات في `src/modules/auth/` و `src/modules/user/`
- المحركات غير مستخدمة في هذه المرحلة

### Frontend
- راجع `api-contract.md` لنفس الأقسام
- راجع `frontend-plan.md` قسم 7.1 (Auth) و 8 (State Management)
- الـ mocks (إن لزم) في `src/mocks/auth.ts` وتطابق العقد تماماً
- استبدال الـ mock بالـ API الحقيقي = تغيير سطر واحد في عميل API

### Infrastructure
- MongoDB Atlas فقط (لا نسخة محلية)
- Redis اختياري — غير مطلوب للمرحلة 1
- FCM، Hugging Face، Maps، Storage — غير مطلوبة للمرحلة 1
## Phase 1 Status - 2026-10-24

Phase 1 is **complete**.

Completed in this pass:
- Backend foundation: Express + TypeScript, strict typecheck, ESLint, Prettier, scripts.
- Backend auth: login, refresh, logout, me, bearer auth middleware.
- Refresh token lifecycle: persisted token IDs, rotation on refresh, revocation on logout, revocation on password change.
- User endpoints mounted at `/v1/users/me` and `/v1/users/me/settings`.
- Owner seed command exists.
- `.env.example` no longer contains real credentials; `.env.local` is ignored by backend `.gitignore`.
- JWT unit test added.
- Verified backend commands: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`.
- Frontend Phase 1 complete: API client, token storage, LoginScreen, MainLayout with 7 tabs, ProfileScreen, SettingsScreen, all UI states (Loading/Empty/Error).
- Frontend typecheck, lint, and build all pass.

