'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  MessageSquare,
  ShoppingBag,
  Users2,
  BookOpen,
  Plug,
  BarChart3,
  MapPin,
  Users,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/shared/logo';

interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    titleKey: 'overview',
    items: [
      { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
      { href: '/conversations', labelKey: 'conversations', icon: MessageSquare },
      { href: '/orders', labelKey: 'orders', icon: ShoppingBag },
      { href: '/customers', labelKey: 'customers', icon: Users2 },
    ],
  },
  {
    titleKey: 'setup',
    items: [
      { href: '/knowledge-base', labelKey: 'knowledgeBase', icon: BookOpen },
      { href: '/integrations', labelKey: 'integrations', icon: Plug, comingSoon: true },
      { href: '/analytics', labelKey: 'analytics', icon: BarChart3, comingSoon: true },
    ],
  },
  {
    titleKey: 'workspace',
    items: [
      { href: '/locations', labelKey: 'locations', icon: MapPin },
      { href: '/team', labelKey: 'team', icon: Users },
      { href: '/settings', labelKey: 'settings', icon: Settings },
      { href: '/support', labelKey: 'support', icon: LifeBuoy },
    ],
  },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tc = useTranslations('common');

  return (
    <aside className={cn('flex h-full flex-col border-r border-border bg-background', className)}>
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2" aria-label="Dashboard">
        {SECTIONS.map((section) => (
          <div key={section.titleKey}>
            <h3 className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t(`sections.${section.titleKey}`)}
            </h3>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{t(`items.${item.labelKey}`)}</span>
                      {item.comingSoon && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                          {tc('comingSoon')}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-4 text-xs text-muted-foreground">
        {t('footer')}
      </div>
    </aside>
  );
}
