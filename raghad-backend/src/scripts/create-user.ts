import crypto from 'crypto';
import { z } from 'zod';
import { connectDB, disconnectDB } from '../utils/db';
import { User } from '../modules/auth/models/User';

const inputSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  name: z.string().trim().min(2).max(100),
});

function parseArgs(args: string[]): { email: string; name: string } {
  const values = new Map<string, string>();
  let generatePassword = false;

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--generate-password') {
      if (generatePassword) {
        throw new Error('Duplicate argument: --generate-password');
      }
      generatePassword = true;
      continue;
    }

    const value = args[index + 1];
    if (!['--email', '--name'].includes(flag) || !value || value.startsWith('--')) {
      throw new Error(
        'Usage: npm run user:create -- --email <email> --name <name> --generate-password'
      );
    }
    if (values.has(flag)) {
      throw new Error(`Duplicate argument: ${flag}`);
    }
    values.set(flag, value);
    index += 1;
  }

  if (!generatePassword) {
    throw new Error('Use --generate-password to create a secure one-time password.');
  }

  return inputSchema.parse({
    email: values.get('--email'),
    name: values.get('--name'),
  });
}

async function main(): Promise<void> {
  const { email, name } = parseArgs(process.argv.slice(2));
  const password = crypto.randomBytes(32).toString('base64url');

  await connectDB();
  try {
    const existing = await User.exists({ email });
    if (existing) {
      throw new Error(`An account already exists for ${email}. No changes were made.`);
    }

    await User.create({
      name,
      email,
      passwordHash: password,
      role: 'owner',
    });

    console.log(`Account created successfully for ${email}.`);
    console.log(`One-time password (save it now): ${password}`);
  } finally {
    await disconnectDB();
  }
}

main().catch((error: unknown) => {
  console.error('[Create user] Failed:', error);
  process.exitCode = 1;
});
