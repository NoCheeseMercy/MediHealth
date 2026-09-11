import { api } from './api';

export interface User {
  id: string;
  email: string;
  fullName: string;
  preferredLanguage: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export const authService = {
  async register(email: string, password: string, fullName: string, preferredLanguage = 'ar'): Promise<AuthResponse> {
    return api.post('/auth/register', { email, password, fullName, preferredLanguage });
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    return api.post('/auth/login', { email, password });
  },

  async logout() {
    await api.logout();
  },

  async forgotPassword(email: string) {
    return api.post('/auth/forgot-password', { email });
  },

  /** Appwrite's recovery sends a *link* containing userId + secret, not a
   *  numeric code — the old `(email, code, password)` signature could never
   *  have completed a reset no matter what the user typed. */
  async resetPassword(userId: string, secret: string, newPassword: string) {
    return api.post('/auth/reset-password', { userId, secret, newPassword });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return api.post('/auth/change-password', { currentPassword, newPassword });
  },

  isLoggedIn() {
    return api.hasToken();
  },
};
