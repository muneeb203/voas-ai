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

export const VERTICALS = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'dental', label: 'Dental' },
  { value: 'salon', label: 'Salon' },
  { value: 'auto', label: 'Auto repair' },
  { value: 'other', label: 'Other' },
] as const;
export type Vertical = (typeof VERTICALS)[number]['value'];

export const PLANS = [
  {
    id: 'essentials',
    name: 'Essentials',
    priceMonthly: 60,
    maxKioskUrls: 1,
    blurb: 'All channels for single-location operators just getting started.',
    features: [
      '1 location',
      '150 voice minutes / month',
      '500 WhatsApp messages / month',
      '1 kiosk URL',
      'Voice · WhatsApp · Kiosk',
      'Email support',
      '$0.15 / min overage',
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    priceMonthly: 120,
    maxKioskUrls: 3,
    blurb: 'Higher limits for busy single locations.',
    features: [
      '1 location',
      '400 voice minutes / month',
      '1,500 WhatsApp messages / month',
      '3 kiosk URLs',
      'Voice · WhatsApp · Kiosk',
      'Priority email support',
      '$0.14 / min overage',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    priceMonthly: 250,
    maxKioskUrls: 6,
    blurb: 'Multi-location teams with high volume across all channels.',
    features: [
      'Up to 5 locations',
      '1,000 voice minutes / month',
      '4,000 WhatsApp messages / month',
      '6 kiosk URLs',
      'Voice · WhatsApp · Kiosk',
      'Priority support',
      '$0.15 / min overage',
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

export const ADMIN_NAV = [
  { href: '/admin/workspaces', label: 'Workspaces', icon: 'Building2' },
  { href: '/admin/users', label: 'Users', icon: 'Users' },
  { href: '/admin/support', label: 'Support Inbox', icon: 'LifeBuoy' },
  { href: '/admin/audit-log', label: 'Audit Log', icon: 'ScrollText' },
  { href: '/admin/contact-submissions', label: 'Contact Forms', icon: 'Mail' },
  { href: '/admin/announcements', label: 'Announcements', icon: 'Megaphone' },
  { href: '/admin/usage', label: 'Usage & billing', icon: 'Gauge' },
  { href: '/admin/settings', label: 'Settings', icon: 'Settings' },
] as const;
