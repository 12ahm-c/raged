# رغد — خطة البنية التحتية (Infrastructure Plan)

**وثيقة حكامة البنية التحتية لتطبيق «رغد»**
مرافقة لـ `architecture.md` و`backend-plan.md`

---

## 1. الغرض (Purpose)

تحدّد هذه الوثيقة حكامة البنية التحتية لتطبيق «رغد»، وتغطّي: مسؤوليات التشغيل، طوبولوجيا التطوير المحلي، خدمات قاعدة البيانات والتخزين المؤقت، الإشعارات والمهام المجدولة، البيئات، CI/CD، المراقبة، الأسرار، والشبكات.

**المبدأ:** تنفيذ مباشر عبر Node/npm أثناء التطوير. الحاويات (Docker/Compose) **ليست** جزءًا من الخطة المحلية النشطة. إعادة إدخال أي تنسيق حاويات يستلزم موافقة صريحة وتحديث هذه الوثيقة و`master-plan.md` في نفس التغيير.

> **Assumption A6**: Redis اختياري في MVP (يمكن الاستغناء عنه والعمل بالحساب المباشر).
> تطبيق «رغد» **شخصي (Single-User)**؛ لذلك البنية مُصغّرة ومحسّنة للتكلفة والبساطة، دون خدمات غير لازمة.

---

## 2. مسؤوليات التشغيل (Runtime Responsibilities)

يقسم «رغد» المسؤوليات ليبقى النظام عديم الحالة وقابلًا للصيانة.

| Runtime | المسؤولية | أمر محلي |
|---|---|---|
| `frontend` | تطبيق React Native/Expo (Web + Android + iOS) | `npm run dev:app` |
| `backend` | Express REST API + المحركات (Recurrence/Streak/Points) + Cron jobs على `:3001` | `npm run dev:backend` |
| `mongodb` | قاعدة MongoDB Atlas (database `raghad`) — خارجي | Atlas فقط |
| `redis` | تخزين مؤقت اختياري — خارجي | `redis-server` (محلي، اختياري) |
| `storage` | تخزين سحابي لمصادر PDF/الصور — خارجي | مزوّد سحابي |

**بدء التشغيل المحلي (الخدمات الأساسية):**
```bash
npm run dev
```
يشغّل frontend + backend افتراضيًا. لا يوجد runtime منفصل للإشعارات (الإشعارات عبر FCM من داخل Backend).

**قواعد:**
- كل الـ runtimes عديمة الحالة — لا تُخزَّن ملفات أو جلسات أو حالة دائمة على نظام الملفات.
- يتم فصل API عن المهام المجدولة (عمال الخلفية) في نفس الحزمة لكن كعمليات مستقلة عند الحاجة.
- MongoDB دائمًا Atlas؛ لا تُشغَّل نسخة محلية.
- Redis خدمة خارجية اختيارية.

---

## 3. طوبولوجيا التشغيل المحلي (Local Runtime Topology)

```text
المتصفح/الجهاز -> frontend  http://localhost:8080  (Expo Web / Expo Go)
frontend       -> backend REST http://localhost:3001/v1
backend        -> MongoDB Atlas `raghad`, Firebase FCM, Hugging Face, Maps, Storage
backend        -> Redis :6379 (اختياري، للتخزين المؤقت)
```

- كل التواصل الداخلي عبر localhost بمنافذ متمايزة.
- في الإنتاج كل العناوين HTTPS/WSS وأسماء نطاقات مُدارة.

---

## 4. استراتيجية Redis (اختياري)

Redis **اختياري في MVP** ويُوصى به لتحسين أداء التجميعات الثقيلة.

مسؤولياته عند تفعيله:
- **Cache**: تجميعات «يومي» وخريطة التقدم (`daily:*`, `progress:*`) بـ TTL = 5 دقائق.
- **Rate limiting**: عدّادات الطلبات لكل endpoint.
- **JWT deny-list**: تخزين `jti` للتوكنات المُبطَلة حتى انتهاء صلاحيتها.

> لا يُضاف Redis كإلزامي في MVP دون حاجة مُثبتة.

---

## 5. استراتيجية MongoDB

| البيئة | الاستضافة | ملاحظات |
|---|---|---|
| Local | MongoDB Atlas (database `raghad`) | `MONGODB_URI=mongodb+srv://...@.../raghad` |
| Staging | MongoDB Atlas (M2 أو مشترك) | معزولة عن بيانات الإنتاج |
| Production | MongoDB Atlas (M10+ أو مخصّص) | Replica set للتوافر العالي |

**الفهارس المطلوبة (من المعمارية):**
- `habit_logs`: فهرس مركّب فريد `(habitId, date)`.
- `tasks`: `(date)`, `(projectId)`, `(status)`.
- `points_ledger`: `(date)`, `(refType)`.
- `notifications`: `(isRead)`, `(scheduledAt)`.
- `project_nodes`: `(projectId)`, `(parentId)`.
- `calendar_events`: `(date)`, `(projectId)`.

**سلامة البيانات:**
- العمليات التي تمسّ أكثر من مستند (تسجيل عادة + نقطة + سلسلة) تُنفّذ ضمن **transactions** عند الحاجة.
- تغييرات الفهارس تُخطَّط في Pull Requests مع ملاحظات تراجع.

**متطلبات الإطلاق للإنتاج:**
- سياسة نسخ احتياطي آلية (Atlas Backup).
- اختبار استعادة موثّق ومنفّذ.
- RPO ≤ 24h، RTO ≤ 4h.
- التحكم بالوصول عبر IP Whitelist / VPC Peering.

---

## 6. البيئات (Environments)

| البيئة | الغرض | القواعد |
|---|---|---|
| **Local** | تطوير ومرونة قابلة للتكرار | `npm run dev`, `.env.local`, Atlas `raghad`, Redis اختياري، اعتمادات Firebase sandbox |
| **Staging** | تحقق شبيه بالإنتاج | خدمات مُدارة (Atlas، Firebase sandbox)، بيانات معزولة، أسرار بنمط إنتاج، FCM مُفعّل بـ sandbox |
| **Production** | تشغيل فعلي | أسرار مُدارة، HTTPS/WSS كامل، مراقبة، نسخ/استعادة، خطة تراجع |

- لا تُرفع ملفات `.env` أبدًا. يُقدَّم `.env.example` بقيم بديلة آمنة فقط.
- `.env.local` مُستبعَد من git.

---

## 7. استراتيجية النشر (Deployment Strategy)

```
[EAS Hosting / Vercel / Netlify]  → واجهة Expo Web + بناء التطبيقات (Android/iOS via EAS)
[Render / Railway]                → Backend Node.js (instance واحدة في MVP)
[MongoDB Atlas]                   → قاعدة البيانات
[Cloud Storage]                   → PDF والصور
[Firebase FCM]                    → الإشعارات الفورية
[Hugging Face API]                → نصوص مشروع الحسانية
[Redis (اختياري)]                 → تخزين مؤقت
```

**ترقية البيئات:** Local → Staging → Production، وكل ترقية تُشغّل خط CI الكامل.

### 7.1 المراحل من MVP إلى التوسع

| المرحلة | المعمارية | السعة |
|---|---|---|
| MVP | Backend واحد + MongoDB، Redis اختياري، واجهة PWA/موبايل | مستخدم واحد (موسّع: ~آلاف) |
| V1 | نسختا Backend + موازن أحمال، MongoDB M10، Redis إلزامي | ~10k مستخدم فعّال |
| V2 | خدمات مصغّرة (Auth، Habits، Projects، Notifs)، Redis Cluster، MongoDB sharding | +100k |

- لا يُضاف أي عنصر بنية لمجرد وجوده في مرجع مشروع سابق؛ يُضاف فقط عند الحاجة الفعلية.

---

## 8. العمال الخلفية والمهام المجدولة (Workers & Cron)

| التوقيت | المهمة | الوصف |
|---|---|---|
| 00:00 يوميًا | `dailyReset.job` | تهيئة «يومي» والعادات الجديدة |
| 00:00 يوميًا | `dailySummary.job` | ملخص لليوم السابق |
| كل ساعة | `reminder.job` | تذكيرات المواعيد القريبة |
| 23:00 يوميًا | `endOfDay.job` | خصم النقاط + التقييم اليومي |
| يوميًا (فحص شهري) | `seasonalActivation.job` | تفعيل العادات الموسمية قرب نهاية الشهر |

**قواعد:**
- المهام **idempotent** (لا إشعار مزدوج لنفس المحفّز).
- الجدولة بالتوقيت المحلي للمستخدم (`Africa/Nouakchott`) مع تخزين UTC.
- لا حاجة لطوابير (Queues) في MVP لكون التطبيق أحادي المستخدم؛ تُعاد المراجعة عند التوسع.

---

## 9. CI/CD

يُضاف CI فقط بعد موافقة صريحة. مراحل مقترحة:
1. Lint (`npm run lint`)
2. Typecheck (`npm run typecheck`)
3. اختبارات الوحدة/التكامل (`npm run test`)
4. Build (`npm run build`)
5. فحوصات أمنية (لا أسرار في `.env.example`، تدقيق الاعتماديات)

**مهام النشر:**
- منفصلة عن مهام التحقق.
- نشر الإنتاج يتطلب موافقة يدوية حتى يُثبت الاستقرار.
- Staging تلقائي على تحديث الفرع الرئيسي.

---

## 10. المراقبة والتسجيل (Monitoring & Logging)

**التسجيل:**
- سجلات JSON مُهيكلة إلى stdout/stderr لـ Backend والعمال.
- المستويات: error, warn, info, debug (debug في local/staging فقط).
- **لا يُسجَّل أبدًا**: كلمات المرور، التوكنات، أسرار Firebase، Hugging Face، Maps، روابط DB الكاملة، ملفات البيئة.

**مقاييس الإنتاج:**
- زمن استجابة API (p95, p99) ومعدل الأخطاء لكل endpoint.
- نجاح/فشل مهام Cron (خصوصًا `endOfDay` و`dailySummary`).
- معدل أخطاء FCM (توكنات غير صالحة، حدود).
- أداء MongoDB (استعلامات بطيئة، اتصالات).

**تنبيهات مطلوبة قبل الإنتاج:**
- معدل أخطاء API > 5% لـ 5 دقائق.
- فشل نسخ احتياطي.
- عدم اكتمال `dailySummary` بحلول 01:00.

---

## 11. إدارة الأسرار (Secrets Management)

- **Local**: `.env.local` (مُستبعَد) + اعتمادات sandbox.
- **Staging/Production**: مدير أسرار المنصّة (GitHub Secrets / Render / Railway).
- **متغيّرات الواجهة العامة**: فقط `EXPO_PUBLIC_*` الآمنة للعرض. لا مفاتيح خاصة.
- **التدوير**: تدوير أي سر بعد شكّ في تسريبه.
- **Zero-trust**: لا تُلصق الأسرار في أوامر AI أو وصف PR أو السجلات.

**الأسرار المطلوبة:**
```
MONGODB_URI
JWT_SECRET
JWT_REFRESH_SECRET
FIREBASE_SERVICE_ACCOUNT_JSON
HF_API_KEY
MAPS_API_KEY
STORAGE_*            (مفتاح/سر/حاوية التخزين)
REDIS_URL            (اختياري)
```

---

## 12. الشبكات (Networking)

**عناوين التطوير المحلي (ثابتة):**
```text
MongoDB:      MongoDB Atlas via MONGODB_URI, database `raghad`
Redis:        redis://localhost:6379            (اختياري)
Frontend:     http://localhost:8080             (Expo Web)
Backend API:  http://localhost:3001/v1
```

**عناوين الإنتاج:**
- الواجهة: `https://app.raghad.example` (CDN ثابت / EAS Hosting).
- Backend API: `https://api.raghad.example/v1`.

**قواعد:**
- لا تُثبَّت عناوين IP أو روابط المزوّد في الكود.
- كل الاتصالات الخارجية عبر متغيّرات البيئة.
- Staging بنطاق منفصل: `https://staging-api.raghad.example`.

---

## 13. الأمن (Security)

- HTTPS إلزامي في الإنتاج.
- ترويسات آمنة (Helmet).
- Rate limiting على نقاط الدخول العامة (خصوصًا `/auth/*`).
- تدوير refresh tokens.
- فحص المدخلات (Zod) على كل الطلبات.
- مبدأ الحد الأدنى للصلاحيات في مصادقة الخدمات الخارجية (HF، Storage، FCM).

---

## 14. النسخ الاحتياطي والاستعادة (Backups & Recovery)

- نسخ احتياطي آلي لقاعدة البيانات (Atlas Backup) + نسخ دورية دوريّة.
- نسخ مستقل لمصادر التخزين (PDF/الصور).
- **اختبار استعادة** موثّق ومنفّذ قبل الإنتاج.
- RPO ≤ 24h، RTO ≤ 4h.
- دليل تشغيل (Runbook) للأعطال الشائعة: انقطاع DB، انقطاع Redis، نفاد حصة FCM.

---

## 15. قائمة جاهزية الإنتاج (Production Readiness Checklist)

- [ ] كل الإعدادات الخاصة بالبيئة خارجية.
- [ ] HTTPS enforced (backend + frontend).
- [ ] Rate limiting مُفعّل على النقاط العامة.
- [ ] تدوير refresh token مُنفّذ.
- [ ] كل فهارس MongoDB مُنشأة.
- [ ] نسخ احتياطي آلي مُتحقّق + استعادة مُختبرة.
- [ ] المراقبة والتنبيهات فعّالة.
- [ ] الأسرار مُدوّرة.
- [ ] اختبار تحميل للحمل المتوقع.
- [ ] Runbook للأعطال الشائعة جاهز.

---

## 16. قواعد PR الخاصة بالبنية التحتية

- تغييرات البنية (منافذ، خدمات، متغيّرات، شبكات) يجب أن تكون صغيرة ومستقلة.
- كل تغيير يوثّق: ما الذي يتغيّر، الأثر على local/staging/production، وخطة التراجع.
- تغييرات البنية تتطلب مراجعة، وأي لمس للأسرار أو النشر يتطلب مراجعة أمنية.
- لا تغيير بنيوي يكسر سير عمل المطوّر المحلي دون إشعار وتحديث README.

---

> هذه الوثيقة جزء من حكامة «رغد» التقنية، وتُبقى متزامنة مع `architecture.md` و`master-plan.md`.
