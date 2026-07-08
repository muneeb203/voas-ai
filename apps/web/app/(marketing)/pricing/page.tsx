import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CallToAction } from '@/components/marketing/cta';
import { PLANS, PAY_AS_YOU_GO } from '@/lib/constants';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, per-location pricing. Talk to sales for chains and franchises.',
};

const FAQ = [
  {
    q: "What channels are included in every plan?",
    a: "All plans include voice (phone calls), WhatsApp, and kiosk — no channel is locked to a higher tier. Plans differ only in the monthly usage limits for each channel and how many locations or kiosk URLs you can run.",
  },
  {
    q: "Are there setup or per-call fees?",
    a: "None. Your monthly plan covers everything up to your included limits. Beyond that you're billed pay-as-you-go — $0.12 per voice minute and $0.12 per kiosk interaction — no surprises.",
  },
  {
    q: "How does payment work?",
    a: "We handle it directly — no checkout flow. Reach out, confirm payment, and your plan and usage credits are live in your dashboard the same day.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes, just message us. We update your plan and credits straight away, and any price difference applies from your next billing date.",
  },
  {
    q: "What about chains or franchises?",
    a: "We put together something custom around your location count, channel volumes, and existing tools. Hit Talk to sales and we will get back to you within a day.",
  },
  {
    q: "How does the free trial work?",
    a: "Sign up and you get 10 free voice minutes immediately — no card needed. Test your agent on real calls, and when you are ready to go fully live, contact us to pick a plan.",
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
            const saveAmount = plan.originalMonthly - plan.priceMonthly;
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
                <div className="mt-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight">
                      ${plan.priceMonthly}
                    </span>
                    <span className="text-sm text-muted-foreground">/ location / month</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground line-through">
                      ${plan.originalMonthly}
                    </span>
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-700">
                      Save ${saveAmount}
                    </span>
                  </div>
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
                  <Link href={`/contact?plan=${plan.id}`}>Get started</Link>
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
                'Custom voice, WhatsApp & kiosk limits',
                'Custom integrations (Toast, Square, etc.)',
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

        <p className="mx-auto mt-10 max-w-2xl text-balance text-center text-sm text-muted-foreground">
          Prefer to pay only for what you use?{' '}
          <span className="font-medium text-foreground">Pay-as-you-go</span> is{' '}
          <span className="font-medium text-foreground">
            ${PAY_AS_YOU_GO.voicePerMinute.toFixed(2)} / voice minute
          </span>{' '}
          and{' '}
          <span className="font-medium text-foreground">
            ${PAY_AS_YOU_GO.kioskPerInteraction.toFixed(2)} / kiosk interaction
          </span>
          . Plans bundle the same rate at a discount.
        </p>
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
