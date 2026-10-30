import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REFRESH_TOKEN_KEY = 'raghad_refresh_token';
const LEGACY_ACCESS_TOKEN_KEY = 'raghad_access_token';
let webRefreshToken: string | null = null;

export const tokenStorage = {
  async getRefreshToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return webRefreshToken;
    }

    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      webRefreshToken = token;
      return;
    }

    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  async clear(): Promise<void> {
    webRefreshToken = null;
    if (Platform.OS !== 'web') {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
      return;
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    }
  },

  async removeLegacyAccessToken(): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
      }
      return;
    }

    await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
  },
};
