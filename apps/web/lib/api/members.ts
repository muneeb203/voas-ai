import 'server-only';
import { apiCall } from './client';
import type { Invitation, InvitationLookup, InvitationWithUrl, Member } from '@/lib/types';
import type { WorkspaceRole } from '@/lib/constants';

export function listMembers(workspaceId: string) {
  return apiCall<Member[]>(`/v1/workspaces/${workspaceId}/members`, { cache: 'no-store' });
}

export function updateMember(workspaceId: string, memberId: string, role: WorkspaceRole) {
  return apiCall<Member>(`/v1/workspaces/${workspaceId}/members/${memberId}`, {
    method: 'PATCH',
    body: { role },
  });
}

export function removeMember(workspaceId: string, memberId: string) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}/members/${memberId}`, {
    method: 'DELETE',
  });
}

export function listInvitations(workspaceId: string) {
  return apiCall<Invitation[]>(`/v1/workspaces/${workspaceId}/invitations`, {
    cache: 'no-store',
  });
}

export function createInvitation(
  workspaceId: string,
  payload: { email: string; role: WorkspaceRole },
) {
  return apiCall<InvitationWithUrl>(`/v1/workspaces/${workspaceId}/invitations`, {
    method: 'POST',
    body: payload,
  });
}

export function revokeInvitation(workspaceId: string, invitationId: string) {
  return apiCall<null>(`/v1/workspaces/${workspaceId}/invitations/${invitationId}`, {
    method: 'DELETE',
  });
}

export function lookupInvitation(token: string) {
  return apiCall<InvitationLookup>(`/v1/invitations/by-token/${token}`, { cache: 'no-store' });
}

export function acceptInvitation(token: string) {
  return apiCall<Invitation>(`/v1/invitations/by-token/${token}/accept`, { method: 'POST' });
}
