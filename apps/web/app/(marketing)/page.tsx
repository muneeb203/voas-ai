import Link from 'next/link';
import {
  MessageSquare, PhoneCall, Brain, ClipboardCheck,
  Zap, Gauge, Rocket, ShieldCheck,
  TrendingDown, TrendingUp, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CallToAction } from '@/components/marketing/cta';
import { DemoVideoSection } from '@/components/marketing/demo-video-section';

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: PhoneCall,
    title: 'Customer Connects',
    body: 'The AI greets callers or chatters instantly. No hold music, no busy tones — just immediate service.',
  },
  {
    step: '02',
    icon: Brain,
    title: 'AI Processes Intent',
    body: 'VOAS understands context, modifiers, and preferences across 50+ languages.',
  },
  {
    step: '03',
    icon: ClipboardCheck,
    title: 'Automatic Fulfillment',
    body: 'Orders sync directly to your POS, bookings to your calendar, and notes enter your CRM.',
  },
] as const;

const CHANNELS = [
  {
    icon: Zap,
    label: 'Voice & Phone',
    headline: 'Zero Latency Conversations',
    body: 'Human-like voices that handle interruptions, accents, and noisy environments with ease. Books, takes orders, answers questions — and hands off to a human when it should.',
    bullets: [
      'Sub-second, interruption-tolerant responses',
      'Menu & FAQ trained to your business',
      'Full recordings + transcripts in the dashboard',
    ],
  },
  {
    icon: MessageSquare,
    label: 'WhatsApp, SMS, Web Chat',
    headline: 'Conversations that pick up where they left off.',
    body: 'Maintain continuity as customers switch to text without repeating themselves. Outbound confirmations, status updates, and win-back flows — all from approved templates.',
    bullets: [
      'Inbound + outbound on one number',
      'Rich messages: lists, buttons, images',
      'Context stitched across phone + chat',
    ],
  },
] as const;

const WHY_VOAS = [
  {
    icon: Gauge,
    title: 'Reliable by Design',
    body: 'Built for the mission-critical customer moments — steady quality when it matters most.',
  },
  {
    icon: Rocket,
    title: 'Instant Setup',
    body: 'Upload your knowledge base and be live in minutes, not weeks.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Grade',
    body: 'Enterprise-grade security and data privacy, built in by default.',
  },
] as const;

const STATS = [
  {
    icon: TrendingDown,
    title: 'Cost reduction',
    body: 'Cut front-desk staffing costs while increasing the volume you can handle.',
  },
  {
    icon: TrendingUp,
    title: 'Revenue growth',
    body: 'Never lose a lead to a missed call or a long hold time again.',
  },
  {
    icon: Layers,
    title: 'Infinite scaling',
    body: 'Handle 1 to 1,000 concurrent conversations with the same consistent quality.',
  },
] as const;

function HeroVisual() {
  return (
    <div className="relative mx-auto mt-14 w-full max-w-4xl overflow-hidden rounded-2xl border border-border/60 bg-brand shadow-2xl ring-1 ring-black/5">
      {/* grid */}
      <svg className="absolute inset-0 h-full w-full text-white/[0.06]" aria-hidden>
        <defs>
          <pattern id="hero-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>
      {/* teal glows */}
      <div className="pointer-events-none absolute -left-16 top-1/3 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative flex aspect-[16/9] flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="flex items-center gap-3">
          {[PhoneCall, MessageSquare, Brain].map((Icon, i) => (
            <div
              key={i}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm"
            >
              <Icon className="h-6 w-6 text-accent" />
            </div>
          ))}
        </div>
        <p className="text-lg font-semibold text-white sm:text-xl">One brain. Every channel.</p>
        <p className="max-w-md text-sm text-white/50">
          Voice, WhatsApp, and web chat — answered, understood, and fulfilled automatically.
        </p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section id="hero" className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-secondary/40 via-background to-background" />
        <div className="container py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-700">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Now in pilot with restaurants
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            A conversational front desk that never sleeps.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
            VOAS AI answers every phone call, WhatsApp message, and web chat — takes the order,
            books the appointment, handles the complaint, and follows up. One brain. Every channel.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
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

          <HeroVisual />
        </div>
      </section>

      {/* Demo video — "See it in action" */}
      <section id="demo">
        <DemoVideoSection />
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-border/60 bg-secondary/30">
        <div className="container py-20 sm:py-28">
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
                <div key={s.step} className="rounded-xl border border-border bg-background p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10">
                      <Icon className="h-5 w-5 text-accent" />
                    </div>
                    <span className="font-mono text-2xl font-bold text-accent/30">{s.step}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Product — one brain across every channel */}
      <section id="features" className="container py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-accent-700">Product</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            One AI brain across every channel.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Voice, WhatsApp, and web chat share one memory — so customers never repeat themselves,
            and you never miss a conversation.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {CHANNELS.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-xl border border-border bg-card p-7 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <span className="text-xs font-medium uppercase tracking-widest text-accent-700">
                    {c.label}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{c.headline}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.body}</p>
                <ul className="mt-5 space-y-2">
                  {c.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why VOAS */}
      <section id="why" className="border-y border-border/60 bg-secondary/30">
        <div className="container py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-accent-700">Why VOAS</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              An AI that actually pays attention.
            </h2>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {WHY_VOAS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="rounded-xl border border-border bg-background p-6 shadow-sm">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Business impact / stats */}
      <section id="impact" className="container py-20 sm:py-28">
        <div className="grid gap-10 md:grid-cols-3">
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title}>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="mt-5 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <CallToAction
        eyebrow="Ready when you are"
        title="Stop missing customers."
        description="Join the businesses using VOAS AI to reclaim their front desk — a working agent on your number in under an hour."
        primaryLabel="Start free"
        secondaryLabel="Schedule a demo"
      />
    </>
  );
}
