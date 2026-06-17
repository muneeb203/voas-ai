'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { updateOrderStatus } from '@/lib/api/orders';
import { isApiError } from '@/lib/types';
import type { OrderStatus } from '@/lib/types';

const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'fulfilled',
  'cancelled',
  'refunded',
];

const StatusSchema = z.object({
  status: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]),
});

export async function updateOrderStatusAction(
  orderId: string,
  status: OrderStatus,
): Promise<{ error: string | null }> {
  const session = await requireDashboardSession(`/orders/${orderId}`);
  if (session.active.role === 'staff') {
    return { error: 'Only owners or managers can change order status.' };
  }

  const parsed = StatusSchema.safeParse({ status });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid status.' };
  }

  const res = await updateOrderStatus(
    session.active.workspace_id,
    orderId,
    parsed.data.status,
  );
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
  return { error: null };
}
