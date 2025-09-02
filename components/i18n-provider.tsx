'use client';

import React from 'react';
import { de, en, type Messages } from '@/lib/i18n/dictionaries';

type Ctx = { t: (k: string) => string; lang: 'en' | 'de' };
export const I18nContext = React.createContext<Ctx>({ t: (k) => k, lang: 'en' });

function pickLang(): 'en' | 'de' {
  try {
    const saved = localStorage.getItem('ui-language');
    if (saved && saved.startsWith('Deutsch')) return 'de';
    if (saved && saved.toLowerCase().startsWith('de')) return 'de';
  } catch {}
  if (typeof navigator !== 'undefined') {
    const l = navigator.language.toLowerCase();
    if (l.startsWith('de')) return 'de';
  }
  return 'en';
}

function dict(lang: 'en' | 'de'): Messages {
  return lang === 'de' ? de : en;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = React.useState<'en' | 'de'>(() => pickLang());
  const [messages, setMessages] = React.useState<Messages>(() => dict(lang));

  React.useEffect(() => {
    const l = pickLang();
    setLang(l);
    setMessages(dict(l));
    const onChange = () => {
      const nl = pickLang();
      setLang(nl);
      setMessages(dict(nl));
    };
    window.addEventListener('storage', onChange);
    return () => window.removeEventListener('storage', onChange);
  }, []);

  const t = React.useCallback((k: string) => messages[k] ?? k, [messages]);

  return (
    <I18nContext.Provider value={{ t, lang }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  return React.useContext(I18nContext);
}
