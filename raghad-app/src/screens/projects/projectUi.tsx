import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../api/client';
import { commonStyles, palette } from '../../components/ui/States';
import type { ProjectDTO, ProjectNodeDTO } from '../../types/dto';
import { getApiErrorMessage } from '../../utils/apiError';
import { goBackSafe } from '../../utils/goBackSafe';

export function getProjectHeaderIcon(key: ProjectDTO['key']): keyof typeof Ionicons.glyphMap {
  switch (key) {
    case 'lb':
      return 'laptop-outline';
    case 'supnum':
      return 'cube-outline';
    case 'basma_tech':
      return 'code-slash-outline';
    case 'competitions':
      return 'trophy-outline';
    case 'messages_gaza':
      return 'mail-outline';
    case 'hasaniya':
      return 'book-outline';
    case 'ai_depth':
      return 'hardware-chip-outline';
    default:
      return 'briefcase-outline';
  }
}

/** شريط تقدم موحد وعصري لكل صفحات المشاريع. */
export function ProgressBar({ percent }: { percent: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(percent ?? 0)));
  return (
    <View style={ui.progressTrack} accessibilityLabel={`نسبة التقدم ${safe}%`}>
      <View style={[ui.progressFill, { width: `${safe}%` }]} />
    </View>
  );
}

/** ترويسة المشروع العصرية المتوافقة مع التصميم الجديد للصفحات الرئيسية. */
export function ProjectHeader({
  project,
  subtitle,
  rightAction,
}: {
  project: ProjectDTO;
  subtitle?: string;
  rightAction?: React.ReactNode;
}) {
  const navigation = useNavigation();
  const safeProgress = Math.max(0, Math.min(100, Math.round(project.progress ?? 0)));
  const iconName = getProjectHeaderIcon(project.key);

  return (
    <View style={ui.headerContainer}>
      {/* Top Bar with modern Back Button */}
      <View style={ui.topBar}>
        <View style={ui.topTitleGroup}>
          <Text style={ui.pageCategoryBadge}>المشاريع المتخصصة</Text>
          <Text style={ui.pageMainTitle}>{project.name}</Text>
        </View>

        <View style={ui.topActionsRow}>
          {rightAction ? rightAction : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            onPress={() => goBackSafe(navigation)}
            style={({ pressed }) => [ui.backPill, pressed && ui.backPillPressed]}
          >
            <Ionicons name="arrow-forward" size={17} color={palette.primary} />
            <Text style={ui.backPillText}>رجوع</Text>
          </Pressable>
        </View>
      </View>

      {/* Hero Banner Card */}
      <LinearGradient
        colors={['#1E3A8A', '#2563EB', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ui.heroCard}
      >
        <View style={ui.heroTopRow}>
          <View style={ui.heroIconBox}>
            <Ionicons name={iconName} size={28} color="#FFFFFF" />
          </View>
          <View style={ui.heroTextGroup}>
            <Text style={ui.heroName}>{project.name}</Text>
            {project.description ? (
              <Text style={ui.heroDescription} numberOfLines={2}>
                {project.description}
              </Text>
            ) : null}
            {subtitle ? <Text style={ui.heroSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>

        {/* Hero Progress Section */}
        <View style={ui.heroProgressBox}>
          <View style={ui.heroProgressLabels}>
            <Text style={ui.heroProgressPercent}>{safeProgress}%</Text>
            <Text style={ui.heroProgressTitle}>نسبة الإنجاز الإجمالية</Text>
          </View>
          <View style={ui.heroProgressTrack}>
            <View style={[ui.heroProgressFill, { width: `${safeProgress}%` }]} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

export function SectionTitle({
  title,
  badge,
  action,
}: {
  title: string;
  badge?: string | number;
  action?: React.ReactNode;
}) {
  return (
    <View style={ui.sectionRow}>
      <View style={ui.sectionTitleGroup}>
        <Text style={ui.sectionTitle}>{title}</Text>
        {badge !== undefined ? (
          <View style={ui.sectionBadge}>
            <Text style={ui.sectionBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {action ?? null}
    </View>
  );
}

export function TinyAction({
  label,
  icon,
  onPress,
  selected = false,
  danger = false,
  disabled = false,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  selected?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.tiny,
        selected && ui.tinySelected,
        danger && ui.tinyDanger,
        disabled && ui.tinyDisabled,
        pressed && !disabled && ui.tinyPressed,
      ]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={15}
          color={selected ? '#FFFFFF' : danger ? palette.danger : palette.primary}
          style={ui.tinyIcon}
        />
      ) : null}
      <Text style={[ui.tinyText, selected && ui.tinyTextSelected, danger && ui.tinyTextDanger]}>
        {label}
      </Text>
    </Pressable>
  );
}

const STATUS_AR: Record<ProjectNodeDTO['status'], string> = {
  todo: 'قيد الانتظار',
  in_progress: 'جارية',
  done: 'منجزة',
};

export function statusAr(status: ProjectNodeDTO['status']): string {
  return STATUS_AR[status] ?? status;
}

export function formatDateAr(value?: string | null): string {
  if (!value) return '';
  const date = new Date(String(value).length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ar-MR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function todayInputDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nouakchott',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function addDays(dateInput: string, days: number): Date {
  const base = new Date(`${dateInput.slice(0, 10)}T00:00:00.000Z`);
  return new Date(base.getTime() + days * 86400000);
}

export function readString(data: Record<string, unknown>, key: string): string | undefined {
  return typeof data?.[key] === 'string' ? (data[key] as string) : undefined;
}

export function readNumber(data: Record<string, unknown>, key: string): number | undefined {
  return typeof data?.[key] === 'number' ? (data[key] as number) : undefined;
}

/** تحميل كل عقد المشروع مرة واحدة مع إعادة تحميل يدوية. */
export function useProjectNodes(projectId: string) {
  const [nodes, setNodes] = useState<ProjectNodeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setNodes(await api.listProjectNodes(projectId, { limit: 100 }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  return { nodes, loading, error, reload: load };
}

export function childrenOf(nodes: ProjectNodeDTO[], parentId: string): ProjectNodeDTO[] {
  return nodes.filter((node) => node.parentId === parentId).sort((a, b) => a.order - b.order);
}

const ui = StyleSheet.create({
  headerContainer: {
    gap: 14,
    marginBottom: 10,
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  topTitleGroup: {
    flex: 1,
    alignItems: 'flex-end',
  },
  pageCategoryBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
    marginBottom: 2,
    textAlign: 'right',
  },
  pageMainTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'right',
  },
  topActionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  backPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  backPillPressed: {
    opacity: 0.8,
    backgroundColor: '#F1F5F9',
  },
  backPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.primary,
  },
  heroCard: {
    borderRadius: 22,
    padding: 20,
    gap: 16,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  heroIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextGroup: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'right',
  },
  heroDescription: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
  },
  heroSubtitle: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  heroProgressBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  heroProgressLabels: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroProgressTitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '600',
  },
  heroProgressPercent: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  heroProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  progressTrack: {
    height: 10,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.primary,
    borderRadius: 6,
  },
  sectionRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
    gap: 10,
  },
  sectionTitleGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'right',
  },
  sectionBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
  },
  tiny: {
    minHeight: 38,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  tinyPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  tinySelected: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    shadowColor: palette.primary,
    shadowOpacity: 0.2,
    elevation: 2,
  },
  tinyDanger: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  tinyDisabled: {
    opacity: 0.5,
  },
  tinyIcon: {
    marginLeft: 4,
  },
  tinyText: {
    color: palette.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  tinyTextSelected: {
    color: '#FFFFFF',
  },
  tinyTextDanger: {
    color: palette.danger,
  },
});
