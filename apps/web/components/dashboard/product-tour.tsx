'use client';

import { useCallback, useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// Event any "Take a tour" button dispatches to (re)launch the tour on demand.
export const START_TOUR_EVENT = 'voas:start-tour';

const STEPS = [
  {
    popover: {
      title: 'Welcome to VOAS AI 👋',
      description:
        "This is your AI front desk. Take a quick tour and we'll show you around. " +
        'You can leave any time with ✕ or Esc — and re-open this from "Take a tour" in the sidebar.',
    },
  },
  {
    element: '[data-tour="dashboard"]',
    popover: {
      title: 'Dashboard',
      description: "Your home base — today's conversations, orders, and revenue at a glance.",
    },
  },
  {
    element: '[data-tour="knowledgeBase"]',
    popover: {
      title: 'Knowledge Base',
      description:
        'The menu and FAQ your AI is trained on. Keep it current so answers and orders stay accurate.',
    },
  },
  {
    element: '[data-tour="integrations"]',
    popover: {
      title: 'Integrations',
      description: 'Connect your phone (Voice), WhatsApp, and set up the in-store kiosk here.',
    },
  },
  {
    element: '[data-tour="orders"]',
    popover: {
      title: 'Orders',
      description:
        'Orders your AI captured across every channel land here, priced against your menu.',
    },
  },
  {
    element: '[data-tour="conversations"]',
    popover: {
      title: 'Conversations',
      description:
        'Every call and chat — voice, WhatsApp, and kiosk — transcribed, tagged, and searchable by channel.',
    },
  },
  {
    element: '[data-tour="customers"]',
    popover: {
      title: 'Customers',
      description: 'Profiles built automatically from who contacts you — history, spend, and more.',
    },
  },
  {
    element: '[data-tour="analytics"]',
    popover: {
      title: 'Analytics',
      description:
        'Trends that matter: channel mix, revenue over time, busiest hours, and customer sentiment.',
    },
  },
  {
    element: '[data-tour="locations"]',
    popover: {
      title: 'Locations & Team',
      description: 'Add your stores, then invite teammates and set their roles under Team.',
    },
  },
  {
    element: '[data-tour="settings"]',
    popover: {
      title: 'Settings & Support',
      description:
        "Manage your workspace and plan in Settings, and reach us from Support any time. " +
        "That's the tour — you're all set!",
    },
  },
];

interface ProductTourProps {
  userId: string;
  tourCompleted: boolean;
}

export function ProductTour({ userId, tourCompleted }: ProductTourProps) {
  const startedRef = useRef(false);

  const markComplete = useCallback(async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase
        .from('user_onboarding')
        .upsert(
          { user_id: userId, tour_completed_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
    } catch {
      // Non-fatal: worst case the tour auto-shows once more next login.
    }
  }, [userId]);

  const startTour = useCallback(() => {
    const d = driver({
      showProgress: true,
      allowClose: true,
      overlayColor: '#0A2540',
      nextBtnText: 'Next',
      prevBtnText: 'Prev',
      doneBtnText: 'Done',
      steps: STEPS,
      onDestroyed: () => {
        void markComplete();
      },
    });
    d.drive();
  }, [markComplete]);

  // Auto-start once for a brand-new user — desktop only (the tour highlights
  // the sidebar, which is hidden on small screens).
  useEffect(() => {
    if (tourCompleted || startedRef.current) return;
    if (window.innerWidth < 1024) return;
    startedRef.current = true;
    const timer = setTimeout(startTour, 700);
    return () => clearTimeout(timer);
  }, [tourCompleted, startTour]);

  // Manual re-launch from any "Take a tour" trigger.
  useEffect(() => {
    const handler = () => startTour();
    window.addEventListener(START_TOUR_EVENT, handler);
    return () => window.removeEventListener(START_TOUR_EVENT, handler);
  }, [startTour]);

  return null;
}
