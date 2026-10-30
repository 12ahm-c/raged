import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  type LinkingOptions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { SplashScreen } from '../screens/auth/SplashScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { ScreenState } from '../components/ui/States';
import { MainLayout } from '../components/layout/MainLayout';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../theme/themeStore';
import { HabitDetailScreen } from '../screens/habits/HabitDetailScreen';
import { TasksScreen } from '../screens/tabs/TasksScreen';
import { ProjectDetailScreen } from '../screens/projects/ProjectsScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { GPSRouteScreen } from '../screens/phase6/GPSRouteScreen';
import { ProgressOverviewScreen } from '../screens/phase6/ProgressOverviewScreen';
import { ReadingScreen } from '../screens/reading/ReadingScreen';
import { EnglishScreen } from '../screens/english/EnglishScreen';
import { MoneyScreen } from '../screens/money/MoneyScreen';
import { BrotherhoodScreen } from '../screens/brotherhood/BrotherhoodScreen';
import { MediaScreen } from '../screens/media/MediaScreen';
import { QuranScreen } from '../screens/quran/QuranScreen';
import { HasaniyaScreen } from '../screens/hasaniya/HasaniyaScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/')],
  config: {
    screens: {
      Splash: 'auth/splash',
      Login: 'auth/login',
      Register: 'auth/register',
      Main: {
        path: '',
        screens: {
          Today: 'today',
          Habits: 'habits',
          Projects: 'projects',
          Goals: 'goals',
          Progress: 'progress',
          Calendar: 'calendar',
          Settings: 'settings',
        },
      },
      Profile: 'profile',
      HabitDetail: 'habits/:id',
      Tasks: 'tasks',
      ProjectDetail: 'projects/:id',
      ProgressOverview: 'progress-overview',
      GPSRoute: 'gps-route',
      Notifications: 'notifications',
      Reading: 'reading',
      Quran: 'quran',
      English: 'english',
      Brotherhood: 'brotherhood',
      Money: 'money',
      Media: 'media',
      Hasaniya: 'hasaniya',
    },
  },
};

export function AppNavigator() {
  const status = useAuthStore((state) => state.status);
  const bootstrapError = useAuthStore((state) => state.bootstrapError);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const isDark = useThemeStore((state) => state.isDark);

  if (status === 'error') {
    return (
      <ScreenState
        title="تعذر استعادة الجلسة"
        message={bootstrapError ?? 'تحقق من اتصالك بالخادم وأعد المحاولة.'}
        actionLabel="إعادة المحاولة"
        onAction={() => void bootstrap()}
      />
    );
  }

  return (
    <NavigationContainer linking={linking} theme={isDark ? DarkTheme : DefaultTheme}>
      <Stack.Navigator
        key={status}
        initialRouteName={status === 'authenticated' ? 'Main' : 'Splash'}
        screenOptions={{ headerShown: false }}
      >
        {status === 'authenticated' ? (
          <>
            <Stack.Screen name="Main" component={MainLayout} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="HabitDetail" component={HabitDetailScreen} />
            <Stack.Screen name="Tasks" component={TasksScreen} />
            <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="ProgressOverview" component={ProgressOverviewScreen} />
            <Stack.Screen name="GPSRoute" component={GPSRouteScreen} />
            <Stack.Screen name="Reading" component={ReadingScreen} />
            <Stack.Screen name="Quran" component={QuranScreen} />
            <Stack.Screen name="English" component={EnglishScreen} />
            <Stack.Screen name="Brotherhood" component={BrotherhoodScreen} />
            <Stack.Screen name="Money" component={MoneyScreen} />
            <Stack.Screen name="Media" component={MediaScreen} />
            <Stack.Screen name="Hasaniya" component={HasaniyaScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Splash">
              {(props) => <SplashScreen {...props} booting={status === 'loading'} />}
            </Stack.Screen>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
