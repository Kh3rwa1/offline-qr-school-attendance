// i18n orchestrator. Language dictionaries live in their own files:
//   en.ts — English (complete), bn.ts — Bengalish (complete), hi.ts — Hinglish (core keys).
// Hinglish intentionally falls back to English for untranslated keys — that IS
// how Hinglish works: Hindi sentences with familiar English product terms.
import { enTranslations } from './en';
import { bnTranslations } from './bn';
import { hiTranslations } from './hi';

export type Language = 'en' | 'bn' | 'hi';

export const translations = {
  en: enTranslations,
  bn: bnTranslations,
  hi: hiTranslations,
};

export type TranslationKey = keyof typeof translations.en;

export function translate(key: TranslationKey, lang: Language = 'en', params?: Record<string, string | number>): string {
  const dict = translations[lang] || translations.en;
  let text = (dict as any)[key] || translations.en[key] || key;
  if (params && typeof text === 'string') {
    Object.entries(params).forEach(([paramKey, paramVal]) => {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
    });
  }
  return text;
}

export function getTranslation(lang: Language, key: TranslationKey, params?: Record<string, string | number>): string {
  return translate(key, lang, params);
}
