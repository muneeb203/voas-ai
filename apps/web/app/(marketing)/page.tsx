import Link from 'next/link';
import {
  MessageSquare, BarChart3, Plug, Sparkles,
  ShieldCheck, TrendingDown, TrendingUp, Layers,
  Zap, PhoneCall, Brain, ClipboardCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CallToAction } from '@/components/marketing/cta';
import { DemoVideoSection } from '@/components/marketing/demo-video-section';

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: PhoneCall,
    title: 'Customer Connects',
    body: 'A customer calls, texts, or messages on WhatsApp. VOAS picks up instantly — no hold music, no busy tones.',
  },
  {
    step: '02',
    icon: Brain,
    title: 'AI Processes Intent',
    body: 'Using proprietary LLMs, VOAS understands accents, inflections, and preferences across 50+ languages.',
  },
  {
    step: '03',
    icon: ClipboardCheck,
    title: 'Automatic Fulfillment',
    body: 'Orders go directly to your POS, messenger, or calendar, and notes enter your CRM.',
  },
] as const;

const FEATURES = [
  {
    icon: Zap,
    title: 'Zero Latency Conversations',
    headline: 'A receptionist on every line.',
    body: 'Inbound calls answered instantly with sub-second latency. Handles accents, background noise, and natural interruptions. Books, takes orders, answers questions — and hands off to a human when it should.',
    bullets: ['Sub-second response time', 'Interruption-tolerant conversation', 'Menu & FAQ trained to your business', 'Full recordings + transcripts in dashboard'],
  },
  {
    icon: MessageSquare,
    title: 'WhatsApp, SMS, Web Chat',
    headline: 'Conversations that pick up where they left off.',
    body: 'Maintain continuity as customers switch from phone to SMS without repeating themselves. Outbound confirmations, status updates, and win-back flows — all from approved templates.',
    bullets: ['Inbound + outbound on one number', 'Rich messages: lists, buttons, images', 'Context stitched across phone + chat', '24-hour session window enforced'],
  },
  {
    icon: BarChart3,
    title: 'Dashboard',
    headline: 'See what your business is actually saying.',
    body: 'Every conversation transcribed, tagged, and summarized. Sentiment trends, top intents, items asked for but not on your menu — the kind of insight that used to need a research team.',
    bullets: ['Full transcripts and call recordings', 'Sentiment and outcome per conversation', 'Top intents and missed-order report', 'Customer profiles linked across channels'],
  },
  {
    icon: Plug,
    title: 'Integrations',
    headline: 'Plugs into the tools you already run.',
    body: 'Orders land in Toast or Square. Bookings in your calendar. Payments through Stripe. No spreadsheets to babysit — VOAS writes back to the systems you already trust.',
    bullets: ['Toast, Square (Clover coming soon)', 'Google Calendar, Calendly', 'Stripe billing and refunds', 'Twilio / Meta for messaging'],
  },
] as const;

const VALUE_PROPS = [
  {
    icon: Sparkles,
    title: 'VOAS Updates',
    body: 'Upload your knowledge base and go live in under 15 minutes.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise-Grade Security',
    body: 'Enterprise-grade security and data privacy by default.',
  },
  {
    icon: TrendingDown,
    title: 'Cost Reduction',
    body: 'Save up to 65% on front-desk staffing costs while increasing call capacity.',
  },
  {
    icon: TrendingUp,
    title: 'Revenue Growth',
    body: 'Never miss a lead or a call during the Saturday night rush.',
  },
  {
    icon: Layers,
    title: 'Infinite Scaling',
    body: 'Handle 1,000 concurrent calls with the same consistent quality.',
  },
] as const;

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section id="hero" className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-secondary/40 via-background to-background" />
        <div className="container py-16 sm:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_480px] lg:gap-16">
            {/* Left: copy */}
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-700">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Now in pilot with restaurants
              </span>

              <h1 className="mx-auto mt-6 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:mx-0 lg:text-6xl">
                A conversational front desk that never sleeps.
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-balance text-lg text-muted-foreground sm:text-xl lg:mx-0">
                VOAS AI answers every phone call, WhatsApp message, and web chat — takes the order,
                books the appointment, handles the complaint, and follows up. One brain. Every channel.
              </p>

              <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Button asChild size="lg">
                  <Link href="/signup">Start free</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/contact">Talk to sales</Link>
                </Button>
              </div>

              <p className="mt-6 text-xs text-muted-foreground">
                No credit card required. 10 free voice minutes included.
              </p>
            </div>

            {/* Right: looping demo preview */}
            <div className="mx-auto w-full max-w-lg lg:mx-0">
              <DemoVideoSection preview />
              <p className="mt-3 text-center text-xs text-muted-foreground lg:text-left">
                Watch the full demo below — switch between English, Arabic &amp; Urdu
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo video */}
      <section id="demo">
        <DemoVideoSection />
      </section>

      {/* How it works */}
      <section id="how-it-works" className="container py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-accent-700">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            From phone call to fulfilled order — without lifting a finger.
          </h2>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {HOW_IT_WORKS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <span className="font-mono text-xs font-semibold text-accent-700">{s.step}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Product features */}
      <section id="features" className="border-y border-border/60 bg-secondary/30">
        <div className="container py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-accent-700">
              Product
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              One AI brain across every channel.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Voice, WhatsApp, web chat, and the integrations that turn conversations into orders
              and appointments — without ripping out anything you already use.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-lg border border-border bg-background p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10">
                      <Icon className="h-5 w-5 text-accent" />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-widest text-accent-700">
                      {f.title}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{f.headline}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                  <ul className="mt-4 space-y-1.5">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="h-1 w-1 flex-shrink-0 rounded-full bg-accent" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why VOAS */}
      <section id="why" className="container py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-accent-700">
            Why VOAS
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            An AI that actually pays attention.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Most voice AI is an FAQ pattern-matcher with a voice on top. VOAS is built around one
            constraint: sound like someone who is genuinely listening.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {VALUE_PROPS.slice(0, 3).map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <Icon className="h-6 w-6 text-accent" />
                <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid gap-6 md:mx-auto md:max-w-2xl md:grid-cols-2">
          {VALUE_PROPS.slice(3).map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <Icon className="h-6 w-6 text-accent" />
                <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <CallToAction
        eyebrow="Ready when you are"
        title="Stop missing customers."
        description="Get a working VOAS agent on your phone number in under an hour. No engineering required."
      />
    </>
  );
}
