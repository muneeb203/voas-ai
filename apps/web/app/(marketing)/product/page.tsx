import type { Metadata } from 'next';
import { Phone, MessageSquare, LayoutDashboard, Plug2 } from 'lucide-react';
import { CallToAction } from '@/components/marketing/cta';

export const metadata: Metadata = {
  title: 'Product',
  description: 'Voice, WhatsApp, web chat, and a dashboard that pulls it all together.',
};

const SECTIONS = [
  {
    icon: Phone,
    eyebrow: 'Voice',
    title: 'A receptionist on every line.',
    body: 'Inbound calls answered instantly with sub-second latency. Handles natural interruptions, accents, background noise. Books, takes orders, answers questions — and hands off to a human when it should.',
    bullets: [
      'Sub-second response latency',
      'Interruption-tolerant turn taking',
      'Workspace-specific menu / FAQ training',
      'Audio recordings + transcripts in your dashboard',
    ],
  },
  {
    icon: MessageSquare,
    eyebrow: 'WhatsApp & SMS',
    title: 'Conversations that pick up where they left off.',
    body: 'Same brain as voice. Customers can switch between channels mid-conversation and VOAS remembers context. Outbound messaging for confirmations, status updates, and recovery flows — all from approved templates.',
    bullets: [
      'Inbound + outbound on one number',
      'Rich messages: lists, buttons, images',
      'Identity stitching across phone numbers',
      '24-hour session window enforced',
    ],
  },
  {
    icon: LayoutDashboard,
    eyebrow: 'Dashboard',
    title: 'See what your business is actually saying.',
    body: 'Every conversation transcribed, tagged, and summarized. Sentiment trends, top intents, items asked for but not on your menu. The kind of data that used to require a research team.',
    bullets: [
      'Full conversation transcripts and recordings',
      'Sentiment + outcome per call',
      'Top intents and missed-call recovery report',
      'Customer profiles linked across channels',
    ],
  },
  {
    icon: Plug2,
    eyebrow: 'Integrations',
    title: 'Plugs into the tools you already run.',
    body: 'Orders land in Toast or Square. Bookings land in your calendar. Payments through Stripe. Refunds and status sync both ways. No spreadsheets to babysit.',
    bullets: [
      'Toast, Square (Clover next)',
      'Google Calendar, Calendly',
      'Stripe billing',
      'Twilio / Meta for messaging',
    ],
  },
] as const;

export default function ProductPage() {
  return (
    <>
      <section className="border-b border-border/60 bg-secondary/30">
        <div className="container py-20 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-accent-700">
            The product
          </p>
          <h1 className="mx-auto mt-3 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            One AI brain across every channel your customers use.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
            Voice, WhatsApp, web chat, and the integrations that turn conversations into orders
            and appointments — without ripping out a thing you already use.
          </p>
        </div>
      </section>

      {SECTIONS.map((section, i) => {
        const Icon = section.icon;
        return (
          <section
            key={section.title}
            className={i % 2 === 0 ? 'bg-background' : 'bg-secondary/30'}
          >
            <div className="container grid items-center gap-12 py-20 lg:grid-cols-2">
              <div className={i % 2 === 0 ? 'lg:order-1' : 'lg:order-2'}>
                <p className="text-xs font-medium uppercase tracking-widest text-accent-700">
                  {section.eyebrow}
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {section.title}
                </h2>
                <p className="mt-4 text-muted-foreground">{section.body}</p>
                <ul className="mt-6 space-y-2">
                  {section.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className={
                  i % 2 === 0
                    ? 'lg:order-2 flex justify-center'
                    : 'lg:order-1 flex justify-center'
                }
              >
                <div className="flex h-64 w-full max-w-md items-center justify-center rounded-xl border border-border bg-card shadow-sm">
                  <Icon className="h-16 w-16 text-accent" />
                </div>
              </div>
            </div>
          </section>
        );
      })}

      <CallToAction
        title="One conversation, every channel."
        description="See it on your business in under an hour."
      />
    </>
  );
}
