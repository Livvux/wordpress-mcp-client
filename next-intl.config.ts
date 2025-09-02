import defineRouting from 'next-intl/routing';

export default defineRouting({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  // We do not use locale-prefixed routes; app routes stay as-is
  localePrefix: 'never',
});
