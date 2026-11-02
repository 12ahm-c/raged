import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REFRESH_TOKEN_KEY = 'raghad_refresh_token';
const LEGACY_ACCESS_TOKEN_KEY = 'raghad_access_token';
let webRefreshToken: string | null = null;

function isWeb(): boolean {
  return Platform.OS === 'web';
}

function readWebToken(): string | null {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (stored) return stored;
    } catch {
      // ignore storage access errors
    }
  }
  return webRefreshToken;
}

export const tokenStorage = {
  async getRefreshToken(): Promise<string | null> {
    if (isWeb()) {
      const stored = readWebToken();
      if (stored) {
        webRefreshToken = stored;
        return stored;
      }
      return webRefreshToken;
    }

    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    webRefreshToken = token;
    if (isWeb()) {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(REFRESH_TOKEN_KEY, token);
        } catch {
          // ignore storage access errors
        }
      }
      return;
    }

    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  },

  async clear(): Promise<void> {
    webRefreshToken = null;
    if (isWeb()) {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
        } catch {
          // ignore storage access errors
        }
      }
      return;
    }

    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
  },

  async removeLegacyAccessToken(): Promise<void> {
    if (isWeb()) {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
        } catch {
          // ignore storage access errors
        }
      }
      return;
    }

    await SecureStore.deleteItemAsync(LEGACY_ACCESS_TOKEN_KEY);
  },
};