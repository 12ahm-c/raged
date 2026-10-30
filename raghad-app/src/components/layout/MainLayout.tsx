import { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SettingsScreen } from '../../screens/profile/SettingsScreen';
import { commonStyles, palette } from '../ui/States';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { TodayScreen } from '../../screens/tabs/TodayScreen';
import { HabitsScreen } from '../../screens/tabs/HabitsScreen';
import { GamificationScreen } from '../../screens/tabs/GamificationScreen';
import { ProjectsScreen } from '../../screens/projects/ProjectsScreen';
import { GoalsScreen } from '../../screens/tabs/GoalsScreen';
import { CalendarScreen } from '../../screens/tabs/CalendarScreen';
import { NotificationsModal } from '../../screens/notifications/NotificationsScreen';
import { useNotificationStore } from '../../stores/notificationStore';

const Tab = createBottomTabNavigator<MainTabParamList>();

function HeaderBar({ onOpenNotifications }: { onOpenNotifications: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <View style={styles.header}>
      {/* Brand & Logo on the left */}
      <View style={styles.brandContainer}>
        <Image
          source={require('../../../assets/logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.brandText}>raged</Text>
      </View>

      {/* Right side: Profile button + Notification Bell */}
      <View style={styles.headerActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="الملف الشخصي"
          onPress={() => navigation.navigate('Profile')}
          style={styles.profileButton}
        >
          <Ionicons name="person-outline" size={16} color={palette.text} />
          <Text style={styles.profileButtonText}>الملف الشخصي</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            unreadCount > 0 ? `الإشعارات — ${unreadCount} غير مقروء` : 'الإشعارات'
          }
          onPress={onOpenNotifications}
          style={styles.notificationBtn}
        >
          <Ionicons name="notifications-outline" size={20} color={palette.text} />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {unreadCount > 99 ? '99+' : String(unreadCount)}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

export function MainLayout() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [moreVisible, setMoreVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);

  return (
    <SafeAreaView style={commonStyles.screen}>
      <HeaderBar onOpenNotifications={() => setNotificationsVisible(true)} />
      <Tab.Navigator
        initialRouteName="Today"
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: styles.tabBar,
        }}
      >
        <Tab.Screen
          name="Today"
          options={{
            title: 'يومي',
            tabBarButton: (props) => (
              <CustomTabButton
                label="يومي"
                icon="home-outline"
                activeIcon="home"
                focused={Boolean(props.accessibilityState?.selected)}
                onPress={props.onPress}
              />
            ),
          }}
        >
          {() => <TodayScreen />}
        </Tab.Screen>

        <Tab.Screen
          name="Habits"
          options={{
            title: 'عاداتي',
            tabBarButton: (props) => (
              <CustomTabButton
                label="عاداتي"
                icon="checkmark-circle-outline"
                activeIcon="checkmark-circle"
                focused={Boolean(props.accessibilityState?.selected)}
                onPress={props.onPress}
              />
            ),
          }}
        >
          {() => <HabitsScreen />}
        </Tab.Screen>

        <Tab.Screen
          name="Goals"
          options={{
            title: 'الأهداف',
            tabBarButton: (props) => (
              <CustomTabButton
                label="الأهداف"
                icon="radio-button-on-outline"
                activeIcon="radio-button-on"
                focused={Boolean(props.accessibilityState?.selected)}
                onPress={props.onPress}
              />
            ),
          }}
        >
          {() => <GoalsScreen />}
        </Tab.Screen>

        <Tab.Screen
          name="Progress"
          options={{
            title: 'التقدم',
            tabBarButton: (props) => (
              <CustomTabButton
                label="التقدم"
                icon="trending-up-outline"
                activeIcon="trending-up"
                focused={Boolean(props.accessibilityState?.selected)}
                onPress={props.onPress}
              />
            ),
          }}
        >
          {() => <GamificationScreen />}
        </Tab.Screen>

        <Tab.Screen
          name="Calendar"
          options={{
            title: 'الرزنامة',
            tabBarButton: (props) => (
              <CustomTabButton
                label="الرزنامة"
                icon="calendar-outline"
                activeIcon="calendar"
                focused={Boolean(props.accessibilityState?.selected)}
                onPress={props.onPress}
              />
            ),
          }}
        >
          {() => <CalendarScreen />}
        </Tab.Screen>

        {/* The "المزيد" button */}
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: 'المزيد',
            tabBarButton: () => (
              <CustomTabButton
                label="المزيد"
                icon="ellipsis-horizontal"
                activeIcon="ellipsis-horizontal"
                focused={false}
                onPress={() => setMoreVisible(true)}
              />
            ),
          }}
        />

        {/* Hidden direct route screens to maintain navigation compatibility */}
        <Tab.Screen
          name="Projects"
          options={{ tabBarButton: () => null }}
        >
          {() => <ProjectsScreen />}
        </Tab.Screen>
      </Tab.Navigator>

      {/* "المزيد" Drawer / Bottom Sheet Modal */}
      <Modal
        visible={moreVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreVisible(false)}
      >
        <Pressable
          style={styles.moreOverlay}
          onPress={() => setMoreVisible(false)}
        >
          <View style={styles.moreSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>المزيد من الأقسام</Text>

            <View style={styles.sheetGrid}>
              <SheetItem
                icon="briefcase-outline"
                label="مشاريعي"
                onPress={() => {
                  setMoreVisible(false);
                  navigation.navigate('Main', { screen: 'Projects' });
                }}
              />
              <SheetItem
                icon="calendar-outline"
                label="الروزنامة"
                onPress={() => {
                  setMoreVisible(false);
                  navigation.navigate('Main', { screen: 'Calendar' });
                }}
              />
              <SheetItem
                icon="checkbox-outline"
                label="المهام اليومية"
                onPress={() => {
                  setMoreVisible(false);
                  navigation.navigate('Tasks');
                }}
              />
              <SheetItem
                icon="notifications-outline"
                label="الإشعارات"
                onPress={() => {
                  setMoreVisible(false);
                  setNotificationsVisible(true);
                }}
              />
              <SheetItem
                icon="settings-outline"
                label="الإعدادات"
                onPress={() => {
                  setMoreVisible(false);
                  navigation.navigate('Main', { screen: 'Settings' });
                }}
              />
              <SheetItem
                icon="person-outline"
                label="الملف الشخصي"
                onPress={() => {
                  setMoreVisible(false);
                  navigation.navigate('Profile');
                }}
              />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* نافذة الإشعارات المصغرة */}
      <NotificationsModal
        visible={notificationsVisible}
        onClose={() => setNotificationsVisible(false)}
      />
    </SafeAreaView>
  );
}

function CustomTabButton({
  label,
  icon,
  activeIcon,
  focused,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  onPress?: (e?: any) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={styles.tabBtn}
    >
      <View style={[styles.tabContent, focused && styles.tabContentActive]}>
        <Ionicons
          name={focused ? activeIcon : icon}
          size={20}
          color={focused ? palette.primary : palette.muted}
        />
        <Text
          style={[styles.tabLabelText, focused && styles.tabLabelTextActive]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function SheetItem({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetItemBox,
        pressed && styles.sheetItemBoxPressed,
      ]}
    >
      <View style={styles.sheetItemIconBox}>
        <Ionicons name={icon} size={22} color={palette.primary} />
      </View>
      <Text style={styles.sheetItemText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  brandText: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  profileButtonText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  notificationBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  tabBar: {
    height: 64,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 3,
  },
  tabContentActive: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
  },
  tabLabelText: {
    fontSize: 11,
    color: palette.muted,
    fontWeight: '600',
  },
  tabLabelTextActive: {
    color: palette.primary,
    fontWeight: '800',
  },
  moreOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  moreSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 36,
    gap: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: palette.text,
    textAlign: 'center',
  },
  sheetGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
  },
  sheetItemBox: {
    width: '30.5%',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sheetItemBoxPressed: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  sheetItemIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.text,
    textAlign: 'center',
  },
});
