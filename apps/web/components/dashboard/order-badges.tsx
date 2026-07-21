import { Badge } from '@/components/ui/badge';
import type { OrderStatus, PaymentStatus } from '@/lib/types';
import { formatMoney } from '@/lib/currency';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>;
    case 'confirmed':
      return <Badge variant="accent">Confirmed</Badge>;
    case 'preparing':
      return <Badge variant="warning">Preparing</Badge>;
    case 'ready':
      return <Badge variant="success">Ready</Badge>;
    case 'fulfilled':
      return <Badge variant="success">Fulfilled</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Cancelled</Badge>;
    case 'refunded':
      return <Badge variant="destructive">Refunded</Badge>;
  }
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  switch (status) {
    case 'paid':
      return <Badge variant="success">Paid</Badge>;
    case 'unpaid':
      return <Badge variant="warning">Unpaid</Badge>;
    case 'partial_refund':
      return <Badge variant="warning">Partial refund</Badge>;
    case 'refunded':
      return <Badge variant="destructive">Refunded</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
  }
}

// Currency-aware. Pass the workspace currency; omit only where it's genuinely
// unknown (falls back to USD).
export function formatCents(cents: number, currency?: string): string {
  return formatMoney(cents, currency);
}
