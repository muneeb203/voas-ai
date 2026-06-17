import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { getOrder } from '@/lib/api/orders';
import { listLocations } from '@/lib/api/locations';
import { isApiError } from '@/lib/types';
import { ReceiptView } from '@/components/dashboard/receipt-view';
import { PrintOnMount } from '@/components/dashboard/print-on-mount';
import { ReceiptActions } from '@/components/dashboard/receipt-actions';

export const metadata: Metadata = { title: 'Receipt' };

export default async function OrderReceiptPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireDashboardSession(`/orders/${params.id}/receipt`);

  const orderRes = await getOrder(session.active.workspace_id, params.id);
  if (isApiError(orderRes)) {
    if (orderRes.error.code === 'NOT_FOUND') notFound();
    throw new Error(orderRes.error.message);
  }
  const order = orderRes.data;

  // Best-effort location lookup. If the order isn't tied to a location, or the
  // locations call fails, we still render with workspace-only branding.
  let location = null;
  if (order.location_id) {
    const locsRes = await listLocations(session.active.workspace_id);
    if (!isApiError(locsRes)) {
      location = locsRes.data.find((l) => l.id === order.location_id) ?? null;
    }
  }

  return (
    <>
      <PrintOnMount />
      <ReceiptView
        order={order}
        workspaceName={session.active.workspace.name}
        location={location}
      />
      <ReceiptActions />
    </>
  );
}
