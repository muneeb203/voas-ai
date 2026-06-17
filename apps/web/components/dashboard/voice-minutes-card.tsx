import Link from 'next/link';
import { AlertTriangle, XCircle, Phone, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { UsageSummary } from '@/lib/types';

function formatMinutes(mins: number): string {
  if (mins <= 0) return '0 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface VoiceMinutesCardProps {
  usage: UsageSummary;
  /** Workspace plan name shown in the header badge */
}

export function VoiceMinutesCard({ usage }: VoiceMinutesCardProps) {
  const vm = usage.voice_minutes;
  const unlimited = vm.effective_limit === null;
  const pct = unlimited ? 0 : Math.min(100, vm.percent_used ?? 0);
  const remaining = unlimited ? null : Math.max(0, vm.effective_limit! - vm.used);
  const daysLeft = usage.period.days_remaining;

  // Severity
  const isCritical = !unlimited && pct >= 100;
  const isLow = !unlimited && pct >= 80 && pct < 100;

  // Progress bar colour
  const barColor = isCritical ? 'bg-error' : isLow ? 'bg-warning' : 'bg-accent';

  return (
    <Card className={isCritical ? 'border-error/50' : isLow ? 'border-warning/40' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Phone className="h-4 w-4 text-accent" />
            Voice minutes
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {usage.plan.name}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Remaining display */}
        <div className="flex items-end justify-between">
          {unlimited ? (
            <div>
              <p className="text-2xl font-semibold tracking-tight">Unlimited</p>
              <p className="text-xs text-muted-foreground">{vm.used.toLocaleString()} min used this period</p>
            </div>
          ) : (
            <div>
              <p className={`text-2xl font-semibold tracking-tight ${isCritical ? 'text-error' : isLow ? 'text-warning' : ''}`}>
                {formatMinutes(remaining!)} left
              </p>
              <p className="text-xs text-muted-foreground">
                {vm.used.toLocaleString()} / {vm.effective_limit!.toLocaleString()} min used
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Resets in {daysLeft}d</p>
        </div>

        {/* Progress bar */}
        {!unlimited && (
          <div className="space-y-1.5">
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-right text-xs text-muted-foreground">{Math.round(pct)}% used</p>
          </div>
        )}

        {/* Bonus credits */}
        {vm.bonus_remaining > 0 && (
          <p className="text-xs text-accent">
            +{vm.bonus_remaining.toLocaleString()} bonus min included above
          </p>
        )}

        {/* ── Warning banners ─────────────────────────────────── */}

        {isCritical && (
          <div className="rounded-md border border-error/40 bg-error/10 p-3">
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-error">Voice minutes depleted</p>
                <p className="text-xs text-muted-foreground">
                  New calls may be blocked. Reload your credits or upgrade your plan to restore service.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" asChild className="h-7 text-xs">
                    <Link href="/support?subject=Voice+credits+reload">
                      <RefreshCw className="mr-1.5 h-3 w-3" />
                      Request credit reload
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                    <Link href="/settings?tab=billing">View billing</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isLow && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Running low on voice minutes</p>
                <p className="text-xs text-muted-foreground">
                  You have {formatMinutes(remaining!)} remaining — consider reloading now to avoid interruption.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                    <Link href="/support?subject=Voice+credits+reload">
                      <RefreshCw className="mr-1.5 h-3 w-3" />
                      Request credit reload
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" asChild className="h-7 text-xs">
                    <Link href="/settings?tab=billing">View billing</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Normal state — quiet link to billing */}
        {!isCritical && !isLow && (
          <Link
            href="/settings?tab=billing"
            className="block text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            View full usage →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
