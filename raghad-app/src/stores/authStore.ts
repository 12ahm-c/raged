import { create } from 'zustand';
import {
  ApiClientError,
  api,
  setAccessToken,
  setSessionExpiredHandler,
} from '../api/client';
import { tokenStorage } from '../api/storage';
import type { LoginResponseDTO, RegisterRequestDTO, UserDTO } from '../types/dto';
import { useThemeStore } from '../theme/themeStore';

type AuthStatus = 'loading' | 'error' | 'unauthenticated' | 'authenticated';

interface AuthState {
  status: AuthStatus;
  user: UserDTO | null;
  bootstrapError: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterRequestDTO) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: UserDTO) => void;
  clearSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => {
  /** حفظ توكنات الجلسة وجلب المستخدم — يُستخدم بعد الدخول وبعد إنشاء الحساب. */
  async function startSession(result: LoginResponseDTO): Promise<void> {
    setAccessToken(result.accessToken);
    try {
      await tokenStorage.setRefreshToken(result.refreshToken);
      const user = await api.me();
      if (user?.settings?.theme) {
        void useThemeStore.getState().setTheme(user.settings.theme);
      }
      set({ status: 'authenticated', user, bootstrapError: null });
    } catch (error) {
      setAccessToken(null);
      try {
        await tokenStorage.clear();
      } finally {
        set({ status: 'unauthenticated', user: null, bootstrapError: null });
      }
      throw error;
    }
  }

  return {
    status: 'loading',
    user: null,
    bootstrapError: null,

    async bootstrap() {
      set({ status: 'loading', user: null, bootstrapError: null });
      try {
        await tokenStorage.removeLegacyAccessToken();
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) {
          set({ status: 'unauthenticated', user: null });
          return;
        }
        const user = await api.restoreSession();
        if (user?.settings?.theme) {
          void useThemeStore.getState().setTheme(user.settings.theme);
        }
        set({ status: 'authenticated', user });
      } catch (error) {
        if (
          error instanceof ApiClientError &&
          (error.code === 'TOKEN_INVALID' || error.code === 'AUTH_REQUIRED')
        ) {
          setAccessToken(null);
          try {
            await tokenStorage.clear();
            set({ status: 'unauthenticated', user: null });
          } catch (cleanupError) {
            set({
              status: 'error',
              user: null,
              bootstrapError:
                cleanupError instanceof Error
                  ? cleanupError.message
                  : 'تعذر مسح بيانات الجلسة المحلية.',
            });
          }
          return;
        }
        set({
          status: 'error',
          user: null,
          bootstrapError:
            error instanceof Error
              ? error.message
              : 'تعذر التحقق من الجلسة. تحقق من الاتصال وأعد المحاولة.',
        });
      }
    },

    async login(email, password) {
      return startSession(await api.login({ email, password }));
    },

    async register(input) {
      return startSession(await api.register(input));
    },

    async logout() {
      let logoutError: unknown;
      let cleanupError: unknown;
      try {
        await api.logout();
      } catch (error) {
        logoutError = error;
      }

      setAccessToken(null);
      try {
        await tokenStorage.clear();
      } catch (error) {
        cleanupError = error;
      } finally {
        set({ status: 'unauthenticated', user: null, bootstrapError: null });
      }
      if (logoutError) {
        throw logoutError;
      }
      if (cleanupError) {
        throw cleanupError;
      }
    },

    updateUser(user) {
      if (user?.settings?.theme) {
        void useThemeStore.getState().setTheme(user.settings.theme);
      }
      set({ user });
    },

    async clearSession() {
      setAccessToken(null);
      try {
        await tokenStorage.clear();
      } finally {
        set({ status: 'unauthenticated', user: null, bootstrapError: null });
      }
    },
  };
});

setSessionExpiredHandler(() => {
  void useAuthStore.getState().clearSession().catch((error: unknown) => {
    useAuthStore.setState({
      status: 'error',
      user: null,
      bootstrapError:
        error instanceof Error
          ? error.message
          : 'تعذر مسح بيانات الجلسة المحلية.',
    });
  });
});
