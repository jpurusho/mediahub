/**
 * Tests for GoogleAuthService
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleAuthService } from '../../desktop/services/google-auth';
import * as database from '../../desktop/services/database';

// Mock database functions
vi.mock('../../desktop/services/database', () => ({
  saveTokens: vi.fn(),
  getTokens: vi.fn(),
  clearTokens: vi.fn(),
  saveUserInfo: vi.fn(),
  getUserInfo: vi.fn(),
  clearUserInfo: vi.fn(),
  getSetting: vi.fn((key: string) => {
    if (key === 'google_client_id') return null;
    if (key === 'google_client_secret') return null;
    return null;
  }),
  setSetting: vi.fn(),
  initDatabase: vi.fn(),
}));

// Mock Google OAuth
vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: class MockOAuth2Client {
      setCredentials = vi.fn();
      getAccessToken = vi.fn().mockResolvedValue({ token: 'mock-token' });
      generateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/auth');
      on = vi.fn();
      once = vi.fn();
      emit = vi.fn();
      removeListener = vi.fn();
    },
  };
});

// Mock googleapis
vi.mock('googleapis', () => ({
  google: {
    youtube: vi.fn(),
    oauth2: vi.fn().mockReturnValue({
      userinfo: {
        get: vi.fn().mockResolvedValue({
          data: {
            email: 'test@example.com',
            name: 'Test User',
            picture: 'https://example.com/avatar.jpg',
          },
        }),
      },
    }),
  },
}));

describe('GoogleAuthService', () => {
  let authService: GoogleAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new GoogleAuthService();
  });

  describe('isLoggedIn', () => {
    it('should return true when tokens exist', () => {
      vi.mocked(database.getTokens).mockReturnValue({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000,
        scope: 'youtube',
      });

      expect(authService.isLoggedIn()).toBe(true);
    });

    it('should return false when tokens do not exist', () => {
      vi.mocked(database.getTokens).mockReturnValue(null);

      expect(authService.isLoggedIn()).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('should return user info when it exists in database', async () => {
      const mockUser = {
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      };
      vi.mocked(database.getTokens).mockReturnValue({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000,
        scope: 'youtube',
      });
      vi.mocked(database.getUserInfo).mockReturnValue(mockUser);

      const user = await authService.getCurrentUser();

      expect(user).toEqual(mockUser);
    });

    it('should return null when no tokens exist', async () => {
      vi.mocked(database.getTokens).mockReturnValue(null);

      const user = await authService.getCurrentUser();

      expect(user).toBeNull();
    });
  });

  describe('logout', () => {
    it('should clear tokens and user info', async () => {
      await authService.logout();

      expect(database.clearTokens).toHaveBeenCalled();
      expect(database.clearUserInfo).toHaveBeenCalled();
    });
  });

  describe('getOAuth2Client', () => {
    it('should return OAuth2Client instance', () => {
      const client = authService.getOAuth2Client();

      expect(client).toBeDefined();
      expect(client).toHaveProperty('setCredentials');
    });
  });
});
