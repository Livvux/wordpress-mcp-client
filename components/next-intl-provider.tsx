'use client';
import { useEffect, useMemo, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/messages/en.json';
import de from '@/messages/de.json';

function pick(): 'en' | 'de' {
  try {
    const saved = localStorage.getItem('ui-language');
    if (saved && saved.toLowerCase().startsWith('de')) return 'de';
  } catch {}
  return 'en';
}


export default function IntlClientProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<'en'|'de'>(() => pick());
  const messages = useMemo(() => (locale === 'de' ? de : en), [locale]);

  useEffect(() => {
    const l = pick();
    setLocale(l);
    const onStorage = () => setLocale(pick());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
