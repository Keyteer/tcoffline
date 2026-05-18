import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { lang_es, type TranslationKeys } from '../config/lang_es';
import { lang_en } from '../config/lang_en';

export type Language = 'es' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const languages = {
  es: lang_es,
  en: lang_en,
};

const LANGUAGE_STORAGE_KEY = 'app_language';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
  if (stored && stored in languages) {
    return stored;
  }
  const browserLang = navigator.language.split('-')[0];
  return (browserLang in languages ? browserLang : 'es') as Language;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

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
