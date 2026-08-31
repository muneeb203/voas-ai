'use client';

import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// REPLACE THESE three Vimeo video IDs after uploading your videos to Vimeo.
// The ID is the number in the URL: vimeo.com/123456789  →  ID = 123456789
// ─────────────────────────────────────────────────────────────────────────────
const VIDEOS = {
  en: {
    id: '1203747696',
    label: 'English',
    nativeLabel: 'English',
    flag: '🇬🇧',
  },
  ar: {
    id: '1202520056',
    label: 'Arabic',
    nativeLabel: 'العربية',
    flag: '🇸🇦',
  },
  ur: {
    id: '1202508526',
    label: 'Urdu',
    nativeLabel: 'اردو',
    flag: '🇵🇰',
  },
} as const;

type Lang = keyof typeof VIDEOS;

function vimeoSrc(id: string, muted: boolean) {
  const params = [
    'autoplay=1',
    `muted=${muted ? 1 : 0}`,
    'loop=1',
    'background=1',  // removes all Vimeo UI: logo, controls, progress bar, settings
    'dnt=1',
  ].join('&');
  return `https://player.vimeo.com/video/${id}?${params}`;
}

interface DemoVideoSectionProps {
  /** When true renders a compact preview (for hero). Default false = full section. */
  preview?: boolean;
}

export function DemoVideoSection({ preview = false }: DemoVideoSectionProps) {
  const [active, setActive] = useState<Lang>('en');
  const [muted, setMuted] = useState(true);

  if (preview) {
    return (
      <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl ring-1 ring-black/5">
        <div className="aspect-video">
          <iframe
            key="preview"
            src={vimeoSrc(VIDEOS.en.id, true)}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="VOAS AI demo preview"
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card/80 to-transparent" />
      </div>
    );
  }

  return (
    <section className="container py-20 sm:py-28">
      {/* Section header */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium uppercase tracking-widest text-accent-700">
          Live demo
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          See it in action
        </h2>
        <p className="mt-4 text-muted-foreground">
          Watch VOAS AI take an order over a real phone call — in your language.
        </p>
      </div>

      {/* Language switcher */}
      <div className="mt-10 flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 p-1">
          {(Object.entries(VIDEOS) as [Lang, (typeof VIDEOS)[Lang]][]).map(([lang, v]) => (
            <button
              key={lang}
              type="button"
              onClick={() => setActive(lang)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                active === lang
                  ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>{v.flag}</span>
              <span className="hidden sm:inline">{v.nativeLabel}</span>
              <span className="sm:hidden">{v.flag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Video frame */}
      <div className="mx-auto mt-8 max-w-4xl">
        <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xl ring-1 ring-black/5">
          <div className="aspect-video">
            {/* key= forces remount on language or mute switch so Vimeo reloads cleanly */}
            <iframe
              key={`${active}-${muted}`}
              src={vimeoSrc(VIDEOS[active].id, muted)}
              className="h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title={`VOAS AI demo — ${VIDEOS[active].label}`}
            />
          </div>

          {/* Mute / unmute button — sits over the video, bottom-right */}
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/70"
            aria-label={muted ? 'Unmute video' : 'Mute video'}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            {muted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      </div>
    </section>
  );
}
