import { format, parseISO } from 'date-fns';
import type { CreditGrant, UsageMetric, UsageSummary } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function formatPeriodDate(iso: string): string {
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

function UsageMeter({
  label,
  metric,
  unitLabel,
}: {
  label: string;
  metric: UsageMetric;
  unitLabel: string;
}) {
  const unlimited = metric.effective_limit === null;
  const pct = unlimited ? 0 : Math.min(100, metric.percent_used ?? 0);
  const barColor =
    pct >= 100 ? 'bg-error' : pct >= 80 ? 'bg-warning' : 'bg-accent';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {metric.used.toLocaleString()}
          {unlimited ? ` ${unitLabel}` : ` / ${metric.effective_limit!.toLocaleString()} ${unitLabel}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {metric.bonus_remaining > 0 && (
        <p className="text-xs text-muted-foreground">
          +{metric.bonus_remaining.toLocaleString()} bonus {unitLabel} remaining
        </p>
      )}
    </div>
  );
}

interface BillingUsagePanelProps {
  usage: UsageSummary;
  grants: CreditGrant[];
}

export function BillingUsagePanel({ usage, grants }: BillingUsagePanelProps) {
  const { plan, period, tokens } = usage;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>
                Rolling 30-day period · {formatPeriodDate(period.start)} –{' '}
                {formatPeriodDate(period.end)}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Resets in {period.days_remaining} days</Badge>
              {!usage.enforcement_active && (
                <Badge variant="outline">Limits paused by admin</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <UsageMeter label="Voice" metric={usage.voice_minutes} unitLabel="min" />
          <UsageMeter
            label="WhatsApp"
            metric={usage.whatsapp_messages}
            unitLabel="messages"
          />
          <UsageMeter
            label="Help assistant"
            metric={usage.help_bot_turns}
            unitLabel="turns"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI tokens this period</CardTitle>
          <CardDescription>
            OpenAI (WhatsApp) and Gemini (help bot). Infrastructure is included in your plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">OpenAI</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {tokens.openai_tokens.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Gemini</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {tokens.gemini_tokens.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {tokens.total_tokens.toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      {grants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bonus credits</CardTitle>
            <CardDescription>Admin-granted credits that carry until used.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {grants.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="capitalize">{g.credit_type.replace(/_/g, ' ')}</span>
                <span className="tabular-nums text-muted-foreground">
                  {g.amount_remaining.toLocaleString()} / {g.amount_total.toLocaleString()} left
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Payment processing is not enabled yet. Usage is tracked so your team can stay within plan
        limits. Contact VOAS support to change plans or request credits.
      </p>
    </div>
  );
}
