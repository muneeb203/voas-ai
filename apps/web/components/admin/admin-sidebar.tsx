'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Users,
  LifeBuoy,
  ScrollText,
  Mail,
  Settings,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { href: '/admin/workspaces', label: 'Workspaces', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/support', label: 'Support inbox', icon: LifeBuoy },
  { href: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
  { href: '/admin/contact-submissions', label: 'Contact forms', icon: Mail },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside className={cn('flex h-full flex-col border-r border-slate-700 bg-slate-900 text-slate-100', className)}>
      <div className="flex h-16 items-center gap-2 px-5">
        <ShieldAlert className="h-4 w-4 text-error" />
        <span className="text-sm font-semibold tracking-tight">VOAS Admin</span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2" aria-label="Admin">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-error/15 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-700 p-4 text-xs text-slate-500">
        Every action is logged.
      </div>
    </aside>
  );
}
