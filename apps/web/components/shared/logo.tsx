import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  href?: string;
  className?: string;
  variant?: 'default' | 'light';
}

/**
 * Text-only wordmark for now. When the brand asset is ready, drop
 * the SVG/PNG into apps/web/public/ and replace the span block with
 * an <Image>. Everything that imports Logo (nav, footer, auth pages)
 * picks it up automatically.
 */
export function Logo({ href = '/', className, variant = 'default' }: LogoProps) {
  const colorClasses =
    variant === 'light'
      ? 'text-white'
      : 'text-brand';
  const subClasses =
    variant === 'light' ? 'text-white/70' : 'text-muted-foreground';

  return (
    <Link
      href={href}
      className={cn('inline-flex items-center gap-1.5 transition-opacity hover:opacity-80', className)}
      aria-label="VOAS AI home"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-6 w-6 flex-shrink-0 text-[#00C2A8]"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="7" cy="12" r="2.2" fill="currentColor" />
        <path
          d="M10.15 7.5 A5.5 5.5 0 0 1 10.15 16.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M12.16 4.63 A9 9 0 0 1 12.16 19.37"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <span className="inline-flex items-baseline gap-1">
        <span className={cn('text-xl font-semibold tracking-tight', colorClasses)}>VOAS</span>
        <span className={cn('text-sm font-light tracking-wide', subClasses)}>AI</span>
      </span>
    </Link>
  );
}
