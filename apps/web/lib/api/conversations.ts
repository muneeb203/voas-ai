import 'server-only';
import { apiCall } from './client';
import type {
  Conversation,
  ConversationChannel,
  ConversationDetail,
  ConversationMessage,
  ConversationStatus,
} from '@/lib/types';

export interface ConversationCreatePayload {
  channel: ConversationChannel;
  location_id?: string;
  customer_phone?: string;
  customer_name?: string;
}

export interface ConversationListFilters {
  channel?: ConversationChannel;
  status?: ConversationStatus;
}

export function listConversations(workspaceId: string, filters: ConversationListFilters = {}) {
  const qs = new URLSearchParams();
  if (filters.channel) qs.set('channel', filters.channel);
  if (filters.status) qs.set('status', filters.status);
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiCall<Conversation[]>(
    `/v1/workspaces/${workspaceId}/conversations${suffix}`,
    { cache: 'no-store' },
  );
}

export function getConversation(workspaceId: string, conversationId: string) {
  return apiCall<ConversationDetail>(
    `/v1/workspaces/${workspaceId}/conversations/${conversationId}`,
    { cache: 'no-store' },
  );
}

export function createConversation(workspaceId: string, payload: ConversationCreatePayload) {
  return apiCall<Conversation>(`/v1/workspaces/${workspaceId}/conversations`, {
    method: 'POST',
    body: payload,
  });
}

export function appendConversationMessage(
  workspaceId: string,
  conversationId: string,
  payload: { role: 'customer' | 'agent' | 'system'; content: string; audio_url?: string },
) {
  return apiCall<ConversationMessage>(
    `/v1/workspaces/${workspaceId}/conversations/${conversationId}/messages`,
    { method: 'POST', body: payload },
  );
}

export function escalateConversation(
  workspaceId: string,
  conversationId: string,
  reason?: string,
) {
  return apiCall<{ ticket_id: string }>(
    `/v1/workspaces/${workspaceId}/conversations/${conversationId}/escalate`,
    { method: 'POST', body: { reason } },
  );
}
