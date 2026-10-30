import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAuthStore } from './src/stores/authStore';
import { registerServiceWorker } from './src/hooks/usePushNotifications';
import { useNotificationStore } from './src/stores/notificationStore';
import { useThemeStore } from './src/theme/themeStore';

export default function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const authStatus = useAuthStore((state) => state.status);
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount);
  const isDark = useThemeStore((state) => state.isDark);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';

      // أضف رابط الـ manifest للـ PWA
      if (!document.querySelector('link[rel="manifest"]')) {
        const link = document.createElement('link');
        link.rel = 'manifest';
        link.href = '/manifest.json';
        document.head.appendChild(link);
      }

      // meta theme-color لشريط iOS Safari
      if (!document.querySelector('meta[name="theme-color"]')) {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.content = '#2563EB';
        document.head.appendChild(meta);
      }

      // meta apple-mobile-web-app-capable لـ iOS PWA fullscreen
      if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
        const meta = document.createElement('meta');
        meta.name = 'apple-mobile-web-app-capable';
        meta.content = 'yes';
        document.head.appendChild(meta);
      }

      // apple-mobile-web-app-status-bar-style
      if (!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
        const meta = document.createElement('meta');
        meta.name = 'apple-mobile-web-app-status-bar-style';
        meta.content = 'default';
        document.head.appendChild(meta);
      }

      // apple-mobile-web-app-title
      if (!document.querySelector('meta[name="apple-mobile-web-app-title"]')) {
        const meta = document.createElement('meta');
        meta.name = 'apple-mobile-web-app-title';
        meta.content = 'رغد';
        document.head.appendChild(meta);
      }
    }

    // سجّل الـ Service Worker عند بدء التطبيق
    void registerServiceWorker();
    void useThemeStore.getState().initTheme();
    void bootstrap();
  }, [bootstrap]);

  // حمّل عداد الإشعارات بعد تسجيل الدخول
  useEffect(() => {
    if (authStatus === 'authenticated') {
      void fetchUnreadCount();
    }
  }, [authStatus, fetchUnreadCount]);

  return (
    <SafeAreaProvider>
      <AppNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}
