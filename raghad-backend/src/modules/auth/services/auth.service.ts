import crypto from 'crypto';
import { AppError } from '../../../middlewares/error.middleware';
import { generateAccessToken, generateRefreshToken, TokenPayload, verifyRefreshToken } from '../../../utils/jwt.util';
import { User, IUser } from '../models/User';
import type { RegisterInput } from '../dtos/auth.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface UserDTO {
  _id: string;
  name: string;
  email: string;
  role: string;
  timezone: string;
  settings: {
    theme: 'light' | 'dark';
    language: string;
    notificationsEnabled: boolean;
    reminderLeadMinutes: number;
  };
  createdAt: string;
  lastActiveAt: string;
}

function toUserDTO(user: IUser): UserDTO {
  return {
    _id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    timezone: user.timezone,
    settings: user.settings,
    createdAt: user.createdAt.toISOString(),
    lastActiveAt: user.lastActiveAt.toISOString(),
  };
}

function calculateExpiry(expiresIn: string): Date {
  const now = new Date();
  const match = expiresIn.match(/^(\d+)([mhd])$/);
  if (!match) return new Date(now.getTime() + 15 * 60 * 1000);

  const value = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 'm') return new Date(now.getTime() + value * 60 * 1000);
  if (unit === 'h') return new Date(now.getTime() + value * 60 * 60 * 1000);
  return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
}

function buildTokens(user: IUser, refreshJti: string): AuthTokens {
  const payload: Omit<TokenPayload, 'type'> = {
    userId: user._id.toString(),
    email: user.email,
    jti: refreshJti,
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    accessTokenExpiresAt: calculateExpiry('15m').toISOString(),
    refreshTokenExpiresAt: calculateExpiry('7d').toISOString(),
  };
}

export async function login(email: string, password: string): Promise<{ user: UserDTO; tokens: AuthTokens }> {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new AppError('AUTH_REQUIRED', 401, 'Invalid email or password');
  }

  const isValid = await user.comparePassword(password);
  if (!isValid) {
    throw new AppError('AUTH_REQUIRED', 401, 'Invalid email or password');
  }

  const refreshJti = crypto.randomUUID();
  const tokens = buildTokens(user, refreshJti);

  user.lastActiveAt = new Date();
  user.refreshTokens.push({
    jti: refreshJti,
    expiresAt: new Date(tokens.refreshTokenExpiresAt),
    createdAt: new Date(),
  });
  await user.save();

  return { user: toUserDTO(user), tokens };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}

export async function register(
  input: RegisterInput
): Promise<{ user: UserDTO; tokens: AuthTokens }> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  const existing = await User.findOne({ email }).select('_id');
  if (existing) {
    throw new AppError('DUPLICATE', 409, 'البريد الإلكتروني مسجّل بالفعل');
  }

  let user: IUser;
  try {
    user = await User.create({
      name,
      email,
      passwordHash: input.password,
      role: 'owner',
      lastActiveAt: new Date(),
    });
  } catch (error) {
    // سباق على فهرس email الفريد (11000) — يتحول إلى استجابة DUPLICATE متسقة.
    if (isDuplicateKeyError(error)) {
      throw new AppError('DUPLICATE', 409, 'البريد الإلكتروني مسجّل بالفعل');
    }
    throw error;
  }

  const refreshJti = crypto.randomUUID();
  const tokens = buildTokens(user, refreshJti);

  user.refreshTokens.push({
    jti: refreshJti,
    expiresAt: new Date(tokens.refreshTokenExpiresAt),
    createdAt: new Date(),
  });
  user.lastActiveAt = new Date();
  await user.save();

  return { user: toUserDTO(user), tokens };
}

export async function refresh(refreshToken: string): Promise<{ user: UserDTO; tokens: AuthTokens }> {
  let payload: TokenPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('TOKEN_INVALID', 401, 'Invalid refresh token');
  }

  if (payload.type !== 'refresh' || !payload.jti) {
    throw new AppError('TOKEN_INVALID', 401, 'Invalid refresh token');
  }

  const user = await User.findById(payload.userId);
  if (!user) {
    throw new AppError('TOKEN_INVALID', 401, 'User not found');
  }

  const storedToken = user.refreshTokens.find((token) => token.jti === payload.jti);
  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
    throw new AppError('TOKEN_INVALID', 401, 'Refresh token is no longer active');
  }

  storedToken.revokedAt = new Date();
  const refreshJti = crypto.randomUUID();
  const tokens = buildTokens(user, refreshJti);

  user.refreshTokens.push({
    jti: refreshJti,
    expiresAt: new Date(tokens.refreshTokenExpiresAt),
    createdAt: new Date(),
  });
  user.lastActiveAt = new Date();
  await user.save();

  return { user: toUserDTO(user), tokens };
}

export async function logout(userId: string, refreshToken?: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  const now = new Date();
  if (refreshToken) {
    const payload = verifyRefreshToken(refreshToken);
    user.refreshTokens.forEach((token) => {
      if (token.jti === payload.jti && !token.revokedAt) {
        token.revokedAt = now;
      }
    });
  } else {
    user.refreshTokens.forEach((token) => {
      if (!token.revokedAt) token.revokedAt = now;
    });
  }

  user.lastActiveAt = now;
  await user.save();
}

export async function getMe(userId: string): Promise<UserDTO> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('NOT_FOUND', 404, 'User not found');
  }
  return toUserDTO(user);
}

export async function updateProfile(
  userId: string,
  data: { name?: string; password?: string; timezone?: string }
): Promise<UserDTO> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new AppError('NOT_FOUND', 404, 'User not found');
  }

  if (data.name) user.name = data.name;
  if (data.timezone) user.timezone = data.timezone;
  if (data.password) {
    user.passwordHash = data.password;
    const now = new Date();
    user.refreshTokens.forEach((token) => {
      if (!token.revokedAt) token.revokedAt = now;
    });
  }

  await user.save();
  return toUserDTO(user);
}

export async function updateSettings(
  userId: string,
  settings: Partial<UserDTO['settings']>
): Promise<UserDTO['settings']> {
  const $set = Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [`settings.${key}`, value])
  );

  const user = await User.findByIdAndUpdate(userId, { $set }, { new: true, runValidators: true });
  if (!user) {
    throw new AppError('NOT_FOUND', 404, 'User not found');
  }
  return user.settings;
}

export async function getSettings(userId: string): Promise<UserDTO['settings']> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('NOT_FOUND', 404, 'User not found');
  }
  return user.settings;
}
