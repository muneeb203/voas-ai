import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SITE } from '@/lib/constants';
import { Toaster } from '@/components/ui/toaster';
import { SUPPORTED_LOCALES, isRtl } from '@/i18n/request';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  metadataBase: new URL(SITE.url),
  openGraph: {
    title: SITE.name,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.name,
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE.name,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const raw = cookieStore.get('voas-locale')?.value ?? 'en';
  const locale = (SUPPORTED_LOCALES as readonly string[]).includes(raw) ? raw : 'en';
  const dir = isRtl(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
