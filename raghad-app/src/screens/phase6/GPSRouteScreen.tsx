import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { api } from '../../api/client';
import {
  commonStyles,
  LoadingState,
  palette,
  PrimaryButton,
  ScreenState,
} from '../../components/ui/States';
import type { HabitDTO, HabitLogDTO } from '../../types/dto';
import type { RootStackParamList } from '../../navigation/types';
import { getApiErrorMessage } from '../../utils/apiError';
import { goBackSafe } from '../../utils/goBackSafe';
import { RouteMap, type GeoPoint } from './RouteMap';

/** المسافة بالكيلومتر بين نقطتين عبر صيغة Haversine. */
function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const halfLat = dLat / 2;
  const halfLng = dLng / 2;
  const h =
    Math.sin(halfLat) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(halfLng) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const STATUS_AR: Record<HabitLogDTO['status'], string> = {
  completed: 'منجزة ✓',
  missed: 'فائتة',
  skipped: 'متخطاة',
  pending: 'قيد الانتظار',
};

function formatDay(date: string): string {
  const parsed = new Date(date.length === 10 ? `${date}T00:00:00.000Z` : date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('ar-MR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function readRoute(log: HabitLogDTO): GeoPoint[] {
  const raw = log.metadata?.route;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (point): point is GeoPoint =>
        typeof point === 'object' &&
        point !== null &&
        typeof (point as GeoPoint).lat === 'number' &&
        typeof (point as GeoPoint).lng === 'number'
    );
}

function readDistance(log: HabitLogDTO): number | null {
  const raw = log.metadata?.distanceKm;
  return typeof raw === 'number' ? raw : null;
}

export function GPSRouteScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [habit, setHabit] = useState<HabitDTO | null>(null);
  const [history, setHistory] = useState<HabitLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [tracking, setTracking] = useState(false);
  const [route, setRoute] = useState<GeoPoint[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [saving, setSaving] = useState(false);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);

  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const habitsResponse = await api.listHabits({ limit: 100 });
      const targetHabit =
        habitsResponse.items.find(
          (item) => item.config?.special === 'exercise' || item.name.includes('رياض')
        ) ?? null;
      setHabit(targetHabit);

      if (targetHabit) {
        const historyLogs = await api.getHabitHistory(targetHabit._id);
        setHistory(historyLogs);
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        subscriptionRef.current?.remove();
        subscriptionRef.current = null;
      };
    }, [load])
  );

  async function startTracking() {
    setPermissionDenied(false);
    setError('');
    setSuccess('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setPermissionDenied(true);
        return;
      }
      setRoute([]);
      setDistanceKm(0);
      setTracking(true);

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 4,
        },
        (position) => {
          const point: GeoPoint = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setRoute((current) => {
            const last = current[current.length - 1];
            if (last && haversineKm(last, point) < 0.003) return current;
            const next = [...current, point];
            if (last) setDistanceKm((value) => value + haversineKm(last, point));
            return next;
          });
        }
      );
      subscriptionRef.current?.remove();
      subscriptionRef.current = subscription;
    } catch (requestError) {
      setTracking(false);
      setError(getApiErrorMessage(requestError));
    }
  }

  async function stopTracking(save: boolean) {
    subscriptionRef.current?.remove();
    subscriptionRef.current = null;
    setTracking(false);
    if (!save) return;
    if (!habit) {
      setError('لم تُعثر على عادة الرياضة في عاداتك.');
      return;
    }
    if (route.length < 2 || distanceKm <= 0) {
      setSuccess('التتبع متوقف. لا يوجد مسار كافٍ للحفظ — اقطع مسافة قصيرة على الأقل.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.saveGPSRoute({
        habitId: habit._id,
        date: new Date().toISOString().slice(0, 10),
        distanceKm: Number(distanceKm.toFixed(3)),
        route,
      });
      setSuccess(`تم حفظ مسار اليوم: ${distanceKm.toFixed(2)} كم بنجاح ✓`);
      await load();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function saveNote(log: HabitLogDTO) {
    setSavingNoteId(log._id);
    setError('');
    try {
      await api.updateHabitLog(log._id, { note: noteDrafts[log._id] ?? '' });
      setSuccess('حُفظت ملاحظة اليوم.');
      setHistory((current) =>
        current.map((item) =>
          item._id === log._id ? { ...item, note: noteDrafts[log._id] ?? '' } : item
        )
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setSavingNoteId(null);
    }
  }

  if (loading) return <LoadingState label="جارٍ تحميل صفحة الرياضة..." />;

  const totalKm = history.reduce((sum, h) => sum + (readDistance(h) ?? 0), 0);

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header Bar */}
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.pageCategoryBadge}>العادات الصحية</Text>
            <Text style={styles.pageTitle}>الرياضة وتتبع المسار</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            onPress={() => goBackSafe(navigation)}
            style={({ pressed }) => [styles.backBtn, pressed && styles.btnPressed]}
          >
            <Ionicons name="arrow-forward" size={17} color={palette.primary} />
            <Text style={styles.backBtnText}>رجوع</Text>
          </Pressable>
        </View>

        {/* Global Feedback Banners */}
        {success ? (
          <View style={styles.alertSuccess} accessibilityRole="alert">
            <Ionicons name="checkmark-circle" size={18} color="#059669" />
            <Text style={styles.alertSuccessText}>{success}</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.alertError} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={styles.alertErrorText}>{error}</Text>
          </View>
        ) : null}

        {permissionDenied ? (
          <ScreenState
            title="إذن الموقع مرفوض"
            message="نحتاج إذن الموقع لحساب الكيلومترات ورسم الطريق. فعّل الإذن من إعدادات الجهاز ثم أعد المحاولة."
            actionLabel="منح الإذن وتتبع الموقع"
            onAction={() => void startTracking()}
          />
        ) : null}

        {/* Hero Tracker Card */}
        <LinearGradient
          colors={tracking ? ['#047857', '#059669', '#10B981'] : ['#1E293B', '#334155', '#475569']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <View style={styles.circleProgressTrack}>
              <Ionicons name={tracking ? 'navigate' : 'walk'} size={28} color="#FFFFFF" />
            </View>
            <View style={styles.heroTexts}>
              <View style={styles.statusPill}>
                <View style={[styles.statusDot, tracking && styles.statusDotActive]} />
                <Text style={styles.statusPillText}>
                  {tracking ? 'التتبع المباشر نشط الآن' : 'التتبع متوقف'}
                </Text>
              </View>
              <Text style={styles.heroDistanceNum}>
                {distanceKm.toFixed(2)} <Text style={styles.heroDistanceUnit}>كم</Text>
              </Text>
            </View>
          </View>

          {/* Quick Metrics */}
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatBox}>
              <Ionicons name="map-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{route.length}</Text>
              <Text style={styles.heroStatLabel}>نقاط المسار</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Ionicons name="flame-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{totalKm.toFixed(1)} كم</Text>
              <Text style={styles.heroStatLabel}>إجمالي المسافة</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroStatNum}>{history.length}</Text>
              <Text style={styles.heroStatLabel}>أيام الجري/المشي</Text>
            </View>
          </View>

          {/* Tracking Action Buttons */}
          <View style={styles.heroActionsRow}>
            {!tracking ? (
              <Pressable
                accessibilityRole="button"
                disabled={saving || !habit}
                onPress={() => {
                  if (route.length > 1) void stopTracking(true);
                  else void startTracking();
                }}
                style={({ pressed }) => [
                  styles.startTrackingBtn,
                  pressed && styles.btnPressed,
                  (saving || !habit) && styles.btnDisabled,
                ]}
              >
                <Ionicons name="play" size={18} color="#FFFFFF" />
                <Text style={styles.startTrackingBtnText}>
                  {saving ? 'جارٍ الحفظ...' : 'بدء التتبع المباشر'}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.trackingControlsRow}>
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => void stopTracking(true)}
                  style={({ pressed }) => [styles.stopSaveBtn, pressed && styles.btnPressed]}
                >
                  <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                  <Text style={styles.stopSaveBtnText}>إيقاف وحفظ المسار</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void stopTracking(false)}
                  style={styles.discardBtn}
                >
                  <Ionicons name="close" size={16} color="#FFFFFF" />
                  <Text style={styles.discardBtnText}>إلغاء دون حفظ</Text>
                </Pressable>
              </View>
            )}
          </View>
        </LinearGradient>

        {/* Route Map */}
        <View style={styles.mapCard}>
          <RouteMap route={route} />
        </View>

        {/* Section Header: سجل الأيام */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>سجل جلسات الرياضة</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{history.length} أيام</Text>
          </View>
        </View>

        {/* History List */}
        {history.length === 0 ? (
          <ScreenState
            title="لا أيام مسجلة بعد"
            message="ابدأ أول جلسة رياضة عبر زر التتبع وستظهر هنا بالتفصيل يومًا بيوم."
          />
        ) : (
          history.map((log) => {
            const distance = readDistance(log);
            const dayRoute = readRoute(log);

            return (
              <View key={log._id} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View style={styles.historyTitleGroup}>
                    <Text style={styles.historyDayTitle}>📅 {formatDay(log.date)}</Text>
                    <View style={styles.historyStatusBadge}>
                      <Text style={styles.historyStatusText}>{STATUS_AR[log.status]}</Text>
                    </View>
                  </View>

                  <View style={styles.historyMetaRow}>
                    {distance !== null ? (
                      <View style={styles.distanceBadge}>
                        <Ionicons name="footsteps-outline" size={13} color="#059669" />
                        <Text style={styles.distanceBadgeText}>{distance.toFixed(2)} كم</Text>
                      </View>
                    ) : null}

                    {dayRoute.length > 0 ? (
                      <View style={styles.pointsBadge}>
                        <Ionicons name="pin-outline" size={13} color={palette.primary} />
                        <Text style={styles.pointsBadgeText}>{dayRoute.length} نقطة</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {dayRoute.length > 1 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setRoute(dayRoute)}
                    style={styles.showRouteBtn}
                  >
                    <Ionicons name="map" size={14} color={palette.primary} />
                    <Text style={styles.showRouteBtnText}>عرض هذا المسار على الخريطة</Text>
                  </Pressable>
                ) : null}

                {/* Daily Note Form */}
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>ملاحظة اليوم</Text>
                  <TextInput
                    accessibilityLabel={`ملاحظة يوم ${formatDay(log.date)}`}
                    placeholder="اكتب ملاحظتك عن مسار أو نشاط اليوم…"
                    placeholderTextColor={palette.muted}
                    style={styles.noteInput}
                    multiline
                    value={noteDrafts[log._id] ?? log.note ?? ''}
                    onChangeText={(text) => setNoteDrafts((current) => ({ ...current, [log._id]: text }))}
                  />
                  <Pressable
                    disabled={savingNoteId === log._id}
                    onPress={() => void saveNote(log)}
                    style={[styles.saveNoteBtn, savingNoteId === log._id && styles.btnDisabled]}
                  >
                    <Text style={styles.saveNoteBtnText}>
                      {savingNoteId === log._id ? 'جارٍ الحفظ...' : 'حفظ الملاحظة'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleBox: {
    flex: 1,
    alignItems: 'flex-end',
  },
  pageCategoryBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    marginBottom: 2,
    textAlign: 'right',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  backBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtnText: {
    color: palette.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  heroCard: {
    borderRadius: 22,
    padding: 20,
    gap: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
  },
  circleProgressTrack: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroTexts: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  statusPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
  },
  statusDotActive: {
    backgroundColor: '#4ADE80',
  },
  statusPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  heroDistanceNum: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'right',
  },
  heroDistanceUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  heroStatsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroStatBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  heroStatNum: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  heroStatLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  heroActionsRow: {
    width: '100%',
  },
  startTrackingBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 14,
  },
  startTrackingBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  trackingControlsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  stopSaveBtn: {
    flex: 2,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 12,
  },
  stopSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  discardBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderRadius: 14,
    paddingVertical: 12,
  },
  discardBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  mapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: palette.text,
  },
  countBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#EBF0F7',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  historyHeader: {
    gap: 6,
  },
  historyTitleGroup: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyDayTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
  },
  historyStatusBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  historyStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  historyMetaRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  distanceBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  distanceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  pointsBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pointsBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
  },
  showRouteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  showRouteBtnText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  noteBox: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    gap: 6,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.muted,
    textAlign: 'right',
  },
  noteInput: {
    minHeight: 50,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    fontSize: 13,
    color: palette.text,
    textAlign: 'right',
    backgroundColor: '#F8FAFC',
    textAlignVertical: 'top',
  },
  saveNoteBtn: {
    alignSelf: 'flex-start',
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  saveNoteBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  alertSuccess: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  alertSuccessText: {
    flex: 1,
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  alertError: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  alertErrorText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
