import Link from 'next/link';
import { Logo } from '@/components/shared/logo';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/product', label: 'Overview' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/contact?plan=enterprise', label: 'For chains & franchises' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/login', label: 'Sign in' },
      { href: '/signup', label: 'Create account' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/terms', label: 'Terms' },
      { href: '/legal/privacy', label: 'Privacy' },
    ],
  },
] as const;

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-brand text-white/80">
      <div className="container grid gap-10 py-14 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <Logo variant="light" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            One AI brain that answers every call, message, and chat — so businesses never miss
            a customer again.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-4">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/70 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container flex flex-col items-start justify-between gap-3 py-6 text-xs text-white/50 sm:flex-row sm:items-center">
          <p>© {year} VOAS AI. All rights reserved.</p>
          <p>Built in Islamabad, serving the world.</p>
        </div>
      </div>
    </footer>
  );
}
