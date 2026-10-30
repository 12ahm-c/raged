import type { ComponentProps, ReactNode } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

type FeatherName = ComponentProps<typeof Feather>['name'];

/** ألوان هوية شاشات البداية (مطابقة لتصميم mockups). */
export const authColors = {
  bg: '#F5F8FE',
  blobBlue: '#E6F0FE',
  blobLavender: '#EFEDFB',
  primaryTop: '#5A96F8',
  primaryBottom: '#3E82F5',
  navy: '#152A54',
  body: '#5F718C',
  placeholder: '#94A3B8',
  border: '#E3E9F4',
  fieldBg: '#FFFFFF',
  link: '#2F6BF0',
  danger: '#D64545',
  icon: '#98A6BD',
};

/** خلفية الشاشات: تدرّج فاتح + دوائر زخرفية (أزرق أعلى اليسار، لافندر أسفل اليمين). */
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <View style={s.root}>
      <View style={[s.blob, s.blobBlueTop]} />
      <View style={[s.blob, s.blobWhiteTop]} />
      <View style={[s.blob, s.blobLavenderBottom]} />
      <SafeAreaView style={s.safe}>{children}</SafeAreaView>
    </View>
  );
}

/** صورة الشعار الشفافة بحجم ثابت. */
export function AuthLogo({ width }: { width: number }) {
  return (
    <Image
      source={require('../../../assets/logo.png')}
      style={{ width, height: width * 1.28 }}
      resizeMode="contain"
      accessibilityLabel="شعار رغد"
    />
  );
}

/** كلمة raged بصريًا كما في التصميم. */
export function Wordmark({ size }: { size: number }) {
  return <Text style={[s.wordmark, { fontSize: size }]}>raged</Text>;
}

/** زر رجوع دائري أعلى يمين الشاشة (حسب التصميم). */
export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="رجوع"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [s.backBtn, pressed && s.backBtnPressed]}
    >
      <Feather name="chevron-left" size={24} color={authColors.navy} />
    </Pressable>
  );
}

/** حقل إدخال بإطار فاتح وأيقونة داخلية + رسالة خطأ اختيارية. */
export function AuthTextField({
  icon,
  onIconPress,
  leading,
  error,
  ...inputProps
}: {
  icon: FeatherName;
  onIconPress?: () => void;
  leading?: ReactNode;
  error?: string;
} & TextInputProps) {
  const iconNode = (
    <View style={s.inputIcon}>
      <Feather name={icon} size={20} color={authColors.icon} />
    </View>
  );
  return (
    <View style={s.field}>
      <View style={s.inputBox}>
        {leading}
        <TextInput
          placeholderTextColor={authColors.placeholder}
          style={s.input}
          {...inputProps}
        />
        {onIconPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إظهار أو إخفاء كلمة المرور"
            onPress={onIconPress}
            hitSlop={8}
          >
            {iconNode}
          </Pressable>
        ) : (
          iconNode
        )}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** زر أساسي بتدرّج أزرق — مع خيار سهم يسار كما في شاشة البداية. */
export function AuthPrimaryButton({
  label,
  onPress,
  disabled = false,
  chevron = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  chevron?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [pressed && !disabled && s.btnPressed, disabled && s.btnDisabled]}
    >
      <LinearGradient
        colors={[authColors.primaryTop, authColors.primaryBottom]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={s.btn}
      >
        {chevron ? (
          <View style={s.btnRow}>
            <Feather name="chevron-left" size={22} color="#FFFFFF" />
            <Text style={s.btnText}>{label}</Text>
          </View>
        ) : (
          <Text style={s.btnText}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

/** زر ثانوي: أبيض بإطار، سطران (سطر رمادي علوي + سطر أزرق أسفله). */
export function AuthOutlineButton({
  caption,
  label,
  onPress,
}: {
  caption: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${caption} ${label}`}
      onPress={onPress}
      style={({ pressed }) => [s.outlineBtn, pressed && s.outlineBtnPressed]}
    >
      <Text style={s.outlineCaption}>{caption}</Text>
      <Text style={s.outlineLabel}>{label}</Text>
    </Pressable>
  );
}

/** نص رابط أزرق (مثل نسيت كلمة المرور؟). */
export function AuthLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <Text style={s.link}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: authColors.bg,
    overflow: 'hidden',
  },
  safe: {
    flex: 1,
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  blobBlueTop: {
    width: 420,
    height: 420,
    top: -170,
    left: -150,
    backgroundColor: authColors.blobBlue,
  },
  blobWhiteTop: {
    width: 260,
    height: 260,
    top: -110,
    left: -70,
    backgroundColor: '#FFFFFF',
    opacity: 0.7,
  },
  blobLavenderBottom: {
    width: 460,
    height: 460,
    bottom: -190,
    right: -160,
    backgroundColor: authColors.blobLavender,
  },
  wordmark: {
    color: authColors.navy,
    fontWeight: '800',
    letterSpacing: -1.5,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDF1F8',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  backBtnPressed: {
    opacity: 0.7,
  },
  field: {
    gap: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: authColors.fieldBg,
    paddingHorizontal: 18,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: authColors.navy,
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingVertical: 0,
  },
  inputIcon: {
    width: 26,
    alignItems: 'center',
    marginLeft: 12,
  },
  error: {
    color: authColors.danger,
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  btn: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  btnPressed: {
    opacity: 0.85,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  outlineBtn: {
    minHeight: 70,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: authColors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
    gap: 2,
  },
  outlineBtnPressed: {
    opacity: 0.8,
  },
  outlineCaption: {
    fontSize: 14,
    color: authColors.body,
    writingDirection: 'rtl',
  },
  outlineLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: authColors.link,
    writingDirection: 'rtl',
  },
  link: {
    color: authColors.link,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
