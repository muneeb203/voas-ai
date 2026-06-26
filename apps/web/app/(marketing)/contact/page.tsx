import type { Metadata } from 'next';
import { Mail, MessageCircle, MapPin } from 'lucide-react';
import { ContactForm } from '@/components/marketing/contact-form';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Talk to the VOAS AI team about your business.',
};

const INFO = [
  {
    icon: Mail,
    title: 'Email',
    body: 'info@convosol.com',
  },
  {
    icon: MessageCircle,
    title: 'Sales',
    body: 'For chains and franchises — pick "Enterprise" in the form and we’ll route you to a sales rep.',
  },
  {
    icon: MapPin,
    title: 'Where we are',
    body: 'Built in Islamabad, with operators across the Globe.',
  },
] as const;

interface ContactPageProps {
  searchParams: { plan?: string };
}

export default function ContactPage({ searchParams }: ContactPageProps) {
  return (
    <section className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-accent-700">Contact</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Talk to us.
        </h1>
        <p className="mt-4 text-balance text-lg text-muted-foreground">
          Tell us about your business and what you’re trying to solve. We’ll be in touch within
          one business day.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-5xl gap-12 lg:grid-cols-3">
        <div className="space-y-6">
          {INFO.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider">{item.title}</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm lg:col-span-2 lg:p-8">
          <ContactForm defaultPlan={searchParams.plan} />
        </div>
      </div>
    </section>
  );
}
