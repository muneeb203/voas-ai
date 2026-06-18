'use client';

import { useState } from 'react';
import { Volume2 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// REPLACE THESE three Vimeo video IDs after uploading your videos to Vimeo.
// The ID is the number in the URL: vimeo.com/123456789  →  ID = 123456789
// ─────────────────────────────────────────────────────────────────────────────
const VIDEOS = {
  en: {
    id: 'https://vimeo.com/1202488321?share=copy&fl=sv&fe=ci',
    label: 'English',
    nativeLabel: 'English',
    flag: '🇬🇧',
  },
  ar: {
    id: 'REPLACE_ARABIC_VIMEO_ID',
    label: 'Arabic',
    nativeLabel: 'العربية',
    flag: '🇸🇦',
  },
  ur: {
    id: 'REPLACE_URDU_VIMEO_ID',
    label: 'Urdu',
    nativeLabel: 'اردو',
    flag: '🇵🇰',
  },
} as const;

type Lang = keyof typeof VIDEOS;

function vimeoSrc(id: string, background = false) {
  const base = `https://player.vimeo.com/video/${id}`;
  const params = [
    'autoplay=1',
    'muted=1',
    'loop=1',
    'title=0',
    'byline=0',
    'portrait=0',
    ...(background ? ['background=1'] : []),
  ].join('&');
  return `${base}?${params}`;
}

interface DemoVideoSectionProps {
  /** When true renders a compact preview (for hero). Default false = full section. */
  preview?: boolean;
}

export function DemoVideoSection({ preview = false }: DemoVideoSectionProps) {
  const [active, setActive] = useState<Lang>('en');

  if (preview) {
    return (
      <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl ring-1 ring-black/5">
        <div className="aspect-video">
          <iframe
            key={`preview-${active}`}
            src={vimeoSrc(VIDEOS.en.id, true)}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="VOAS AI demo preview"
          />
        </div>
        {/* Gradient overlay at bottom pointing to the full demo below */}
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
          {/* Aspect ratio wrapper */}
          <div className="aspect-video">
            {/* key= forces iframe remount on language switch → new video loads cleanly */}
            <iframe
              key={active}
              src={vimeoSrc(VIDEOS[active].id)}
              className="h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title={`VOAS AI demo — ${VIDEOS[active].label}`}
            />
          </div>
        </div>

        {/* Unmute hint */}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Volume2 className="h-3.5 w-3.5" />
          <span>Video plays muted — hover the player and click the volume icon to unmute</span>
        </div>
      </div>
    </section>
  );
}
