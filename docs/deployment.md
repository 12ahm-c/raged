# النشر على Vercel وRender

المشروع مستودع أحادي يحتوي تطبيق Expo في `raghad-app` وخادم Express في `raghad-backend`. أنشئ خدمتين منفصلتين من المستودع نفسه، واضبط **Root Directory** لكل خدمة كما هو موضح أدناه.

## 1. نشر الخادم على Render

أنشئ خدمة **Web Service** من مستودع GitHub بهذه الإعدادات:

- **Root Directory:** `raghad-backend`
- **Runtime:** Node
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm start`
- **Health Check Path:** `/health`

أضف متغيرات البيئة التالية من لوحة Render:

| المتغير | القيمة |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | رابط اتصال MongoDB Atlas |
| `JWT_SECRET` | سر عشوائي لا يقل عن 32 حرفًا |
| `JWT_REFRESH_SECRET` | سر عشوائي مختلف لا يقل عن 32 حرفًا |
| `FRONTEND_URL` | أصل موقع Vercel، مثل `https://your-app.vercel.app`، دون مسار أو `/` في النهاية |

ولّد السرّين محليًا، مثلًا عبر `openssl rand -base64 48`، وأدخل الناتج في Render فقط. لا تضع الأسرار في ملفات المشروع أو GitHub. يوفّر Render متغير `PORT` تلقائيًا؛ لا حاجة لضبطه يدويًا.

بعد النشر، تحقق من أن `https://<اسم-خدمة-render>.onrender.com/health` يعيد استجابة ناجحة. تأكد أيضًا من السماح باتصالات خدمة Render إلى قاعدة بيانات Atlas من إعدادات **Network Access**.

متغيرات التكاملات مثل `HF_API_KEY` و`FIREBASE_SERVICE_ACCOUNT_JSON` و`STORAGE_PUBLIC_BASE_URL` و`MAPS_API_KEY` و`REDIS_URL` و`VAPID_PUBLIC_KEY` و`VAPID_PRIVATE_KEY` اختيارية، وتلزم فقط لتفعيل ميزاتها. لا تضفها إن لم تكن تستخدم تلك التكاملات.

## 2. نشر الواجهة على Vercel

أنشئ مشروع Vercel من المستودع نفسه:

- **Root Directory:** `raghad-app`
- **Framework Preset:** Expo
- **Install Command:** `npm ci`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

يُصدّر Expo التطبيق كصفحة SPA واحدة، ويحتوي `raghad-app/vercel.json` على إعدادات البناء وإعادة توجيه المسارات إلى التطبيق لدعم الروابط المباشرة. أضف متغير البيئة التالي إلى بيئة **Production** في Vercel:

| المتغير | القيمة |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://<اسم-خدمة-render>.onrender.com/v1` |

استبدل النطاق بعنوان خدمة Render الفعلي، مع `/v1` في النهاية. أعد النشر بعد إضافة المتغير أو تغييره، لأن Expo يضمّنه أثناء بناء الواجهة.

## 3. اربط العنوانين وتحقق

يجب أن تكون قيمة `FRONTEND_URL` في Render مطابقة تمامًا لأصل موقع Vercel، بما في ذلك `https://` ودون مسار. إذا غيّرت نطاق Vercel، حدّث `FRONTEND_URL` في Render وأعد تشغيل الخدمة.

بعد نشر الخدمتين:

1. افتح `/health` على خدمة Render وتأكد من نجاحها.
2. افتح موقع Vercel، وسجّل الدخول وتحقق من أن طلبات API لا تفشل بسبب CORS أو الاتصال.
3. إذا كان المشروع متصلًا بقاعدة MongoDB Atlas، تحقق من إعدادات الوصول الشبكي وبيانات الاتصال عند فشل بدء الخادم.

يتحقق الخادم في بيئة الإنتاج من وجود إعدادات MongoDB وJWT وواجهة HTTPS، ويرفض الأسرار الافتراضية أو القصيرة عند بدء التشغيل.
