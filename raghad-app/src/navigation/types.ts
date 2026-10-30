import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Today: undefined;
  Habits: undefined;
  Projects: undefined;
  Goals: undefined;
  Progress: undefined;
  Calendar: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Profile: undefined;
  HabitDetail: { id: string };
  Tasks: undefined;
  ProjectDetail: { id: string };
  ProgressOverview: undefined;
  GPSRoute: undefined;
  Notifications: undefined;
  Reading: undefined;
  Quran: undefined;
  English: undefined;
  Brotherhood: undefined;
  Money: undefined;
  Media: { kind?: 'program' | 'journal' | 'beek_idea' } | undefined;
  Hasaniya: undefined;
};
