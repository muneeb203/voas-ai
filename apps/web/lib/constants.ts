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
    id: 'starter',
    name: 'Starter',
    priceMonthly: 149,
    blurb: 'For single-location SMBs getting started.',
    features: ['1 location', '500 conversations/mo', 'Voice + WhatsApp', 'Email support'],
  },
  {
    id: 'growth',
    name: 'Growth',
    priceMonthly: 299,
    blurb: 'For multi-location or higher-volume businesses.',
    features: ['Up to 5 locations', '2,000 conversations/mo', 'All channels', 'Priority support'],
  },
  {
    id: 'scale',
    name: 'Scale',
    priceMonthly: 499,
    blurb: 'For chains and franchises scaling fast.',
    features: ['Up to 25 locations', 'Unlimited conversations', 'All channels', 'Dedicated CSM'],
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
  { href: '/admin/settings', label: 'Settings', icon: 'Settings' },
] as const;
