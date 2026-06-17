'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setLocaleAction } from '@/app/actions/locale-action';
import type { SupportedLocale } from '@/i18n/request';

const LOCALES: { id: SupportedLocale; native: string; flag: string }[] = [
  { id: 'en', native: 'English', flag: '🇬🇧' },
  { id: 'ar', native: 'العربية', flag: '🇸🇦' },
  { id: 'ur', native: 'اردو', flag: '🇵🇰' },
];

export function LanguageSwitcher() {
  const t = useTranslations('languageSwitcher');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const current = LOCALES.find((l) => l.id === locale) ?? LOCALES[0]!;

  function handleSelect(next: SupportedLocale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          disabled={isPending}
          aria-label={t('label')}
          title={t('label')}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{current.flag} {current.native}</span>
          <span className="sm:hidden">{current.flag}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l.id}
            onClick={() => handleSelect(l.id)}
            className="flex items-center gap-2"
            data-active={l.id === locale}
          >
            <span>{l.flag}</span>
            <span className={l.id === locale ? 'font-semibold' : ''}>{l.native}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
