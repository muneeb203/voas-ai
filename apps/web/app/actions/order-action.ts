'use server';

import { revalidatePath } from 'next/cache';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { createOrder, type ManualOrderInput } from '@/lib/api/orders';
import { isApiError } from '@/lib/types';

export async function createOrderAction(body: ManualOrderInput) {
  const session = await requireDashboardSession('/orders');
  const res = await createOrder(session.active.workspace_id, body);
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath('/orders');
  return { error: null };
}
