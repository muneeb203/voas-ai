import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  Phone,
  MessageSquare,
  BookOpen,
  Users,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listLocations } from '@/lib/api/locations';
import { listMembers } from '@/lib/api/members';
import { getTodayStats } from '@/lib/api/analytics';
import { getVoiceSettings } from '@/lib/api/voice';
import { getWhatsAppSettings, getLocationWhatsAppConfig } from '@/lib/api/whatsapp';
import { isApiError } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Dashboard',
};

interface ChecklistItem {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  done: boolean;
  comingSoon?: boolean;
}

interface StatCardData {
  label: string;
  value: string;
  hint: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function sentimentEmoji(value: number | null): string {
  if (value === null) return '—';
  const emoji = value > 0.3 ? '😊' : value < -0.3 ? '😞' : '😐';
  return `${emoji} ${value.toFixed(1)}`;
}

export default async function DashboardHome() {
  const [session, t, tc] = await Promise.all([
    requireDashboardSession('/dashboard'),
    getTranslations('dashboard'),
    getTranslations('common'),
  ]);
  const workspaceId = session.active.workspace_id;

  const [locationsRes, membersRes, todayRes, voiceRes, waSettingsRes] = await Promise.all([
    listLocations(workspaceId),
    listMembers(workspaceId),
    getTodayStats(workspaceId),
    getVoiceSettings(workspaceId),
    getWhatsAppSettings(workspaceId),
  ]);

  const locations = !isApiError(locationsRes) ? locationsRes.data : [];
  const hasLocation = locations.length > 0;
  const hasInvitedTeam = !isApiError(membersRes) && membersRes.data.length > 1;
  const today = !isApiError(todayRes) ? todayRes.data : null;
  const voiceConfigured =
    !isApiError(voiceRes) && voiceRes.data.vapi_assistant_id !== null;

  const waSettings = !isApiError(waSettingsRes) ? waSettingsRes.data : null;
  const waConfigResults =
    locations.length > 0
      ? await Promise.all(
          locations.map((loc) => getLocationWhatsAppConfig(workspaceId, loc.id)),
        )
      : [];
  const whatsappConfigured =
    (waSettings?.enabled ?? false) &&
    waConfigResults.some((r) => !isApiError(r) && r.data?.enabled);

  const isSalon = session.active.workspace.vertical === 'salon';

  const stats: StatCardData[] = [
    {
      label: t('stats.conversations'),
      value: today ? today.conversations_today.toLocaleString() : '—',
      hint: t('stats.conversationsHint'),
    },
    {
      label: isSalon ? 'Appointments' : t('stats.orders'),
      value: today ? today.orders_today.toLocaleString() : '—',
      hint: isSalon ? 'Appointments today' : t('stats.ordersHint'),
    },
    {
      label: isSalon ? 'Booked revenue' : t('stats.revenue'),
      value: today ? formatCurrency(today.revenue_today_cents) : '—',
      hint: isSalon ? 'From today’s appointments' : t('stats.revenueHint'),
    },
    {
      label: t('stats.sentiment'),
      value: today ? sentimentEmoji(today.avg_sentiment_today) : '—',
      hint: t('stats.sentimentHint'),
    },
  ];

  const checklist: ChecklistItem[] = [
    {
      icon: BookOpen,
      title: t('getStarted.addLocation'),
      description: t('getStarted.addLocationDesc'),
      href: '/locations',
      done: hasLocation,
    },
    {
      icon: Users,
      title: t('getStarted.inviteTeam'),
      description: t('getStarted.inviteTeamDesc'),
      href: '/team',
      done: hasInvitedTeam,
    },
    {
      icon: Phone,
      title: t('getStarted.configureVoice'),
      description: t('getStarted.configureVoiceDesc'),
      href: '/integrations/voice',
      done: voiceConfigured,
    },
    {
      icon: MessageSquare,
      title: t('getStarted.configureWhatsApp'),
      description: t('getStarted.configureWhatsAppDesc'),
      href: '/integrations/whatsapp',
      done: whatsappConfigured,
    },
  ];

  const fullName = session.user.full_name?.split(' ')[0] ?? null;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest text-accent-700">
          {t('eyebrow')}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {t('welcome')}{fullName ? `, ${fullName}` : ''} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          {t('subtitle')}{' '}
          <span className="font-medium text-foreground">{session.active.workspace.name}</span>.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('today')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-5">
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{s.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>{t('getStarted.title')}</CardTitle>
            <p className="text-sm text-muted-foreground">{t('getStarted.subtitle')}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group flex items-start gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent/40"
                >
                  <div
                    className={
                      item.done
                        ? 'flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white'
                        : 'flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground'
                    }
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{item.title}</h3>
                      {item.done && <Badge variant="success">{tc('done')}</Badge>}
                      {item.comingSoon && <Badge variant="secondary">{tc('comingSoon')}</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
