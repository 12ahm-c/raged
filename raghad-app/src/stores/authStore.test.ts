import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { api, setAccessToken } from '../api/client';
import { tokenStorage } from '../api/storage';
import { useAuthStore } from './authStore';
import type { UserDTO } from '../types/dto';

jest.mock('../api/client', () => ({
  ApiClientError: class ApiClientError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  api: {
    login: jest.fn(),
    me: jest.fn(),
    logout: jest.fn(),
    restoreSession: jest.fn(),
  },
  setAccessToken: jest.fn(),
  setSessionExpiredHandler: jest.fn(),
}));

jest.mock('../api/storage', () => ({
  tokenStorage: {
    getRefreshToken: jest.fn(),
    setRefreshToken: jest.fn(),
    clear: jest.fn(),
    removeLegacyAccessToken: jest.fn(),
  },
}));

const userFixture: UserDTO = {
  _id: 'user-id',
  name: 'Raghad',
  email: 'raghad@example.com',
  role: 'owner',
  timezone: 'Africa/Nouakchott',
  settings: {
    theme: 'light',
    language: 'ar',
    notificationsEnabled: true,
    reminderLeadMinutes: 5,
  },
  createdAt: '2026-10-24T12:00:00.000Z',
  lastActiveAt: '2026-10-24T12:00:00.000Z',
};

describe('auth store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
      bootstrapError: null,
    });
  });

  it('hydrates the user and keeps the access token in memory after login', async () => {
    jest.mocked(api.login).mockResolvedValue({
      user: userFixture,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: '2026-10-24T13:00:00.000Z',
      refreshTokenExpiresAt: '2026-10-31T13:00:00.000Z',
    });
    jest.mocked(api.me).mockResolvedValue(userFixture);

    await useAuthStore.getState().login('raghad@example.com', 'password123');

    expect(setAccessToken).toHaveBeenCalledWith('access-token');
    expect(tokenStorage.setRefreshToken).toHaveBeenCalledWith('refresh-token');
    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      user: userFixture,
    });
  });

  it('clears local auth state when logout fails on the server', async () => {
    useAuthStore.setState({
      status: 'authenticated',
      user: userFixture,
      bootstrapError: null,
    });
    jest.mocked(api.logout).mockRejectedValue(new Error('server unavailable'));

    await expect(useAuthStore.getState().logout()).rejects.toThrow(
      'server unavailable'
    );

    expect(setAccessToken).toHaveBeenCalledWith(null);
    expect(tokenStorage.clear).toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({
      status: 'unauthenticated',
      user: null,
    });
  });
});
