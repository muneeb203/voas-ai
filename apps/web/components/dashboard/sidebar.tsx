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
  MonitorSmartphone,
  Users,
  Settings,
  LifeBuoy,
  Compass,
  CalendarDays,
  Scissors,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/shared/logo';
import { START_TOUR_EVENT } from '@/components/dashboard/product-tour';

interface NavItem {
  href: string;
  labelKey: string;
  label?: string; // literal label (overrides translation) — used for vertical-specific items
  icon: LucideIcon;
  comingSoon?: boolean;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

// Nav is vertical-aware: a salon sees Appointments / Services / Staff where a
// restaurant sees Orders / Knowledge Base.
function buildSections(vertical: string): NavSection[] {
  const isSalon = vertical === 'salon';
  const overview: NavItem[] = [
    { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
    { href: '/conversations', labelKey: 'conversations', icon: MessageSquare },
    isSalon
      ? { href: '/appointments', labelKey: 'appointments', label: 'Appointments', icon: CalendarDays }
      : { href: '/orders', labelKey: 'orders', icon: ShoppingBag },
    { href: '/customers', labelKey: 'customers', icon: Users2 },
  ];
  const setup: NavItem[] = [
    isSalon
      ? { href: '/services', labelKey: 'services', label: 'Services', icon: Scissors }
      : { href: '/knowledge-base', labelKey: 'knowledgeBase', icon: BookOpen },
    { href: '/integrations', labelKey: 'integrations', icon: Plug },
    { href: '/analytics', labelKey: 'analytics', icon: BarChart3 },
  ];
  const workspace: NavItem[] = [
    { href: '/locations', labelKey: 'locations', icon: MapPin },
    ...(isSalon
      ? [{ href: '/staff', labelKey: 'staff', label: 'Staff', icon: UserCog }]
      : []),
    { href: '/self-order', labelKey: 'selfOrder', icon: MonitorSmartphone },
    { href: '/team', labelKey: 'team', icon: Users },
    { href: '/settings', labelKey: 'settings', icon: Settings },
    { href: '/support', labelKey: 'support', icon: LifeBuoy },
  ];
  return [
    { titleKey: 'overview', items: overview },
    { titleKey: 'setup', items: setup },
    { titleKey: 'workspace', items: workspace },
  ];
}

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
  vertical?: string;
}

export function Sidebar({ className, onNavigate, vertical = 'restaurant' }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const SECTIONS = buildSections(vertical);

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
                      data-tour={item.labelKey}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-secondary text-foreground'
                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label ?? t(`items.${item.labelKey}`)}</span>
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

      <div className="space-y-2 border-t border-border p-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(START_TOUR_EVENT))}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <Compass className="h-4 w-4 shrink-0" />
          <span>Take a tour</span>
        </button>
        <p className="px-3 text-xs text-muted-foreground">{t('footer')}</p>
      </div>
    </aside>
  );
}
