import React, { createContext, useContext, useState } from 'react';
import { Language, translate, TranslationKey } from '../i18n';
import { hiTranslations } from '../i18n/hi';

// App-facing language union: 'hi' (Hinglish) is layered on top of the core
// en/bn dictionaries. Hinglish strings live in src/i18n/hi.ts; any key missing
// there falls back to English — exactly how Hinglish is spoken in practice.
export type AppLanguage = Language | 'hi';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const translateHi = (key: TranslationKey, params?: Record<string, string | number>): string => {
  const hiText = hiTranslations[key];
  if (!hiText) return translate(key, 'en', params);
  let text = hiText;
  if (params) {
    Object.entries(params).forEach(([paramKey, paramVal]) => {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
    });
  }
  return text;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    try {
      const saved = localStorage.getItem('attendease.language');
      if (saved === 'bn' || saved === 'en' || saved === 'hi') return saved;
    } catch {}
    return 'en';
  });

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('attendease.language', lang);
    } catch {}
  };

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    if (language === 'hi') return translateHi(key, params);
    return translate(key, language, params);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      language: 'en',
      setLanguage: () => {},
      t: (key: TranslationKey, params?: Record<string, string | number>) => translate(key, 'en', params),
    };
  }
  return ctx;
}
