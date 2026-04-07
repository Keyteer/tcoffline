import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lang_es, type TranslationKeys } from '../config/lang_es';
import { lang_en } from '../config/lang_en';
import * as Localization from 'expo-localization';

export type Language = 'es' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const languages: Record<Language, TranslationKeys> = {
  es: lang_es,
  en: lang_en,
};

const LANGUAGE_STORAGE_KEY = 'app_language';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getDeviceLanguage(): Language {
  try {
    const locales = Localization.getLocales();
    const langCode = locales?.[0]?.languageCode || 'es';
    return langCode in languages ? (langCode as Language) : 'es';
  } catch {
    return 'es';
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((stored) => {
      if (stored && stored in languages) {
        setLanguageState(stored as Language);
      } else {
        setLanguageState(getDeviceLanguage());
      }
    });
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  const value = {
    language,
    setLanguage,
    t: languages[language],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
