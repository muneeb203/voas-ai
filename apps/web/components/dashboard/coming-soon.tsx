import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ComingSoonProps {
  icon: LucideIcon;
  title: string;
  blurb: string;
  arrivesIn?: string;
  showcase?: { icon: LucideIcon; title: string; subtitle?: string }[];
}

export function ComingSoon({
  icon: Icon,
  title,
  blurb,
  arrivesIn = 'V2',
  showcase,
}: ComingSoonProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
          <Icon className="h-6 w-6 text-accent" />
        </div>
        <Badge variant="accent">Coming in {arrivesIn}</Badge>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{blurb}</p>

        {showcase && (
          <div className="mt-6 grid w-full max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {showcase.map((s) => {
              const SIcon = s.icon;
              return (
                <div
                  key={s.title}
                  className="flex flex-col items-start gap-2 rounded-lg border border-border bg-card p-4 opacity-60"
                >
                  <SIcon className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">{s.title}</p>
                  {s.subtitle && (
                    <p className="text-xs text-muted-foreground">{s.subtitle}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
