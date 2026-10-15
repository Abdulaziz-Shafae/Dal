import React, { createContext, useContext, useMemo } from 'react';
import { languageDirection, normalizeLanguage, translate } from './i18n.js';

const LanguageContext = createContext({ lang: 'ar', direction: 'rtl', tr: (key, ...values) => translate(key, 'ar', ...values) });
export function LanguageProvider({ lang, children }) {
  const value = useMemo(() => {
    const language = normalizeLanguage(lang);
    return { lang: language, direction: languageDirection(language), tr: (key, ...values) => translate(key, language, ...values) };
  }, [lang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
