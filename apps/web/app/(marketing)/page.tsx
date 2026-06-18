import Link from 'next/link';
import { Phone, MessageSquare, BarChart3, Plug, Sparkles, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CallToAction } from '@/components/marketing/cta';
import { DemoVideoSection } from '@/components/marketing/demo-video-section';

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Connect',
    body: 'Plug VOAS into the tools you already run — POS, calendar, WhatsApp. Setup is OAuth, not engineering.',
  },
  {
    step: '02',
    title: 'Train',
    body: 'Upload your menu, hours, and FAQs. VOAS learns how your business actually sounds — not generic AI templates.',
  },
  {
    step: '03',
    title: 'Go live',
    body: 'Calls, WhatsApp, and chat are answered instantly. You watch every conversation, transcript, and outcome in one dashboard.',
  },
] as const;

const VALUE_PROPS = [
  {
    icon: Phone,
    title: 'Every call answered',
    body: 'Missed calls are missed orders. VOAS picks up on the first ring, every time — 3 a.m. on a Tuesday or Saturday rush.',
  },
  {
    icon: MessageSquare,
    title: 'One brain, every channel',
    body: 'Voice, WhatsApp, web chat — the same AI handles them all and remembers the customer across channels.',
  },
  {
    icon: BarChart3,
    title: 'Visibility you never had',
    body: 'Every conversation is transcribed, tagged, and analyzed. See what customers actually ask for and where money is leaking.',
  },
] as const;

const MORE_PROPS = [
  {
    icon: Sparkles,
    title: 'Sounds like a real person',
    body: 'Not a phone tree. VOAS picks up nuance, handles interruptions, and escalates to a human when it should.',
  },
  {
    icon: Plug,
    title: 'Plays well with your stack',
    body: 'Toast, Square, Stripe, Twilio, Google Calendar — order placement and bookings land where you already work.',
  },
  {
    icon: Smile,
    title: 'Customers don’t notice',
    body: 'Orders, bookings, and refunds happen so smoothly that 9 out of 10 callers don’t realize they’re talking to AI.',
  },
] as const;

const LOGO_SLOTS = ['Logo', 'Logo', 'Logo', 'Logo', 'Logo', 'Logo'] as const;

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
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
                No credit card required. Live in under an hour.
              </p>
            </div>

            {/* Right: looping demo preview */}
            <div className="mx-auto w-full max-w-lg lg:mx-0">
              <DemoVideoSection preview />
              <p className="mt-3 text-center text-xs text-muted-foreground lg:text-left">
                ↓ Watch the full demo below — switch between English, Arabic &amp; Urdu
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Logo strip */}
      <section className="border-y border-border/60 bg-background">
        <div className="container py-10">
          <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Trusted by operators across the US
          </p>
          <div className="mt-6 grid grid-cols-3 gap-6 sm:grid-cols-6">
            {LOGO_SLOTS.map((label, i) => (
              <div
                key={i}
                className="flex h-10 items-center justify-center rounded border border-dashed border-border text-xs font-medium text-muted-foreground/60"
                aria-label="Customer logo placeholder"
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo video — language switcher (EN / AR / UR) */}
      <DemoVideoSection />

      {/* How it works */}
      <section className="container py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-accent-700">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            From phone call to fulfilled order — without you lifting a finger.
          </h2>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.step} className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <span className="text-xs font-mono font-semibold text-accent-700">{s.step}</span>
              <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Value props */}
      <section className="bg-secondary/30">
        <div className="container py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-widest text-accent-700">
              Why VOAS
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              An AI that pays attention.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Most voice AI is an FAQ pattern-matcher with a voice on top. VOAS is built around a
              different constraint: sound like someone who is actually listening.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {VALUE_PROPS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="rounded-lg bg-background p-6 shadow-sm">
                  <Icon className="h-6 w-6 text-accent" />
                  <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Secondary props */}
      <section className="container py-20 sm:py-28">
        <div className="grid gap-6 md:grid-cols-3">
          {MORE_PROPS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="border-l-2 border-accent/40 pl-5">
                <Icon className="h-5 w-5 text-brand" />
                <h3 className="mt-3 text-base font-semibold">{p.title}</h3>
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
