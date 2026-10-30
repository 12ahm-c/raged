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

if (config.nodeEnv === 'production') {
  const requiredProductionSettings = [
    ['MONGODB_URI', config.mongodbUri],
    ['JWT_SECRET', config.jwtSecret],
    ['JWT_REFRESH_SECRET', config.jwtRefreshSecret],
    ['FRONTEND_URL', config.frontendUrl],
  ] as const;

  const missingSettings = requiredProductionSettings
    .filter(([, value]) => !value || value.startsWith('dev-'))
    .map(([name]) => name);

  if (missingSettings.length > 0) {
    throw new Error(
      `Missing or unsafe production environment variables: ${missingSettings.join(', ')}`
    );
  }

  if (config.jwtSecret.length < 32 || config.jwtRefreshSecret.length < 32) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be at least 32 characters long');
  }

  if (config.jwtSecret === config.jwtRefreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different values');
  }

  let frontendUrl: URL;
  try {
    frontendUrl = new URL(config.frontendUrl);
  } catch {
    throw new Error('FRONTEND_URL must be a valid HTTPS origin');
  }

  if (frontendUrl.protocol !== 'https:' || frontendUrl.origin !== config.frontendUrl) {
    throw new Error('FRONTEND_URL must be an HTTPS origin without a path or trailing slash');
  }
}
