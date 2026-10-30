import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { IntegrationStatusDTO, UserSettingsDTO } from '../../types/dto';
import { api } from '../../api/client';
import { LoadingState, palette, ScreenState } from '../../components/ui/States';
import { useAuthStore } from '../../stores/authStore';
import { getApiErrorMessage } from '../../utils/apiError';
import { disablePushNotifications, enablePushNotifications } from '../../utils/push';

export function SettingsScreen() {
  const navigation = useNavigation();
  const logout = useAuthStore((state) => state.logout);
  const [settings, setSettings] = useState<UserSettingsDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reminderInput, setReminderInput] = useState('');
  const [integration, setIntegration] = useState<IntegrationStatusDTO | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getSettings()
      .then((loadedSettings) => {
        if (active) {
          setSettings(loadedSettings);
          setReminderInput(String(loadedSettings.reminderLeadMinutes));
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(getApiErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    api
      .getIntegrationStatus()
      .then((status) => {
        if (active) setIntegration(status);
      })
      .catch(() => {
        // تبقى البطاقة مخفية عند تعذر التحميل
      });

    return () => {
      active = false;
    };
  }, []);

  async function retryLoadSettings() {
    setLoading(true);
    setError('');
    try {
      const loadedSettings = await api.getSettings();
      setSettings(loadedSettings);
      setReminderInput(String(loadedSettings.reminderLeadMinutes));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function handleNotificationsToggle(enabled: boolean) {
    setSettings((current) => (current ? { ...current, notificationsEnabled: enabled } : current));
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      if (enabled) {
        const result = await enablePushNotifications();
        if (result.ok) {
          setSuccess('تم تفعيل الإشعارات على هذا الجهاز.');
        } else {
          setError(result.reason ?? 'تعذر تفعيل الإشعارات.');
          setSettings((current) => (current ? { ...current, notificationsEnabled: false } : current));
        }
      } else {
        await disablePushNotifications();
        setSuccess('تم إيقاف الإشعارات على هذا الجهاز.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setError('');
    setSuccess('');
    const reminderLeadMinutes = Number(reminderInput);
    if (!Number.isInteger(reminderLeadMinutes) || reminderLeadMinutes < 0) {
      setError('أدخل عدد دقائق صحيحاً وغير سالب.');
      return;
    }

    setBusy(true);
    try {
      const saved = await api.updateSettings({
        ...settings,
        language: 'ar',
        reminderLeadMinutes,
      });
      setSettings(saved);
      setReminderInput(String(saved.reminderLeadMinutes));
      setSuccess('تم حفظ الإعدادات بنجاح.');
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setError('');
    try {
      await logout();
    } catch (requestError) {
      setError(`تم إنهاء الجلسة محلياً، لكن تعذر تأكيد الخروج من الخادم: ${getApiErrorMessage(requestError)}`);
    }
  }

  if (loading) {
    return <LoadingState label="جارٍ تحميل الإعدادات..." />;
  }

  if (!settings) {
    return (
      <ScreenState
        title="تعذر تحميل الإعدادات"
        message={error}
        actionLabel="إعادة المحاولة"
        onAction={retryLoadSettings}
      />
    );
  }

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
          <Text style={styles.headerTitle}>الإعدادات</Text>
          <Text style={styles.headerSubtitle}>تخصيص وتفضيلات التطبيق والحساب</Text>
        </View>

        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Messages */}
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

        {/* Section 1: Notifications & Reminders */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="notifications" size={18} color={palette.primary} />
            </View>
            <View style={styles.cardHeaderTexts}>
              <Text style={styles.cardTitle}>الإشعارات والتذكير</Text>
              <Text style={styles.cardSubtitle}>التحكم في تنبيهات المهام والعادات</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Notifications Toggle */}
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>إشعارات التطبيق (Push)</Text>
              <Text style={styles.rowDesc}>استقبال التذكيرات الفورية على جهازك</Text>
            </View>
            <Switch
              accessibilityLabel="تفعيل الإشعارات"
              value={settings.notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
              thumbColor={settings.notificationsEnabled ? palette.primary : '#FFFFFF'}
            />
          </View>

          {/* Hint */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
            <Text style={styles.infoBannerText}>
              على iPhone: يجب تثبيت التطبيق على الشاشة الرئيسية (من Safari) لتصلك الإشعارات في الخلفية.
            </Text>
          </View>

          {/* Reminder Lead Minutes */}
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>التنبيه قبل الموعد (بالدقائق)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="time-outline" size={18} color={palette.muted} />
              <TextInput
                accessibilityLabel="دقائق التذكير قبل الموعد"
                keyboardType="number-pad"
                value={reminderInput}
                onChangeText={setReminderInput}
                style={styles.textInput}
                placeholder="15"
                placeholderTextColor={palette.muted}
              />
              <Text style={styles.inputSuffix}>دقيقة</Text>
            </View>
          </View>
        </View>

        {/* Section 2: Appearance & Language */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="color-palette" size={18} color="#D97706" />
            </View>
            <View style={styles.cardHeaderTexts}>
              <Text style={styles.cardTitle}>المظهر واللغة</Text>
              <Text style={styles.cardSubtitle}>تخصيص الواجهة والعرض</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.fieldLabel}>نمط الواجهة</Text>
          <View style={styles.segmentedRow}>
            {(['light', 'dark'] as const).map((t) => {
              const isSelected = settings.theme === t;
              return (
                <Pressable
                  key={t}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => setSettings({ ...settings, theme: t })}
                  style={[
                    styles.segmentButton,
                    isSelected && styles.segmentButtonActive,
                  ]}
                >
                  <Ionicons
                    name={t === 'light' ? 'sunny-outline' : 'moon-outline'}
                    size={16}
                    color={isSelected ? palette.primary : palette.muted}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      isSelected && styles.segmentTextActive,
                    ]}
                  >
                    {t === 'light' ? 'فاتح' : 'داكن'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.row, { marginTop: 14 }]}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowLabel}>لغة التطبيق</Text>
              <Text style={styles.rowDesc}>اللغة المستخدمة في كل الشاشات</Text>
            </View>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>العربية (افتراضي)</Text>
            </View>
          </View>
        </View>

        {/* Section 3: Cloud Integrations */}
        {integration ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="cloud-done" size={18} color="#059669" />
              </View>
              <View style={styles.cardHeaderTexts}>
                <Text style={styles.cardTitle}>حالة الخدمات والربط</Text>
                <Text style={styles.cardSubtitle}>حالة الاتصال بالأنظمة السحابية</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <ServiceRow
              icon="notifications-outline"
              label="خدمة الإشعارات (Push)"
              value={integration.fcm}
            />
            <ServiceRow
              icon="hardware-chip-outline"
              label="الذكاء الاصطناعي (AI)"
              value={integration.huggingface}
            />
            <ServiceRow
              icon="map-outline"
              label="خدمة الخرائط (Maps)"
              value={integration.maps}
            />
            <ServiceRow
              icon="server-outline"
              label="التخزين السحابي (Storage)"
              value={integration.storage}
            />
          </View>
        ) : null}

        {/* Save Changes Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="حفظ الإعدادات"
          onPress={saveSettings}
          disabled={busy}
          style={[styles.saveBtn, busy && styles.saveBtnDisabled]}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.saveBtnText}>
            {busy ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
          </Text>
        </Pressable>

        {/* Section 4: Account Actions */}
        <View style={[styles.card, styles.dangerCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            </View>
            <View style={styles.cardHeaderTexts}>
              <Text style={[styles.cardTitle, { color: '#EF4444' }]}>الحساب والجلسة</Text>
              <Text style={styles.cardSubtitle}>إدارة تسجيل الخروج من الجهاز</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="تسجيل الخروج"
            onPress={signOut}
            disabled={busy}
            style={styles.logoutBtn}
          >
            <Ionicons name="exit-outline" size={18} color="#EF4444" />
            <Text style={styles.logoutBtnText}>تسجيل الخروج</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function ServiceRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const ok = value === 'ok';
  return (
    <View style={styles.serviceRow}>
      <View style={styles.serviceInfo}>
        <Ionicons name={icon} size={16} color={palette.muted} />
        <Text style={styles.serviceLabel}>{label}</Text>
      </View>
      <View style={[styles.serviceBadge, ok ? styles.serviceOk : styles.serviceWarn]}>
        <Ionicons
          name={ok ? 'checkmark-circle' : 'close-circle'}
          size={12}
          color={ok ? '#059669' : '#DC2626'}
        />
        <Text style={[styles.serviceBadgeText, ok ? styles.serviceOkText : styles.serviceWarnText]}>
          {ok ? 'متصل ومفعّل' : 'غير متوفر'}
        </Text>
      </View>
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EBF0F7',
    shadowColor: '#0F172A',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  dangerCard: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FFFAFA',
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
    marginVertical: 14,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowInfo: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    textAlign: 'right',
    writingDirection: 'rtl',
    lineHeight: 18,
  },
  fieldBlock: {
    marginTop: 14,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingVertical: 0,
  },
  inputSuffix: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  segmentedRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 8,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  segmentButtonActive: {
    borderColor: palette.primary,
    backgroundColor: '#EFF6FF',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentTextActive: {
    color: palette.primary,
    fontWeight: '700',
  },
  badgePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  serviceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  serviceInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  serviceLabel: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
    writingDirection: 'rtl',
  },
  serviceBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  serviceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  serviceOk: {
    backgroundColor: '#ECFDF5',
  },
  serviceOkText: {
    color: '#059669',
  },
  serviceWarn: {
    backgroundColor: '#FEF2F2',
  },
  serviceWarnText: {
    color: '#DC2626',
  },
  saveBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.primary,
    borderRadius: 16,
    height: 48,
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
  logoutBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    height: 44,
  },
  logoutBtnText: {
    color: '#EF4444',
    fontSize: 14,
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
