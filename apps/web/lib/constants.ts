export const SITE = {
  name: 'VOAS AI',
  tagline: 'Conversational front desk for businesses.',
  description:
    'One AI brain answers every phone call, WhatsApp message, and web chat — takes orders, books appointments, handles complaints, and follows up.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001',
  company: 'Convosol',
} as const;

export const WORKSPACE_ROLES = ['owner', 'manager', 'staff'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

// `available: true` = the vertical has a full functional experience today
// (Orders/Menu for restaurant, Appointments/Services/Staff for salon).
// The rest are on the roadmap and show the base experience until built.
export const VERTICALS = [
  { value: 'restaurant', label: 'Restaurant', available: true },
  { value: 'salon', label: 'Salon', available: true },
  { value: 'dental', label: 'Dental', available: false },
  { value: 'auto', label: 'Auto repair', available: false },
  { value: 'other', label: 'Other', available: false },
] as const;
export type Vertical = (typeof VERTICALS)[number]['value'];

// Pay-as-you-go rates. Plan "original" prices are these rates applied to the
// included usage; the plan price is a bundled discount on that.
export const PAY_AS_YOU_GO = {
  voicePerMinute: 0.12,
  kioskPerInteraction: 0.12,
} as const;

export const PLANS = [
  {
    id: 'essentials',
    name: 'Essentials',
    priceMonthly: 100,
    originalMonthly: 120, // 500 voice + 500 kiosk @ $0.12
    maxKioskUrls: 1,
    blurb: 'Voice, WhatsApp, and kiosk for single-location operators.',
    features: [
      '1 location',
      '500 voice minutes / month',
      '500 kiosk interactions / month',
      '1 kiosk URL',
      'Voice · WhatsApp · Kiosk',
      'Email support',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    priceMonthly: 200,
    originalMonthly: 240, // 1,000 voice + 1,000 kiosk @ $0.12
    maxKioskUrls: 3,
    blurb: 'Higher limits for growing operations across multiple locations.',
    features: [
      'Up to 3 locations',
      '1,000 voice minutes / month',
      '1,000 kiosk interactions / month',
      '3 kiosk URLs',
      'Voice · WhatsApp · Kiosk',
      'Priority email support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    priceMonthly: 400,
    originalMonthly: 480, // 2,000 voice + 2,000 kiosk @ $0.12
    maxKioskUrls: 6,
    blurb: 'High-volume multi-location teams across all channels.',
    features: [
      'Up to 5 locations',
      '2,000 voice minutes / month',
      '2,000 kiosk interactions / month',
      '6 kiosk URLs',
      'Voice · WhatsApp · Kiosk',
      'Priority support',
    ],
  },
] as const;
export type PlanId = (typeof PLANS)[number]['id'];

export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'] as const;
export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

export const DASHBOARD_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/conversations', label: 'Conversations', icon: 'MessageSquare' },
  { href: '/orders', label: 'Orders', icon: 'ShoppingBag' },
  { href: '/customers', label: 'Customers', icon: 'Users2' },
  { href: '/knowledge-base', label: 'Knowledge Base', icon: 'BookOpen' },
  { href: '/integrations', label: 'Integrations', icon: 'Plug' },
  { href: '/analytics', label: 'Analytics', icon: 'BarChart3' },
  { href: '/team', label: 'Team', icon: 'Users' },
  { href: '/settings', label: 'Settings', icon: 'Settings' },
  { href: '/support', label: 'Support', icon: 'LifeBuoy' },
] as const;
