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
      className={cn('inline-flex items-baseline gap-1 transition-opacity hover:opacity-80', className)}
      aria-label="VOAS AI home"
    >
      <span className={cn('text-xl font-semibold tracking-tight', colorClasses)}>VOAS</span>
      <span className={cn('text-sm font-light tracking-wide', subClasses)}>AI</span>
    </Link>
  );
}
