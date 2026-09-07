import Link from 'next/link';
import { AlertTriangle, XCircle, MonitorSmartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { KioskSettings } from '@/lib/api/kiosk';

interface KioskCreditsCardProps {
  settings: KioskSettings;
}

// The kiosk's own meter — separate from voice minutes. One credit per completed
// order; when the balance hits 0 the kiosk goes out of service.
export function KioskCreditsCard({ settings }: KioskCreditsCardProps) {
  const remaining = Math.max(0, settings.kiosk_credits_balance);
  const used = Math.max(0, settings.kiosk_credits_used_this_month);
  // "Tank" for this period: what's been used plus what's left. Gives a sensible
  // fill even without a fixed monthly cap.
  const tank = used + remaining;
  const pctUsed = tank > 0 ? Math.min(100, Math.round((used / tank) * 100)) : 0;

  const isCritical = remaining <= 0;
  const isLow = !isCritical && (pctUsed >= 80 || remaining <= 10);
  const barColor = isCritical ? 'bg-error' : isLow ? 'bg-warning' : 'bg-accent';

  return (
    <Card className={isCritical ? 'border-error/50' : isLow ? 'border-warning/40' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <MonitorSmartphone className="h-4 w-4 text-accent" />
          Kiosk credits
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <p
              className={`text-2xl font-semibold tracking-tight ${
                isCritical ? 'text-error' : isLow ? 'text-warning' : ''
              }`}
            >
              {remaining.toLocaleString()} left
            </p>
            <p className="text-xs text-muted-foreground">
              {used.toLocaleString()} used this month · 1 credit per order
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div className={`h-full transition-all ${barColor}`} style={{ width: `${pctUsed}%` }} />
          </div>
          <p className="text-right text-xs text-muted-foreground">{pctUsed}% used</p>
        </div>

        {isCritical && (
          <div className="rounded-md border border-error/40 bg-error/10 p-3">
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-error">Out of kiosk credits</p>
                <p className="text-xs text-muted-foreground">
                  The kiosk is out of service until more credits are added. Contact us to top up.
                </p>
                <Button size="sm" asChild className="h-7 text-xs">
                  <Link href="/support?subject=Kiosk+credits+top-up">Request more credits</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLow && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Running low on kiosk credits</p>
                <p className="text-xs text-muted-foreground">
                  {remaining.toLocaleString()} credit{remaining === 1 ? '' : 's'} left — top up
                  before the kiosk goes out of service.
                </p>
                <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                  <Link href="/support?subject=Kiosk+credits+top-up">Request more credits</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
