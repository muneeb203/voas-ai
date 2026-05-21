'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireDashboardSession } from '@/lib/auth/workspace';
import { escalateConversation } from '@/lib/api/conversations';
import { isApiError } from '@/lib/types';

export async function escalateConversationAction(conversationId: string, reason: string) {
  const session = await requireDashboardSession(`/conversations/${conversationId}`);
  const res = await escalateConversation(
    session.active.workspace_id,
    conversationId,
    reason || undefined,
  );
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath(`/conversations/${conversationId}`);
  revalidatePath('/conversations');
  redirect(`/support/${res.data.ticket_id}`);
}
