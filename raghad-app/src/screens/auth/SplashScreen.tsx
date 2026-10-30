import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AuthLogo,
  AuthOutlineButton,
  AuthPrimaryButton,
  AuthScreen,
  Wordmark,
  authColors,
} from '../../components/auth/AuthKit';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/**
 * شاشة البداية (Splash / Welcome):
 * الشعار + raged + "خطوة صغيرة، أثر كبير" + زران في الأسفل.
 * "ابدأ رحلتك" يفتح إنشاء الحساب، و"لدي حساب بالفعل" يفتح تسجيل الدخول.
 */
export function SplashScreen({
  navigation,
  booting = false,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  booting?: boolean;
}) {
  return (
    <AuthScreen>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          <AuthLogo width={168} />
          <Wordmark size={48} />
          <Text style={s.title}>خطوة صغيرة، أثر كبير</Text>
          <Text style={s.subtitle}>ابدأ يومك بعادة تصنع الفرق</Text>
        </View>

        <View style={s.actions}>
          {booting ? (
            <View style={s.loading} accessibilityRole="progressbar">
              <ActivityIndicator color={authColors.link} />
              <Text style={s.loadingText}>جارٍ التحقق من الجلسة</Text>
            </View>
          ) : (
            <>
              <AuthPrimaryButton
                label="ابدأ رحلتك"
                chevron
                onPress={() => navigation.navigate('Register')}
              />
              <AuthOutlineButton
                caption="لدي حساب بالفعل"
                label="تسجيل الدخول"
                onPress={() => navigation.navigate('Login')}
              />
            </>
          )}
        </View>
      </ScrollView>
    </AuthScreen>
  );
}

const s = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 44,
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  title: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: '800',
    color: authColors.navy,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 17,
    color: authColors.body,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  actions: {
    gap: 14,
    paddingBottom: 8,
  },
  loading: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: authColors.body,
    fontSize: 15,
    writingDirection: 'rtl',
  },
});
