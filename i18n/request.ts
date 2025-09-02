import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => {
  const l = typeof locale === 'string' && locale.toLowerCase().startsWith('de') ? 'de' : 'en';
  const messages = (await import(`../messages/${l}.json`)).default;
  return { locale: l, messages };
});
