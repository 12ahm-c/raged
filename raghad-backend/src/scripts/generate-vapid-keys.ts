import webpush from 'web-push';

/**
 * توليد مفاتيح VAPID للإشعارات (Web Push):
 *   npm run vapid:keys
 * ثم ضَع الناتج في ملف .env (أو متغيرات البيئة على الاستضافة):
 *   VAPID_PUBLIC_KEY=...
 *   VAPID_PRIVATE_KEY=...
 *   VAPID_SUBJECT=mailto:you@example.com
 */
const keys = webpush.generateVAPIDKeys();

console.log('أضف هذا إلى ملف .env (raghad-backend):\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:admin@example.com');
