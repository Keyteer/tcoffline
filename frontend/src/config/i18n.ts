import { lang_es } from './lang_es';
import { lang_en } from './lang_en';

const languages = {
  es: lang_es,
  en: lang_en,
};

export type Language = keyof typeof languages;

const LANGUAGE_STORAGE_KEY = 'app_language';

export function getCurrentLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language;
  if (stored && stored in languages) {
    return stored;
  }
  const browserLang = navigator.language.split('-')[0];
  return (browserLang in languages ? browserLang : 'es') as Language;
}

export function setLanguage(lang: Language): void {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  window.location.reload();
}

export function getTranslations() {
  const currentLang = getCurrentLanguage();
  return languages[currentLang];
}

export { lang_es, lang_en };
