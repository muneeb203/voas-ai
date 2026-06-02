interface SentimentGaugeProps {
  sentiment: number | null;
}

function sentimentLabel(value: number): string {
  if (value < -0.6) return 'Very negative';
  if (value < -0.2) return 'Negative';
  if (value <= 0.2) return 'Neutral';
  if (value <= 0.6) return 'Positive';
  return 'Very positive';
}

export function SentimentGauge({ sentiment }: SentimentGaugeProps) {
  if (sentiment === null) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">No data yet</p>
    );
  }

  const clamped = Math.max(-1, Math.min(1, sentiment));
  // Map [-1, 1] → [0%, 100%] for the marker position.
  const position = ((clamped + 1) / 2) * 100;

  return (
    <div className="space-y-3 py-2">
      <div className="relative">
        <div className="h-3 w-full rounded-full bg-gradient-to-r from-error via-warning to-success" />
        <div
          className="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-foreground shadow"
          style={{ left: `${position}%` }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>-1.0</span>
        <span>0</span>
        <span>+1.0</span>
      </div>
      <div className="text-center">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {clamped.toFixed(2)}
        </p>
        <p className="text-sm text-muted-foreground">{sentimentLabel(clamped)}</p>
      </div>
    </div>
  );
}
