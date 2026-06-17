'use server';

import { cookies } from 'next/headers';
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/request';

export async function setLocaleAction(locale: SupportedLocale): Promise<void> {
  if (!(SUPPORTED_LOCALES as readonly string[]).includes(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set('voas-locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  });
}
