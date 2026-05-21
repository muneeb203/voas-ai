import { Badge } from '@/components/ui/badge';
import type { TicketPriority, TicketStatus, TicketCategory } from '@/lib/types';

export function StatusBadge({ status }: { status: TicketStatus }) {
  switch (status) {
    case 'open':
      return <Badge variant="accent">Open</Badge>;
    case 'in_progress':
      return <Badge variant="default">In progress</Badge>;
    case 'waiting_user':
      return <Badge variant="warning">Waiting on you</Badge>;
    case 'resolved':
      return <Badge variant="success">Resolved</Badge>;
    case 'closed':
      return <Badge variant="secondary">Closed</Badge>;
  }
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  switch (priority) {
    case 'low':
      return <Badge variant="secondary">Low</Badge>;
    case 'normal':
      return <Badge variant="outline">Normal</Badge>;
    case 'high':
      return <Badge variant="warning">High</Badge>;
    case 'urgent':
      return <Badge variant="destructive">Urgent</Badge>;
  }
}

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  billing: 'Billing',
  integration: 'Integration',
  bug: 'Bug',
  feature_request: 'Feature request',
  other: 'Other',
};

export function categoryLabel(category: TicketCategory | null): string {
  return category ? CATEGORY_LABELS[category] : '—';
}
