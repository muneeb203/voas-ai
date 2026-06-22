'use server';

import { revalidatePath } from 'next/cache';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { generateKioskToken, revokeKioskToken } from '@/lib/api/kiosk';
import { isApiError } from '@/lib/types';

type Result = { error: string | null };

async function requireOwner() {
  const session = await requireDashboardSession('/self-order');
  if (session.active.role !== 'owner') {
    return { error: 'Only workspace owners can manage kiosk URLs.' as const, session: null };
  }
  return { error: null as null, session };
}

export async function generateKioskTokenAction(locationId: string): Promise<Result> {
  const { error, session } = await requireOwner();
  if (error) return { error };

  const res = await generateKioskToken(session.active.workspace_id, locationId);
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/self-order');
  return { error: null };
}

export async function revokeKioskTokenAction(tokenId: string): Promise<Result> {
  const { error, session } = await requireOwner();
  if (error) return { error };

  const res = await revokeKioskToken(session.active.workspace_id, tokenId);
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/self-order');
  return { error: null };
}
