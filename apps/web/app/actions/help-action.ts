'use server';

import { requireDashboardSession } from '@/lib/auth/workspace';
import { sendHelpMessage } from '@/lib/api/help';
import { isApiError, type HelpChatTurn } from '@/lib/types';

export async function helpChatAction(
  message: string,
  pagePath: string,
  history: HelpChatTurn[],
): Promise<{ error: string | null; reply: string | null }> {
  const session = await requireDashboardSession('/dashboard');

  const res = await sendHelpMessage(session.active.workspace_id, {
    message: message.trim(),
    page_path: pagePath,
    history: history.slice(-10),
  });

  if (isApiError(res)) {
    return { error: res.error.message, reply: null };
  }

  return { error: null, reply: res.data.reply };
}
