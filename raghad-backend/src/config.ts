import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  mongodbUri: process.env.MONGODB_URI ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-in-production',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:8080',
  hfApiKey: process.env.HF_API_KEY ?? '',
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? '',
  storagePublicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL ?? '',
  mapsApiKey: process.env.MAPS_API_KEY ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  // Web Push (PWA): مفاتيح VAPID — تُولَّد عبر `npm run vapid:keys`
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? '',
  vapidSubject: process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com',
};
