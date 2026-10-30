import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';
import { tokenStorage } from './storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('token storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists refresh tokens with SecureStore', async () => {
    await tokenStorage.setRefreshToken('refresh-token');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'raghad_refresh_token',
      'refresh-token'
    );
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
      'raghad_access_token',
      expect.any(String)
    );
  });

  it('removes refresh and legacy access tokens when clearing', async () => {
    await tokenStorage.clear();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'raghad_refresh_token'
    );
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
      'raghad_access_token'
    );
  });
});
