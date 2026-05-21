'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireDashboardSession } from '@/lib/auth/workspace';
import {
  acceptInvitation,
  createInvitation,
  removeMember,
  revokeInvitation,
  updateMember,
} from '@/lib/api/members';
import { isApiError } from '@/lib/types';
import { WORKSPACE_ROLES, type WorkspaceRole } from '@/lib/constants';

const RoleEnum = z.enum(WORKSPACE_ROLES);

const InviteSchema = z.object({
  email: z.string().email('Enter a valid email').max(254),
  role: RoleEnum,
});

export type InviteFormState =
  | { status: 'idle' }
  | { status: 'success'; url: string; email: string }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

const IDLE: InviteFormState = { status: 'idle' };

function fieldErrorsFromZod(err: z.ZodError) {
  const result: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.');
    if (path && !result[path]) result[path] = issue.message;
  }
  return result;
}

export async function createInvitationAction(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const session = await requireDashboardSession('/team');
  if (session.active.role !== 'owner') {
    return { status: 'error', message: 'Only owners can invite teammates.' };
  }

  const parsed = InviteSchema.safeParse({
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    role: String(formData.get('role') ?? 'staff'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the fields below.',
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const res = await createInvitation(session.active.workspace_id, parsed.data);
  if (isApiError(res)) {
    return { status: 'error', message: res.error.message };
  }

  revalidatePath('/team');
  return { status: 'success', url: res.data.url, email: res.data.email };
}

export async function revokeInvitationAction(invitationId: string) {
  const session = await requireDashboardSession('/team');
  if (session.active.role !== 'owner') return { error: 'Only owners can revoke invites.' };

  const res = await revokeInvitation(session.active.workspace_id, invitationId);
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/team');
  return { error: null };
}

export async function updateMemberRoleAction(memberId: string, role: WorkspaceRole) {
  const session = await requireDashboardSession('/team');
  if (session.active.role !== 'owner') return { error: 'Only owners can change roles.' };

  const res = await updateMember(session.active.workspace_id, memberId, role);
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/team');
  return { error: null };
}

export async function removeMemberAction(memberId: string) {
  const session = await requireDashboardSession('/team');
  if (session.active.role !== 'owner') return { error: 'Only owners can remove members.' };

  const res = await removeMember(session.active.workspace_id, memberId);
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/team');
  return { error: null };
}

export async function acceptInvitationAction(token: string) {
  const res = await acceptInvitation(token);
  if (isApiError(res)) return { error: res.error.message };

  revalidatePath('/', 'layout');
  return { error: null, workspaceId: res.data.workspace_id };
}
