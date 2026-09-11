import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, type TranslationKey } from '../constants/i18n/translations';
import { useAuth } from './AuthContext';
import { api } from '../services/api';

type Language = 'ar' | 'en';

interface LanguageContextType {
  language: Language;
  isRTL: boolean;
  t: (key: TranslationKey) => string;
  setLanguage: (lang: Language) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth();
  const [language, setLang] = useState<Language>('ar');

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('language');
      const lang = (user?.preferredLanguage as Language) || (stored as Language) || 'ar';
      setLang(lang);
    })();
  }, [user?.preferredLanguage]);

  const setLanguage = useCallback(
    async (lang: Language) => {
      setLang(lang);
      await AsyncStorage.setItem('language', lang);
      if (user) {
        try {
          const data = await api.patch('/profile', { preferredLanguage: lang });
          setUser(data.user);
        } catch {
          // keep the local preference even if profile sync fails
        }
      }
    },
    [user, setUser]
  );

  const t = useCallback(
    (key: TranslationKey) => translations[language][key] || translations.en[key] || key,
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, isRTL: language === 'ar', t, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};
