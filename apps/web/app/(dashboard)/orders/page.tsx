import type { Metadata } from 'next';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ShoppingBag } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { listOrders } from '@/lib/api/orders';
import { isApiError, type OrderStatus } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/dashboard/page-header';
import {
  OrderStatusBadge,
  PaymentStatusBadge,
  formatCents,
} from '@/components/dashboard/order-badges';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Orders' };

const STATUSES: { id: 'all' | OrderStatus; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
  { id: 'fulfilled', label: 'Fulfilled' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await requireDashboardSession('/orders');

  const status =
    (STATUSES.find((s) => s.id === searchParams.status)?.id as 'all' | OrderStatus) ?? 'all';

  const res = await listOrders(
    session.active.workspace_id,
    status !== 'all' ? (status as OrderStatus) : undefined,
  );
  const orders = !isApiError(res) ? res.data : [];

  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="Orders"
        description="AI-taken orders from every channel."
      />

      <div className="mb-6 flex items-center gap-1 border-b border-border">
        {STATUSES.map((s) => (
          <Link
            key={s.id}
            href={s.id === 'all' ? '/orders' : `/orders?status=${s.id}`}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              status === s.id
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <ShoppingBag className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-lg font-semibold">No orders yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Once your POS is connected in V2 Sprint 4, AI-taken orders appear here and sync both
              ways with Toast / Square.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Placed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-mono text-xs hover:text-accent-700"
                      >
                        #{o.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {o.customer_name ?? o.customer_phone ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.items_json.length} item{o.items_json.length === 1 ? '' : 's'}
                    </TableCell>
                    <TableCell className="font-medium">{formatCents(o.total_cents)}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={o.payment_status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(o.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
