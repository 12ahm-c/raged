import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { z } from 'zod';
import { api } from '../../api/client';
import { LoadingState, palette, ScreenState } from '../../components/ui/States';
import { useAuthStore } from '../../stores/authStore';
import { getApiErrorMessage, getApiFieldErrors } from '../../utils/apiError';

const profileSchema = z.object({
  name: z.string().trim().min(1, 'أدخل الاسم'),
  timezone: z.string().trim().min(1, 'أدخل المنطقة الزمنية'),
  password: z.union([
    z.literal(''),
    z.string().min(8, 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل'),
  ]),
});

export function ProfileScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const [name, setName] = useState(user?.name ?? '');
  const [timezone, setTimezone] = useState(user?.timezone ?? 'Africa/Nouakchott');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState('');

  async function save() {
    setError('');
    setSuccess('');
    setFieldErrors({});

    const parsed = profileSchema.safeParse({ name, timezone, password });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    const input: { name?: string; timezone?: string; password?: string } = {};
    if (parsed.data.name !== user?.name) input.name = parsed.data.name;
    if (parsed.data.timezone !== user?.timezone) input.timezone = parsed.data.timezone;
    if (parsed.data.password) input.password = parsed.data.password;

    if (Object.keys(input).length === 0) {
      setSuccess('لا توجد تغييرات لحفظها.');
      return;
    }

    setBusy(true);
    try {
      const updatedUser = await api.updateProfile(input);
      updateUser(updatedUser);
      setPassword('');
      setSuccess(
        input.password
          ? 'تم تحديث الملف الشخصي بنجاح. يلزم تسجيل الدخول مجدداً عند انتهاء الجلسة.'
          : 'تم تحديث الملف الشخصي بنجاح.'
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setFieldErrors(getApiFieldErrors(requestError));
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return <LoadingState label="جارٍ تحميل الملف الشخصي..." />;
  }

  const initials = (user.name || user.email || 'U')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        {navigation.canGoBack() ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-forward" size={20} color={palette.text} />
          </Pressable>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}

        <View style={styles.headerTitles}>
          <Text style={styles.headerTitle}>الملف الشخصي</Text>
          <Text style={styles.headerSubtitle}>بيانات الحساب وتسجيل الدخول</Text>
        </View>

        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <LinearGradient
          colors={['#2563EB', '#1D4ED8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.heroName}>{user.name || 'مستخدم رغد'}</Text>
          <Text style={styles.heroEmail}>{user.email}</Text>

          <View style={styles.heroBadgesRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="time-outline" size={13} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>{user.timezone}</Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: 'rgba(255, 255, 255, 0.25)' }]}>
              <Ionicons name="shield-checkmark-outline" size={13} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>حساب موثق</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Alerts */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={18} color="#10B981" />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        {/* Form Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="create-outline" size={18} color={palette.primary} />
            </View>
            <View style={styles.cardHeaderTexts}>
              <Text style={styles.cardTitle}>تعديل البيانات الشخصية</Text>
              <Text style={styles.cardSubtitle}>تحديث الاسم والمنطقة وكلمة المرور</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Name Field */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>الاسم الكامل</Text>
            <View style={[styles.inputBox, fieldErrors.name && styles.inputBoxError]}>
              <Ionicons name="person-outline" size={18} color={palette.muted} />
              <TextInput
                accessibilityLabel="الاسم"
                value={name}
                onChangeText={setName}
                style={styles.textInput}
                placeholder="أدخل اسمك"
                placeholderTextColor={palette.muted}
              />
            </View>
            {fieldErrors.name ? (
              <Text style={styles.fieldErrorText}>{fieldErrors.name}</Text>
            ) : null}
          </View>

          {/* Timezone Field */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>المنطقة الزمنية</Text>
            <View style={[styles.inputBox, fieldErrors.timezone && styles.inputBoxError]}>
              <Ionicons name="globe-outline" size={18} color={palette.muted} />
              <TextInput
                accessibilityLabel="المنطقة الزمنية"
                value={timezone}
                onChangeText={setTimezone}
                style={styles.textInput}
                placeholder="مثال: Africa/Nouakchott أو Asia/Riyadh"
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
              />
            </View>
            {fieldErrors.timezone ? (
              <Text style={styles.fieldErrorText}>{fieldErrors.timezone}</Text>
            ) : (
              <Text style={styles.helperText}>تُستخدم لتحديد مواعيد العادات والمهام اليومية بدقة</Text>
            )}
          </View>

          {/* Password Field */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>كلمة مرور جديدة (اختياري)</Text>
            <View style={[styles.inputBox, fieldErrors.password && styles.inputBoxError]}>
              <Ionicons name="lock-closed-outline" size={18} color={palette.muted} />
              <TextInput
                accessibilityLabel="كلمة مرور جديدة"
                autoComplete="new-password"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                style={styles.textInput}
                placeholder="اتركها فارغة إن لم ترغب في التغيير"
                placeholderTextColor={palette.muted}
                textContentType="newPassword"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={palette.muted}
                />
              </Pressable>
            </View>
            {fieldErrors.password ? (
              <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text>
            ) : null}
          </View>

          {/* Submit Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="حفظ التغييرات"
            onPress={save}
            disabled={busy}
            style={[styles.saveBtn, busy && styles.saveBtnDisabled]}
          >
            <Ionicons name="save-outline" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>
              {busy ? 'جارٍ حفظ التغييرات...' : 'حفظ التعديلات'}
            </Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnPlaceholder: {
    width: 36,
    height: 36,
  },
  headerTitles: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    writingDirection: 'rtl',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    writingDirection: 'rtl',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: palette.primary,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 4,
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.primary,
  },
  heroName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  heroEmail: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginBottom: 14,
  },
  heroBadgesRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  heroBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EBF0F7',
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderTexts: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  fieldBlock: {
    marginBottom: 16,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inputBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  inputBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  helperText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  fieldErrorText: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  saveBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.primary,
    borderRadius: 16,
    height: 48,
    marginTop: 10,
    shadowColor: palette.primary,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    padding: 12,
    borderRadius: 14,
  },
  errorText: {
    flex: 1,
    color: '#EF4444',
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  successBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    padding: 12,
    borderRadius: 14,
  },
  successText: {
    flex: 1,
    color: '#059669',
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
