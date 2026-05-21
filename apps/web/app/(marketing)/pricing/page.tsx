import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CallToAction } from '@/components/marketing/cta';
import { PLANS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, per-location pricing. Talk to sales for chains and franchises.',
};

const FAQ = [
  {
    q: 'Are there setup or per-call fees?',
    a: 'No setup fees. Voice minutes and outbound messages over your monthly cap are charged at cost — you can see the meter in real time in the dashboard.',
  },
  {
    q: 'Can I change plans later?',
    a: 'Yes. Upgrade or downgrade any time from your dashboard. Billing prorates automatically.',
  },
  {
    q: 'What about chains or franchises?',
    a: 'For 10+ locations, we tailor a plan around your locations, channels, and integration needs. Talk to sales.',
  },
  {
    q: 'How does the free trial work?',
    a: 'Create an account and you get a sandbox environment to test your agent. When you’re ready to go live on a real phone number, you pick a plan.',
  },
] as const;

export default function PricingPage() {
  return (
    <>
      <section className="border-b border-border/60 bg-secondary/30">
        <div className="container py-20 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-accent-700">Pricing</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            One price per location. No hidden fees.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
            Per-location pricing that scales with your business. Most operators recoup the monthly
            fee from the calls they used to miss.
          </p>
        </div>
      </section>

      <section className="container py-20">
        <div className="grid gap-6 lg:grid-cols-4">
          {PLANS.map((plan, idx) => {
            const isPopular = idx === 1;
            return (
              <div
                key={plan.id}
                className={cn(
                  'flex flex-col rounded-lg border bg-card p-6 shadow-sm',
                  isPopular ? 'border-accent shadow-md' : 'border-border',
                )}
              >
                {isPopular && (
                  <span className="self-start rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-700">
                    Most popular
                  </span>
                )}
                <h2 className="mt-2 text-xl font-semibold">{plan.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">${plan.priceMonthly}</span>
                  <span className="text-sm text-muted-foreground">/ location / month</span>
                </div>

                <ul className="mt-6 space-y-3 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  variant={isPopular ? 'default' : 'outline'}
                  size="lg"
                  className="mt-8"
                >
                  <Link href={`/signup?plan=${plan.id}`}>Start with {plan.name}</Link>
                </Button>
              </div>
            );
          })}

          <div className="flex flex-col rounded-lg border border-border bg-brand p-6 text-white shadow-sm">
            <span className="self-start rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/80">
              Enterprise
            </span>
            <h2 className="mt-2 text-xl font-semibold">Chains & franchises</h2>
            <p className="mt-1 text-sm text-white/70">
              For 10+ locations, custom integrations, or regional rollouts.
            </p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight">Custom</span>
            </div>

            <ul className="mt-6 space-y-3 text-sm text-white/80">
              {[
                'Unlimited locations',
                'Custom integrations',
                'Dedicated account team',
                'SLA and security review',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Button asChild variant="accent" size="lg" className="mt-8">
              <Link href="/contact?plan=enterprise">Talk to sales</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-secondary/30">
        <div className="container py-20">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-center text-3xl font-semibold tracking-tight">
              Pricing questions
            </h2>
            <div className="mt-10 divide-y divide-border rounded-lg border border-border bg-card">
              {FAQ.map((item) => (
                <div key={item.q} className="p-6">
                  <h3 className="text-base font-semibold">{item.q}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CallToAction
        title="See it on your business."
        description="No credit card. Live on a real phone number in under an hour."
      />
    </>
  );
}
