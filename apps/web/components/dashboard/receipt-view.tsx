import { format } from 'date-fns';
import { formatCents } from '@/components/dashboard/order-badges';
import type { Location, Order } from '@/lib/types';

interface ReceiptViewProps {
  order: Order;
  workspaceName: string;
  location: Location | null;
}

export function ReceiptView({ order, workspaceName, location }: ReceiptViewProps) {
  const itemCount = order.items_json.reduce((sum, i) => sum + i.quantity, 0);
  const addressLine = location
    ? [location.address, location.city, location.state, location.postal_code]
        .filter(Boolean)
        .join(', ')
    : null;

  return (
    <div className="mx-auto w-full max-w-md px-6 py-8 font-mono text-sm leading-snug text-slate-900 print:py-4">
      <header className="text-center">
        <h1 className="text-xl font-bold tracking-tight">{workspaceName}</h1>
        {location?.name && (
          <p className="mt-0.5 text-xs uppercase tracking-widest text-slate-600">
            {location.name}
          </p>
        )}
        {addressLine && <p className="mt-1 text-xs text-slate-600">{addressLine}</p>}
        {location?.phone && <p className="text-xs text-slate-600">{location.phone}</p>}
      </header>

      <div className="my-4 border-t border-dashed border-slate-400" />

      <div className="flex justify-between text-xs">
        <span>Order #{order.id.slice(0, 8).toUpperCase()}</span>
        <span>{format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}</span>
      </div>
      {order.customer_name && (
        <p className="mt-1 text-xs">Customer: {order.customer_name}</p>
      )}
      {order.customer_phone && (
        <p className="text-xs">Phone: {order.customer_phone}</p>
      )}

      <div className="my-4 border-t border-dashed border-slate-400" />

      <table className="w-full">
        <tbody>
          {order.items_json.map((item, i) => (
            <tr key={i} className="align-top">
              <td className="py-1 pr-2">
                <div className="font-medium">
                  {item.quantity}× {item.name}
                </div>
                {item.modifiers.length > 0 && (
                  <ul className="mt-0.5 ml-3 text-xs text-slate-600">
                    {item.modifiers.map((m, j) => (
                      <li key={j}>
                        + {m.name}
                        {m.price_delta_cents !== 0 && (
                          <span className="ml-1">
                            ({m.price_delta_cents > 0 ? '+' : ''}
                            {formatCents(m.price_delta_cents)})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {item.notes && (
                  <p className="mt-0.5 ml-3 text-xs italic text-slate-600">
                    "{item.notes}"
                  </p>
                )}
              </td>
              <td className="py-1 text-right tabular-nums">
                {formatCents(item.unit_price_cents * item.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-4 border-t border-dashed border-slate-400" />

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal ({itemCount} items)</span>
          <span className="tabular-nums">{formatCents(order.subtotal_cents)}</span>
        </div>
        {order.tax_cents > 0 && (
          <div className="flex justify-between">
            <span>Tax</span>
            <span className="tabular-nums">{formatCents(order.tax_cents)}</span>
          </div>
        )}
        {order.tip_cents > 0 && (
          <div className="flex justify-between">
            <span>Tip</span>
            <span className="tabular-nums">{formatCents(order.tip_cents)}</span>
          </div>
        )}
        <div className="mt-2 flex justify-between border-t border-slate-400 pt-2 text-base font-bold">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatCents(order.total_cents)}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span>Payment</span>
          <span className="uppercase">{order.payment_status}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-600">
          <span>Status</span>
          <span className="uppercase">{order.status}</span>
        </div>
      </div>

      {order.notes && (
        <>
          <div className="my-4 border-t border-dashed border-slate-400" />
          <p className="whitespace-pre-wrap text-xs">{order.notes}</p>
        </>
      )}

      <div className="my-4 border-t border-dashed border-slate-400" />

      <p className="text-center text-xs text-slate-600">
        Thank you for your order!
      </p>
      <p className="mt-1 text-center text-[10px] text-slate-400">
        Powered by VOAS AI
      </p>
    </div>
  );
}
