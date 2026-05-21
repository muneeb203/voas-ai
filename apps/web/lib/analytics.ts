'use client';

import posthog from 'posthog-js';

let initialized = false;

function ensureInit() {
  if (initialized) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === 'undefined') return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage',
    autocapture: false, // we capture explicit events; reduces noise
  });
  initialized = true;
}

export type AnalyticsEvent =
  | 'signup_started'
  | 'signup_completed'
  | 'login_completed'
  | 'onboarding_completed'
  | 'location_created'
  | 'member_invited'
  | 'invitation_accepted'
  | 'ticket_created'
  | 'ticket_replied'
  | 'ticket_resolved'
  | 'workspace_renamed'
  | 'workspace_deleted'
  | 'admin_login'
  | 'admin_impersonation_started'
  | 'admin_impersonation_ended'
  | 'admin_ticket_replied';

export function track(event: AnalyticsEvent, properties: Record<string, unknown> = {}) {
  ensureInit();
  if (initialized) posthog.capture(event, properties);
}

export function identify(userId: string, traits: Record<string, unknown> = {}) {
  ensureInit();
  if (initialized) posthog.identify(userId, traits);
}

export function resetAnalytics() {
  if (initialized) posthog.reset();
}
