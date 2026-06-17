import type { Metadata } from 'next';
import { format, parseISO } from 'date-fns';
import { BarChart3, MessageSquare, ShoppingBag, DollarSign, Smile } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { getAnalyticsSummary } from '@/lib/api/analytics';
import { isApiError, type AnalyticsSummary } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/charts/stat-card';
import { BarChart } from '@/components/dashboard/charts/bar-chart';
import { HorizontalBar } from '@/components/dashboard/charts/horizontal-bar';
import { SentimentGauge } from '@/components/dashboard/charts/sentiment-gauge';
import { DaysSelector } from '@/components/dashboard/charts/days-selector';

export const metadata: Metadata = { title: 'Analytics' };

const VALID_DAYS = [7, 30, 90];

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'No ended calls yet';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function sentimentEmoji(value: number | null): string {
  if (value === null) return '—';
  const emoji = value > 0.3 ? '😊' : value < -0.3 ? '😞' : '😐';
  return `${emoji} ${value.toFixed(1)}`;
}

function formatHour(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${period}`;
}

function shortDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d');
  } catch {
    return iso;
  }
}

const CHANNEL_LABELS: Record<string, string> = {
  voice: 'Voice 📞',
  whatsapp: 'WhatsApp 💬',
  chat: 'Web chat',
  sms: 'SMS',
};

const OUTCOME_LABELS: Record<string, string> = {
  order_placed: 'Order placed',
  question_answered: 'Question answered',
  booking_made: 'Booking made',
  escalated: 'Escalated',
  no_resolution: 'No resolution',
};

function prettify(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const session = await requireDashboardSession('/analytics');
  const days = VALID_DAYS.includes(Number(searchParams.days))
    ? Number(searchParams.days)
    : 30;

  const res = await getAnalyticsSummary(session.active.workspace_id, days);

  const header = (
    <PageHeader
      eyebrow="Insights"
      title="Analytics"
      description={`Performance across voice, WhatsApp, and orders over the last ${days} days.`}
      action={<DaysSelector selected={days} />}
    />
  );

  if (isApiError(res)) {
    return (
      <div>
        {header}
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-error">
              Couldn&apos;t load analytics: {res.error.message}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              If this persists, confirm the backend is deployed with the analytics API and that{' '}
              <span className="font-mono">NEXT_PUBLIC_API_URL</span> points to it.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const a: AnalyticsSummary = res.data;

  if (a.total_conversations === 0) {
    return (
      <div>
        {header}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <BarChart3 className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-lg font-semibold">No conversations yet in this period</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Once voice or WhatsApp calls come in, they&apos;ll show up here — conversations,
              orders, revenue, sentiment, and your busiest hours.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const channelItems = Object.entries(a.conversations_by_channel)
    .map(([key, value]) => ({ label: CHANNEL_LABELS[key] ?? prettify(key), value }))
    .sort((x, y) => y.value - x.value);

  const outcomeItems = Object.entries(a.conversations_by_outcome)
    .map(([key, value]) => ({ label: OUTCOME_LABELS[key] ?? prettify(key), value }))
    .sort((x, y) => y.value - x.value);

  const topItems = a.top_menu_items.map((item) => ({
    label: item.name,
    value: item.count,
    subLabel: `${formatCurrency(item.revenue_cents)} revenue`,
  }));

  const hourItems = a.conversations_by_hour
    .filter((h) => h.hour >= 6 && h.hour <= 23 && h.count > 0)
    .map((h) => ({ label: formatHour(h.hour), value: h.count }));

  return (
    <div className="space-y-6">
      {header}

      {/* Row 1 — KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Conversations"
          value={a.total_conversations.toLocaleString()}
          icon={MessageSquare}
        />
        <StatCard label="Orders" value={a.total_orders.toLocaleString()} icon={ShoppingBag} />
        <StatCard
          label="Revenue"
          value={formatCurrency(a.total_revenue_cents)}
          subtext={
            a.avg_order_value_cents !== null
              ? `${formatCurrency(a.avg_order_value_cents)} avg order`
              : undefined
          }
          icon={DollarSign}
        />
        <StatCard
          label="Avg sentiment"
          value={sentimentEmoji(a.avg_sentiment)}
          icon={Smile}
        />
      </div>

      {/* Row 2 — time series */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversations over time</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={a.daily_conversations.map((d) => ({
                label: shortDate(d.date),
                value: d.count,
                formattedValue: `${d.count} conversation${d.count === 1 ? '' : 's'}`,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue over time</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={a.daily_revenue_cents.map((d) => ({
                label: shortDate(d.date),
                value: d.cents / 100,
                formattedValue: formatCurrency(d.cents),
              }))}
              color="bg-success"
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — breakdowns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Channel breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBar items={channelItems} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBar
              items={outcomeItems}
              color="bg-brand"
              emptyMessage="No outcomes recorded yet"
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 4 — top items + busiest hours */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top menu items</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBar
              items={topItems}
              maxValue={a.top_menu_items[0]?.count ?? 1}
              formatValue={(v) => `${v}×`}
              emptyMessage="No orders yet in this period"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Busiest hours</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBar
              items={hourItems}
              color="bg-warning"
              emptyMessage="Not enough data yet"
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 5 — customers, duration, sentiment */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Customers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total customers</span>
              <span className="text-lg font-semibold tabular-nums">{a.total_customers}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">New this period</span>
              <Badge variant="success">{a.new_customers}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Returning</span>
              <span className="text-lg font-semibold tabular-nums">
                {a.returning_customers}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avg call duration</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full items-center justify-center py-6">
            <p className="text-3xl font-semibold tracking-tight">
              {formatDuration(a.avg_duration_seconds)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            <SentimentGauge sentiment={a.avg_sentiment} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
