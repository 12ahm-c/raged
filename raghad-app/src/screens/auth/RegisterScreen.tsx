import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { z } from 'zod';
import {
  AuthLogo,
  AuthPrimaryButton,
  AuthScreen,
  AuthTextField,
  BackButton,
  Wordmark,
  authColors,
} from '../../components/auth/AuthKit';
import { useAuthStore } from '../../stores/authStore';
import { getApiErrorMessage, getApiFieldErrors } from '../../utils/apiError';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'أدخل اسمًا من حرفين على الأقل'),
  email: z.email('أدخل بريدًا إلكترونيًا صحيحًا'),
  password: z.string().min(8, 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل'),
  terms: z
    .boolean()
    .refine((value) => value, 'يجب الموافقة على شروط الاستخدام وسياسة الخصوصية'),
});

/**
 * شاشة إنشاء الحساب (الصورة الثانية):
 * زر رجوع + شعار أصغر + "أنشئ حسابك" + 3 حقول (اسم/إيميل/كلمة مرور) +
 * مربع الموافقة على الشروط + زر "إنشاء حساب" + فوتر بخطين جانبيين.
 */
export function RegisterScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const register = useAuthStore((state) => state.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function goBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Login');
    }
  }

  async function submit() {
    setError('');
    setFieldErrors({});
    const parsed = registerSchema.safeParse({
      name: name.trim(),
      email: email.trim(),
      password,
      terms: agreed,
    });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setBusy(true);
    try {
      await register({
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
      });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setFieldErrors(getApiFieldErrors(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScreen>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BackButton onPress={goBack} />

          <View style={s.brand}>
            <AuthLogo width={92} />
            <Wordmark size={28} />
          </View>

          <Text style={s.title}>أنشئ حسابك</Text>
          <Text style={s.subtitle}>خطوة أولى نحو عادات تدوم</Text>

          <View style={s.form}>
            <AuthTextField
              icon="user"
              placeholder="الاسم الكامل"
              accessibilityLabel="الاسم الكامل"
              autoComplete="name"
              textContentType="name"
              value={name}
              onChangeText={setName}
              onSubmitEditing={submit}
              returnKeyType="next"
              error={fieldErrors.name}
            />

            <AuthTextField
              icon="mail"
              placeholder="البريد الإلكتروني"
              accessibilityLabel="البريد الإلكتروني"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={submit}
              returnKeyType="next"
              error={fieldErrors.email}
            />

            <AuthTextField
              icon="lock"
              placeholder="كلمة المرور"
              accessibilityLabel="كلمة المرور"
              autoComplete="new-password"
              secureTextEntry={!revealPassword}
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              returnKeyType="done"
              error={fieldErrors.password}
              leading={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    revealPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'
                  }
                  onPress={() => setRevealPassword((v) => !v)}
                  hitSlop={8}
                  style={s.leadingIcon}
                >
                  <Feather
                    name={revealPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={authColors.icon}
                  />
                </Pressable>
              }
            />

            <View style={s.termsBlock}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                accessibilityLabel="أوافق على شروط الاستخدام وسياسة الخصوصية"
                onPress={() => setAgreed((v) => !v)}
                hitSlop={8}
                style={s.termsRow}
              >
                <View style={[s.checkbox, agreed && s.checkboxChecked]}>
                  {agreed ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                </View>
                <Text style={s.termsText}>
                  أوافق على <Text style={s.termsLink}>شروط الاستخدام</Text> و
                  <Text style={s.termsLink}> سياسة الخصوصية</Text>
                </Text>
              </Pressable>
              {fieldErrors.terms ? (
                <Text accessibilityRole="alert" style={s.error}>
                  {fieldErrors.terms}
                </Text>
              ) : null}
            </View>

            {error ? (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            ) : null}

            <View style={s.submit}>
              <AuthPrimaryButton
                label={busy ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب'}
                onPress={submit}
                disabled={busy}
              />
              {busy ? (
                <ActivityIndicator
                  color={authColors.link}
                  style={s.busy}
                  accessibilityLabel="جارٍ إنشاء الحساب"
                />
              ) : null}
            </View>
          </View>

          <Pressable
            accessibilityRole="link"
            onPress={() => navigation.navigate('Login')}
            style={s.footer}
            hitSlop={8}
          >
            <View style={s.footerLine} />
            <Text style={s.footerText}>
              لديك حساب بالفعل؟ <Text style={s.footerLink}>تسجيل الدخول</Text>
            </Text>
            <View style={s.footerLine} />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 44,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 4,
  },
  brand: {
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
  },
  title: {
    marginTop: 22,
    fontSize: 30,
    fontWeight: '800',
    color: authColors.navy,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: authColors.body,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: 14,
  },
  form: {
    gap: 16,
  },
  leadingIcon: {
    marginRight: 12,
    padding: 2,
  },
  termsBlock: {
    gap: 6,
    marginTop: 2,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: authColors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: authColors.link,
    borderColor: authColors.link,
  },
  termsText: {
    flex: 1,
    fontSize: 14.5,
    color: authColors.body,
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 22,
  },
  termsLink: {
    color: authColors.link,
    fontWeight: '700',
  },
  error: {
    color: authColors.danger,
    fontSize: 14,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  submit: {
    gap: 8,
    marginTop: 6,
  },
  busy: {
    alignSelf: 'center',
  },
  footer: {
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  footerLine: {
    flex: 1,
    height: 1,
    backgroundColor: authColors.border,
  },
  footerText: {
    fontSize: 15,
    color: authColors.body,
    writingDirection: 'rtl',
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '800',
    color: authColors.link,
  },
});
