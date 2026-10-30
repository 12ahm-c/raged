import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../../api/client';
import { commonStyles, LoadingState, palette, ScreenState } from '../../components/ui/States';
import type { ProgressOverviewDTO } from '../../types/dto';
import { getApiErrorMessage } from '../../utils/apiError';

export function ProgressOverviewScreen() {
  const [overview, setOverview] = useState<ProgressOverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getProgressOverview();
      setOverview(data);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return <LoadingState label="جارٍ تحميل خريطة التقدم" />;
  }

  if (error) {
    return (
      <ScreenState
        title="تعذر تحميل خريطة التقدم"
        message={error}
        actionLabel="إعادة المحاولة"
        onAction={() => void load()}
      />
    );
  }

  return (
    <View style={commonStyles.screen}>
      <ScrollView contentContainerStyle={commonStyles.content}>
        <Text style={commonStyles.title}>خريطة التقدم</Text>

        <View style={commonStyles.card}>
          <Text style={commonStyles.label}>إجمالي العادات</Text>
          <StatRow label="نسبة إكمال اليوم" value={`${overview?.habits?.dailyCompletionPercent ?? 0}%`} />
          <StatRow label="إجمالي النقاط" value={`${overview?.habits?.totalPoints ?? 0}`} />
          <StatRow label="أطول سلسلة" value={`${overview?.habits?.activeStreakMax ?? 0} يوم`} />
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.label}>الأهداف</Text>
          <StatRow label="الأهداف المحققة" value={`${overview?.goals?.achieved ?? 0}`} />
          <StatRow label="الأهداف النشطة" value={`${overview?.goals?.active ?? 0}`} />
        </View>

        <View style={commonStyles.card}>
          <Text style={commonStyles.label}>مشاريع</Text>
          {(overview?.projects?.length ?? 0) === 0 ? (
            <Text style={commonStyles.body}>لا توجد مشاريع متاحة حالياً.</Text>
          ) : (
            overview?.projects?.map((project) => (
              <View key={project.projectId} style={styles.projectRow}>
                <Text style={commonStyles.body}>{project.name}</Text>
                <Text style={styles.badge}>{project.achievementPercent}%</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={commonStyles.body}>{label}</Text>
      <Text style={styles.badge}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  projectRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  badge: {
    backgroundColor: '#E4F2EB',
    color: palette.primary,
    borderRadius: 999,
    minHeight: 30,
    paddingHorizontal: 10,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '700',
    fontSize: 12,
  },
});
