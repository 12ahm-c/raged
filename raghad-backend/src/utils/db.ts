import mongoose from 'mongoose';
import { config } from '../config';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(config.mongodbUri, {
      dbName: 'raghad',
      maxPoolSize: 10,
    });
    console.log('[DB] Connected to MongoDB Atlas');
  } catch (err) {
    console.error('[DB] Connection error:', err);
    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  console.log('[DB] Disconnected from MongoDB');
}