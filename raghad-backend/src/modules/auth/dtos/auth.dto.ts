import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('بريد إلكتروني غير صالح'),
    password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(100, 'الاسم طويل جدًا'),
    email: z.string().email('بريد إلكتروني غير صالح'),
    password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token مطلوب'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل').max(100).optional(),
    password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل').optional(),
    timezone: z.string().optional(),
  }),
});

export const updateSettingsSchema = z.object({
  body: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    language: z.string().optional(),
    notificationsEnabled: z.boolean().optional(),
    reminderLeadMinutes: z.number().int().min(0).max(60).optional(),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type RefreshInput = z.infer<typeof refreshSchema>['body'];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>['body'];