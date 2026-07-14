'use client';

import { useCallback, useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// Event any "Take a tour" button dispatches to (re)launch the tour on demand.
export const START_TOUR_EVENT = 'voas:start-tour';

interface TourStep {
  element?: string;
  popover: { title: string; description: string };
}

// The tour mirrors the workspace vertical: a salon is shown Services / Staff /
// Appointments where a restaurant is shown Knowledge Base / Orders.
function buildSteps(vertical: string): TourStep[] {
  const isSalon = vertical === 'salon';

  const welcome: TourStep = {
    popover: {
      title: 'Welcome to VOAS AI 👋',
      description:
        "This is your AI front desk. Take a quick tour and we'll show you around. " +
        'You can leave any time with ✕ or Esc — and re-open this from "Take a tour" in the sidebar.',
    },
  };

  const dashboard: TourStep = {
    element: '[data-tour="dashboard"]',
    popover: {
      title: 'Dashboard',
      description: isSalon
        ? "Your home base — today's conversations, appointments, and revenue at a glance."
        : "Your home base — today's conversations, orders, and revenue at a glance.",
    },
  };

  const catalog: TourStep = isSalon
    ? {
        element: '[data-tour="services"]',
        popover: {
          title: 'Services',
          description:
            'The treatments customers can book — each with a price and duration. Your AI books appointments against these.',
        },
      }
    : {
        element: '[data-tour="knowledgeBase"]',
        popover: {
          title: 'Knowledge Base',
          description:
            'The menu and FAQ your AI is trained on. Keep it current so answers and orders stay accurate.',
        },
      };

  const integrations: TourStep = {
    element: '[data-tour="integrations"]',
    popover: {
      title: 'Integrations',
      description: 'Connect your phone (Voice), WhatsApp, and set up the in-store kiosk here.',
    },
  };

  const work: TourStep = isSalon
    ? {
        element: '[data-tour="appointments"]',
        popover: {
          title: 'Appointments',
          description:
            'Every booking your AI and team make lands here — confirm, complete, or mark no-shows.',
        },
      }
    : {
        element: '[data-tour="orders"]',
        popover: {
          title: 'Orders',
          description:
            'Orders your AI captured across every channel land here, priced against your menu.',
        },
      };

  const conversations: TourStep = {
    element: '[data-tour="conversations"]',
    popover: {
      title: 'Conversations',
      description:
        'Every call and chat — voice, WhatsApp, and kiosk — transcribed, tagged, and searchable by channel.',
    },
  };

  const customers: TourStep = {
    element: '[data-tour="customers"]',
    popover: {
      title: 'Customers',
      description: 'Profiles built automatically from who contacts you — history, spend, and more.',
    },
  };

  const analytics: TourStep = {
    element: '[data-tour="analytics"]',
    popover: {
      title: 'Analytics',
      description:
        'Trends that matter: channel mix, revenue over time, busiest hours, and customer sentiment.',
    },
  };

  const staff: TourStep = {
    element: '[data-tour="staff"]',
    popover: {
      title: 'Staff',
      description:
        'Add your team, the services each performs, and their weekly hours — the AI only offers slots inside these.',
    },
  };

  const locations: TourStep = {
    element: '[data-tour="locations"]',
    popover: {
      title: 'Locations & Team',
      description: 'Add your stores, then invite teammates and set their roles under Team.',
    },
  };

  const verticals: TourStep = {
    popover: {
      title: 'Built for your business type',
      description: isSalon
        ? 'This is the salon experience: Services, Staff, and Appointments so the AI can book customers in. ' +
          'Restaurants get Orders, Menu, and kiosk ordering instead — you can switch your business type in Settings.'
        : 'This is the restaurant experience: Menu, Orders, and kiosk ordering. ' +
          'Salons get Appointments, Services, and Staff instead — more verticals are coming, and you can switch in Settings.',
    },
  };

  const settings: TourStep = {
    element: '[data-tour="settings"]',
    popover: {
      title: 'Settings & Support',
      description:
        'Manage your workspace, business type, and plan in Settings, and reach us from Support any time. ' +
        "That's the tour — you're all set!",
    },
  };

  return isSalon
    ? [
        welcome,
        dashboard,
        catalog,
        integrations,
        work,
        conversations,
        customers,
        analytics,
        staff,
        locations,
        verticals,
        settings,
      ]
    : [
        welcome,
        dashboard,
        catalog,
        integrations,
        work,
        conversations,
        customers,
        analytics,
        locations,
        verticals,
        settings,
      ];
}

interface ProductTourProps {
  userId: string;
  tourCompleted: boolean;
  vertical?: string;
}

export function ProductTour({ userId, tourCompleted, vertical = 'restaurant' }: ProductTourProps) {
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
      steps: buildSteps(vertical),
      onDestroyed: () => {
        void markComplete();
      },
    });
    d.drive();
  }, [markComplete, vertical]);

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
