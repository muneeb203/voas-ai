import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const SUPPORTED_LOCALES = ['en', 'ar', 'ur'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isRtl(locale: string): boolean {
  return locale === 'ar' || locale === 'ur';
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get('voas-locale')?.value ?? 'en';
  const locale = (SUPPORTED_LOCALES as readonly string[]).includes(raw) ? raw : 'en';

  const messages = (await import(`../messages/${locale}.json`)).default as Record<string, unknown>;

  return {
    locale,
    messages,
    // Fall back to key path instead of throwing when a translation is missing.
    onError() {},
    getMessageFallback({ key }: { namespace?: string; key: string; error: Error }) {
      return key;
    },
  };
});
