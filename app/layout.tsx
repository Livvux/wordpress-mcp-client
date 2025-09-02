import { Toaster } from 'sonner';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';

import './globals.css';
import { SessionProvider } from '@/lib/auth-context';
import { NextIntlClientProvider } from 'next-intl';
import { headers } from 'next/headers';

export const metadata: Metadata = {
  metadataBase: new URL('https://wpagent.app'),
  title: 'wpAgent - Control WordPress',
  description: 'AI-powered WordPress management and control interface.',
};

export const viewport = { maximumScale: 1 };

const geist = Geist({ subsets: ['latin'], display: 'swap', variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-geist-mono' });

const LIGHT_THEME_COLOR = 'hsl(0 0% 100%)';
const DARK_THEME_COLOR = 'hsl(240deg 10% 3.92%)';
const THEME_COLOR_SCRIPT = `(function(){
  var html=document.documentElement;
  var meta=document.querySelector('meta[name="theme-color"]');
  if(!meta){meta=document.createElement('meta');meta.setAttribute('name','theme-color');document.head.appendChild(meta);}
  function updateThemeColor(){var isDark=html.classList.contains('dark');meta.setAttribute('content',isDark?'hsl(240deg 10% 3.92%)':'hsl(0 0% 100%)');}
  var observer=new MutationObserver(updateThemeColor);observer.observe(html,{attributes:true,attributeFilter:['class']});updateThemeColor();
})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const h = await headers();
  const headerLocale = h.get('x-next-intl-locale') || h.get('X-NEXT-INTL-LOCALE') || 'en';
  const locale = headerLocale.toLowerCase().startsWith('de') ? 'de' : 'en';
  const messages = (await import(`@/messages/${locale}.json`)).default;

  return (
    <html lang={locale} suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_COLOR_SCRIPT }} />
      </head>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Toaster position="top-center" />
          <SessionProvider>
            <NextIntlClientProvider locale={locale} messages={messages} timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}>
              {children}
            </NextIntlClientProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
