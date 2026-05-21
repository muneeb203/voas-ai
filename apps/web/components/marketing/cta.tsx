import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface CtaProps {
  eyebrow?: string;
  title: string;
  description: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function CallToAction({
  eyebrow,
  title,
  description,
  primaryHref = '/signup',
  primaryLabel = 'Get started',
  secondaryHref = '/contact',
  secondaryLabel = 'Talk to sales',
}: CtaProps) {
  return (
    <section className="bg-brand">
      <div className="container py-20 text-center">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-widest text-accent">{eyebrow}</p>
        )}
        <h2 className="mx-auto mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-balance text-base text-white/70">{description}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="accent" size="lg">
            <Link href={primaryHref}>{primaryLabel}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-white/30 bg-transparent text-white hover:bg-white/10">
            <Link href={secondaryHref}>{secondaryLabel}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
