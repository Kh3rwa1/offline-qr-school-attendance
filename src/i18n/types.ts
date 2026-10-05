import type { enTranslations } from './en';

export type Language = 'en' | 'bn' | 'hi';
export type TranslationKey = keyof typeof enTranslations;
