import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUserSettings {
  theme: 'light' | 'dark';
  language: string;
  notificationsEnabled: boolean;
  reminderLeadMinutes: number;
}

export interface IUserRefreshToken {
  jti: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: 'owner';
  timezone: string;
  settings: IUserSettings;
  refreshTokens: IUserRefreshToken[];
  createdAt: Date;
  lastActiveAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const userSettingsSchema = new Schema<IUserSettings>({
  theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  language: { type: String, default: 'ar' },
  notificationsEnabled: { type: Boolean, default: true },
  reminderLeadMinutes: { type: Number, default: 5 },
}, { _id: false });

const refreshTokenSchema = new Schema<IUserRefreshToken>({
  jti: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const userSchema = new Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['owner'], default: 'owner' },
  timezone: { type: String, default: 'Africa/Nouakchott' },
  settings: { type: userSettingsSchema, default: () => ({}) },
  refreshTokens: { type: [refreshTokenSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
});

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ 'refreshTokens.jti': 1 });

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.pre('save', async function (next) {
  if (this.isModified('passwordHash')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
  next();
});

export const User = mongoose.model<IUser>('User', userSchema);
