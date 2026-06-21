'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, ExternalLink } from 'lucide-react';

const STEPS = [
  {
    n: 1,
    title: 'Create a free Twilio account',
    body: 'Go to twilio.com and sign up. You get trial credit to test with — no card required to start.',
  },
  {
    n: 2,
    title: 'Buy a phone number',
    body: 'In the Twilio console, go to Phone Numbers → Manage → Buy a number. Search by area code and pick one. Cost is around $1/month.',
  },
  {
    n: 3,
    title: 'Grab your credentials',
    body: 'From the Twilio dashboard home, copy your Account SID (starts with AC) and Auth Token. You will need both when setting up a location below.',
  },
  {
    n: 4,
    title: 'Add the number to a location',
    body: 'Go to Locations, open the three-dot menu on any location, and choose "Set up voice". Paste your SID, token, and phone number there.',
  },
  {
    n: 5,
    title: 'Test it',
    body: 'After saving, use the "Test connection" button in the location voice dialog to confirm the credentials are valid. Then call the number — your AI agent will answer.',
  },
];

export function VoiceSetupGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <BookOpen className="h-4 w-4 text-accent" />
          First time? Start here — 5-minute setup guide
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-accent/20 px-4 pb-5 pt-4">
          <ol className="space-y-4">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">
                  {step.n}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
            <span>
              Need more detail?{' '}
              <a
                href="https://console.twilio.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Open Twilio console
              </a>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
