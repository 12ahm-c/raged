import { startServer } from './app';

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});