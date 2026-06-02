import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { getCustomer } from '@/lib/api/customers';
import { isApiError, type Order, type OrderStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/dashboard/page-header';
import { CustomerInfoCard } from '@/components/dashboard/customer-info-card';
import {
  ChannelBadge,
  ConversationStatusBadge,
} from '@/components/dashboard/conversation-badges';

export const metadata: Metadata = { title: 'Customer' };

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeProps['variant']> = {
  pending: 'secondary',
  confirmed: 'accent',
  preparing: 'accent',
  ready: 'accent',
  fulfilled: 'success',
  cancelled: 'destructive',
  refunded: 'destructive',
};

function summarizeItems(order: Order): string {
  if (!order.items_json || order.items_json.length === 0) return '—';
  const parts = order.items_json
    .slice(0, 2)
    .map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`);
  const extra = order.items_json.length - 2;
  return extra > 0 ? `${parts.join(', ')} +${extra} more` : parts.join(', ');
}

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireDashboardSession(`/customers/${params.id}`);
  const canEdit = session.active.role !== 'staff';

  const res = await getCustomer(session.active.workspace_id, params.id);
  if (isApiError(res)) {
    if (res.error.code === 'NOT_FOUND') notFound();
    throw new Error(res.error.message);
  }
  const c = res.data;

  return (
    <div className="space-y-6">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to customers
      </Link>

      <PageHeader
        eyebrow="Customer"
        title={c.name ?? c.phone ?? 'Unknown customer'}
        description={
          <span>
            {c.total_orders} order{c.total_orders === 1 ? '' : 's'} ·{' '}
            {formatCurrency(c.total_spent_cents)} lifetime
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left — recent orders */}
        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {c.recent_orders.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                No orders yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.recent_orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">
                        <Link href={`/orders/${o.id}`} className="hover:text-accent-700">
                          #{o.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                        {summarizeItems(o)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatCurrency(o.total_cents)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ORDER_STATUS_VARIANT[o.status]}>{o.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(o.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Right — info + recent conversations */}
        <div className="space-y-4">
          <CustomerInfoCard customer={c} canEdit={canEdit} />

          <Card>
            <CardHeader>
              <CardTitle>Recent conversations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {c.recent_conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No conversations yet.</p>
              ) : (
                c.recent_conversations.map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/conversations/${conv.id}`}
                    className="block rounded-lg border border-border p-3 transition-colors hover:border-accent/40"
                  >
                    <div className="flex items-center gap-2">
                      <ChannelBadge channel={conv.channel} />
                      <ConversationStatusBadge status={conv.status} />
                      <span className="ml-auto text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.started_at), { addSuffix: true })}
                      </span>
                    </div>
                    {conv.summary && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {conv.summary}
                      </p>
                    )}
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
