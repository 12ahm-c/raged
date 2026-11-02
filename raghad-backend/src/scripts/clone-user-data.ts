import crypto from 'crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from '../modules/auth/models/User';
import { connectDB, disconnectDB } from '../utils/db';

const inputSchema = z.object({
  sourceEmail: z.string().trim().email().transform((value) => value.toLowerCase()),
  targetEmail: z.string().trim().email().transform((value) => value.toLowerCase()),
  targetName: z.string().trim().min(2).max(100),
});

function parseArgs(args: string[]): z.infer<typeof inputSchema> {
  const values = new Map<string, string>();

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!['--source-email', '--target-email', '--target-name'].includes(flag) || !value) {
      throw new Error(
        'Usage: npm run user:clone -- --source-email <email> --target-email <email> --target-name <name>'
      );
    }
    if (values.has(flag)) {
      throw new Error(`Duplicate argument: ${flag}`);
    }
    values.set(flag, value);
  }

  const input = inputSchema.parse({
    sourceEmail: values.get('--source-email'),
    targetEmail: values.get('--target-email'),
    targetName: values.get('--target-name'),
  });
  if (input.sourceEmail === input.targetEmail) {
    throw new Error('Source and target emails must be different.');
  }
  return input;
}

function cloneValue(
  value: unknown,
  idMap: Map<string, mongoose.Types.ObjectId>
): unknown {
  if (value instanceof mongoose.Types.ObjectId) {
    return idMap.get(value.toHexString()) ?? value;
  }
  if (value instanceof Date) {
    return new Date(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item, idMap));
  }
  if (value && typeof value === 'object') {
    if ('_bsontype' in value) {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item, idMap)])
    );
  }
  return value;
}

async function main(): Promise<void> {
  const { sourceEmail, targetEmail, targetName } = parseArgs(process.argv.slice(2));
  const targetPassword = crypto.randomBytes(32).toString('base64url');

  await connectDB();
  const session = await mongoose.startSession();
  let copiedCounts: Record<string, number> = {};

  try {
    await session.withTransaction(async () => {
      const source = await User.findOne({ email: sourceEmail }).session(session);
      if (!source) {
        throw new Error(`Source account not found: ${sourceEmail}`);
      }

      const existingTarget = await User.exists({ email: targetEmail }).session(session);
      if (existingTarget) {
        throw new Error(`Target account already exists: ${targetEmail}. No changes were made.`);
      }

      const target = await User.create(
        [
          {
            name: targetName,
            email: targetEmail,
            passwordHash: targetPassword,
            role: source.role,
            timezone: source.timezone,
            settings: source.settings,
          },
        ],
        { session }
      ).then(([created]) => created);

      const database = mongoose.connection.db;
      if (!database) {
        throw new Error('MongoDB connection is not available.');
      }

      const collections = await database.listCollections().toArray();
      const sourceDocuments: Array<{
        collectionName: string;
        documents: Record<string, unknown>[];
      }> = [];
      const idMap = new Map<string, mongoose.Types.ObjectId>();
      idMap.set(source._id.toString(), target._id);

      for (const { name } of collections) {
        const collection = database.collection(name);
        const documents = await collection
          .find({ userId: source._id }, { session })
          .toArray();
        if (documents.length === 0) {
          continue;
        }

        sourceDocuments.push({ collectionName: name, documents });
        for (const document of documents) {
          idMap.set(String(document._id), new mongoose.Types.ObjectId());
        }
      }

      for (const { collectionName, documents } of sourceDocuments) {
        const copies = documents.map((document) => {
          const clone = cloneValue(document, idMap) as Record<string, unknown>;
          clone._id = idMap.get(String(document._id));
          clone.userId = target._id;
          return clone;
        });

        await database.collection(collectionName).insertMany(copies, {
          ordered: true,
          session,
        });

        const targetCount = await database
          .collection(collectionName)
          .countDocuments({ userId: target._id }, { session });
        if (targetCount !== copies.length) {
          throw new Error(`Verification failed while copying ${collectionName}.`);
        }
        copiedCounts[collectionName] = copies.length;
      }
    });

    console.log(`Created ${targetEmail} and copied the source account's app data.`);
    console.log(`Records copied: ${JSON.stringify(copiedCounts)}`);
    console.log(`One-time password (save it now): ${targetPassword}`);
  } finally {
    await session.endSession();
    await disconnectDB();
  }
}

main().catch((error: unknown) => {
  console.error('[Clone user data] Failed:', error);
  process.exitCode = 1;
});
