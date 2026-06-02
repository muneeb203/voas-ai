'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { updateCustomer } from '@/lib/api/customers';
import { isApiError } from '@/lib/types';

const UpdateSchema = z.object({
  name: z.string().max(200).optional(),
  email: z.string().email('Enter a valid email').max(200).optional().or(z.literal('')),
  tags: z.array(z.string().max(50)).optional(),
});

export async function updateCustomerAction(
  customerId: string,
  payload: { name?: string; email?: string; tags?: string[] },
): Promise<{ error: string | null }> {
  const session = await requireDashboardSession('/customers');
  if (session.active.role === 'staff') {
    return { error: 'Only owners or managers can edit customers.' };
  }

  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  // Normalize an empty email string to undefined so we don't send "".
  const cleaned: { name?: string; email?: string; tags?: string[] } = {
    name: parsed.data.name,
    tags: parsed.data.tags,
  };
  if (parsed.data.email) cleaned.email = parsed.data.email;

  const res = await updateCustomer(session.active.workspace_id, customerId, cleaned);
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/customers');
  revalidatePath(`/customers/${customerId}`);
  return { error: null };
}
