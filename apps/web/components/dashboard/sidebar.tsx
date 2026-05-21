'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  ShoppingBag,
  BookOpen,
  Plug,
  BarChart3,
  Users,
  Settings,
  LifeBuoy,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/shared/logo';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  comingSoon?: boolean;
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/conversations', label: 'Conversations', icon: MessageSquare },
      { href: '/orders', label: 'Orders', icon: ShoppingBag },
    ],
  },
  {
    title: 'Setup',
    items: [
      { href: '/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
      { href: '/integrations', label: 'Integrations', icon: Plug, comingSoon: true },
      { href: '/analytics', label: 'Analytics', icon: BarChart3, comingSoon: true },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { href: '/team', label: 'Team', icon: Users },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/support', label: 'Support', icon: LifeBuoy },
    ],
  },
];

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={cn('flex h-full flex-col border-r border-border bg-background', className)}>
      <div className="flex h-16 items-center px-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2" aria-label="Dashboard">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h3 className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.title}
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
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {item.comingSoon && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                          Soon
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
        VOAS AI · V1 Sprint 3
      </div>
    </aside>
  );
}
