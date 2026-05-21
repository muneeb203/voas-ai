import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, MessageCircle, Smartphone } from 'lucide-react';
import type { ConversationChannel, ConversationStatus } from '@/lib/types';

const ICONS = {
  voice: Phone,
  whatsapp: MessageSquare,
  chat: MessageCircle,
  sms: Smartphone,
} as const;

export function ChannelBadge({ channel }: { channel: ConversationChannel }) {
  const Icon = ICONS[channel];
  return (
    <Badge variant="outline" className="gap-1 capitalize">
      <Icon className="h-3 w-3" />
      {channel}
    </Badge>
  );
}

export function ConversationStatusBadge({ status }: { status: ConversationStatus }) {
  switch (status) {
    case 'active':
      return <Badge variant="accent">Active</Badge>;
    case 'ended':
      return <Badge variant="success">Ended</Badge>;
    case 'abandoned':
      return <Badge variant="warning">Abandoned</Badge>;
    case 'escalated':
      return <Badge variant="destructive">Escalated</Badge>;
  }
}

export function SentimentBadge({ sentiment }: { sentiment: number | null }) {
  if (sentiment === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (sentiment >= 0.3) return <Badge variant="success">Positive</Badge>;
  if (sentiment <= -0.3) return <Badge variant="destructive">Negative</Badge>;
  return <Badge variant="secondary">Neutral</Badge>;
}
