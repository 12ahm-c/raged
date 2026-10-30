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
  AuthLink,
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

const loginSchema = z.object({
  email: z.email('أدخل بريدًا إلكترونيًا صحيحًا'),
  password: z.string().min(8, 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل'),
});

/**
 * شاشة تسجيل الدخول (الصورة الثالثة):
 * شعار متوسط + "مرحبًا بعودتك" + حقلان (إيميل بأيقونة mail يمين،
 * كلمة مرور بقفل يمين وعين يسار) + "نسيت كلمة المرور؟" +
 * زر "تسجيل الدخول" + سطر "ليس لديك حساب؟ إنشاء حساب".
 */
export function LoginScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function goBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Splash');
    }
  }

  async function submit() {
    setError('');
    setFieldErrors({});
    const parsed = loginSchema.safeParse({ email: email.trim(), password });
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
      await login(parsed.data.email, parsed.data.password);
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
            <AuthLogo width={116} />
            <Wordmark size={36} />
          </View>

          <Text style={s.title}>مرحبًا بعودتك</Text>
          <Text style={s.subtitle}>واصل بناء يوم يشبه أهدافك</Text>

          <View style={s.form}>
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
              autoComplete="current-password"
              secureTextEntry={!revealPassword}
              textContentType="password"
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

            <View style={s.forgotRow}>
              <AuthLink label="نسيت كلمة المرور؟" onPress={() => {}} />
            </View>

            {error ? (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            ) : null}

            <View style={s.submit}>
              <AuthPrimaryButton
                label={busy ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
                onPress={submit}
                disabled={busy}
              />
              {busy ? (
                <ActivityIndicator
                  color={authColors.link}
                  style={s.busy}
                  accessibilityLabel="جارٍ التحقق من بيانات الدخول"
                />
              ) : null}
            </View>
          </View>

          <Pressable
            accessibilityRole="link"
            onPress={() => navigation.navigate('Register')}
            style={s.footer}
            hitSlop={8}
          >
            <Text style={s.footerText}>
              ليس لديك حساب؟ <Text style={s.footerLink}>إنشاء حساب</Text>
            </Text>
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
    marginTop: 8,
  },
  title: {
    marginTop: 26,
    fontSize: 34,
    fontWeight: '800',
    color: authColors.navy,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 17,
    color: authColors.body,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: 14,
  },
  form: {
    gap: 16,
  },
  forgotRow: {
    alignItems: 'flex-start',
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
  leadingIcon: {
    marginRight: 12,
    padding: 2,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 6,
  },
  footerText: {
    fontSize: 16,
    color: authColors.body,
    writingDirection: 'rtl',
  },
  footerLink: {
    fontSize: 16,
    fontWeight: '800',
    color: authColors.link,
  },
});
