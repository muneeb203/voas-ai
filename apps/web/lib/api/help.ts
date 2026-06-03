import 'server-only';
import { apiCall } from './client';
import type { HelpChatReply, HelpChatTurn } from '@/lib/types';

export function sendHelpMessage(
  workspaceId: string,
  payload: {
    message: string;
    page_path: string;
    history: HelpChatTurn[];
  },
) {
  return apiCall<HelpChatReply>(`/v1/workspaces/${workspaceId}/help/chat`, {
    method: 'POST',
    body: payload,
    cache: 'no-store',
  });
}
