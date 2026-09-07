import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, ExternalLink, Printer } from 'lucide-react';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { getOrder } from '@/lib/api/orders';
import { isApiError } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/dashboard/page-header';
import { PaymentStatusBadge, formatCents } from '@/components/dashboard/order-badges';
import { OrderStatusSelector } from '@/components/dashboard/order-status-selector';

export const metadata: Metadata = { title: 'Order' };

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const session = await requireDashboardSession(`/orders/${params.id}`);
  const currency = session.active.workspace.currency;

  const res = await getOrder(session.active.workspace_id, params.id);
  if (isApiError(res)) {
    if (res.error.code === 'NOT_FOUND') notFound();
    throw new Error(res.error.message);
  }
  const order = res.data;

  return (
    <div className="space-y-6">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to orders
      </Link>

      <PageHeader
        eyebrow={`#${order.id.slice(0, 8)}`}
        title={`${formatCents(order.total_cents, currency)} order`}
        description={
          <span className="flex items-center gap-2">
            <PaymentStatusBadge status={order.payment_status} />
            <span className="text-xs text-muted-foreground">
              · Placed {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
            </span>
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/orders/${order.id}/receipt`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Printer className="h-3.5 w-3.5" />
              Print receipt
            </Link>
            <OrderStatusSelector
              orderId={order.id}
              current={order.status}
              disabled={session.active.role === 'staff'}
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Items ({order.items_json.length})
            </h2>
            <div className="mt-4 divide-y divide-border">
              {order.items_json.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">
                      {item.quantity}× {item.name}
                    </p>
                    {item.modifiers.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {item.modifiers.map((m, j) => (
                          <li key={j}>
                            + {m.name}
                            {m.price_delta_cents !== 0 && (
                              <span className="ml-1">
                                ({m.price_delta_cents > 0 ? '+' : ''}
                                {formatCents(m.price_delta_cents, currency)})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {item.notes && (
                      <p className="mt-1 text-xs italic text-muted-foreground">"{item.notes}"</p>
                    )}
                  </div>
                  <p className="font-medium tabular-nums">
                    {formatCents(item.unit_price_cents * item.quantity, currency)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-1 border-t border-border pt-4 text-sm">
              <Totals label="Subtotal">{formatCents(order.subtotal_cents, currency)}</Totals>
              {order.tax_cents > 0 && <Totals label="Tax">{formatCents(order.tax_cents, currency)}</Totals>}
              {order.tip_cents > 0 && <Totals label="Tip">{formatCents(order.tip_cents, currency)}</Totals>}
              <Totals label="Total" bold>
                {formatCents(order.total_cents, currency)}
              </Totals>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4 text-sm">
              <Row label="Customer">
                {order.customer_name ?? order.customer_phone ?? '—'}
              </Row>
              {order.customer_phone && <Row label="Phone">{order.customer_phone}</Row>}
              <Row label="Placed">{format(new Date(order.created_at), 'MMM d, h:mm a')}</Row>
              {order.pos_order_id && (
                <Row label="POS order">
                  <code className="text-xs">{order.pos_order_id}</code>
                </Row>
              )}
              {order.notes && (
                <Row label="Notes">
                  <p className="whitespace-pre-wrap text-xs">{order.notes}</p>
                </Row>
              )}
            </CardContent>
          </Card>

          {order.conversation_id && (
            <Card>
              <CardContent className="p-4">
                <Link
                  href={`/conversations/${order.conversation_id}`}
                  className="flex items-center justify-between text-sm font-medium hover:text-accent-700"
                >
                  View originating conversation
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function Totals({
  label,
  bold,
  children,
}: {
  label: string;
  bold?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        bold ? 'flex justify-between text-base font-semibold' : 'flex justify-between text-sm'
      }
    >
      <span>{label}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}
