import type { NavigationProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import type { HabitDTO } from '../types/dto';

type HabitSpecial = HabitDTO['config']['special'];

interface SpecialPageTarget {
  route: keyof RootStackParamList;
  params?: { kind: 'program' | 'journal' | 'beek_idea' };
}

/**
 * ربط كل عادة ذات ميزة خاصة بصفحتها الخاصة،
 * بحيث يفتح الضغط على العادة في "عاداتي" أو "يومي" صفحة تنفيذها مباشرة.
 */
export function specialPageFor(special: HabitSpecial | undefined | null): SpecialPageTarget | null {
  switch (special) {
    case 'reading':
      return { route: 'Reading' };
    case 'quran':
      return { route: 'Quran' };
    case 'english':
      return { route: 'English' };
    case 'exercise':
      return { route: 'GPSRoute' };
    case 'brotherhood':
      return { route: 'Brotherhood' };
    case 'money':
    case 'pockets':
      return { route: 'Money' };
    case 'programs':
      return { route: 'Media', params: { kind: 'program' } };
    case 'beek':
      return { route: 'Media', params: { kind: 'beek_idea' } };
    default:
      // 'family' و 'none' ليس لهما صفحة تنفيذ مخصصة بعد → صفحة الإحصائيات.
      return null;
  }
}

export function openHabitPage(
  navigation: NavigationProp<RootStackParamList>,
  habitId: string,
  special: HabitSpecial | undefined | null
): void {
  const target = specialPageFor(special);
  if (target?.params) {
    navigation.navigate(target.route as 'Media', target.params);
    return;
  }
  if (target) {
    navigation.navigate(target.route as never);
    return;
  }
  navigation.navigate('HabitDetail', { id: habitId });
}
