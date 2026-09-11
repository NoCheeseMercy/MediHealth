import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { authService, type User } from '../services/auth';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, lang?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const clearSession = useCallback(async () => {
    setUser(null);
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('appwrite_user');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    (async () => {
      await api.init();
      const storedUser = await AsyncStorage.getItem('user');
      const hasSession = await AsyncStorage.getItem('appwrite_user');
      if (hasSession && storedUser) {
        setUser(JSON.parse(storedUser));
      }
      setIsLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authService.login(email, password);
    setUser(data.user);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
  };

  const register = async (email: string, password: string, fullName: string, lang = 'ar') => {
    const data = await authService.register(email, password, fullName, lang);
    setUser(data.user);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
  };

  const logout = async () => {
    await authService.logout();
    await clearSession();
  };

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
    } catch {
      await clearSession();
    }
  }, [clearSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
