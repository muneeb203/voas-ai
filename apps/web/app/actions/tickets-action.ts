'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireDashboardSession } from '@/lib/auth/workspace';
import {
  addTicketMessage,
  createAttachmentUploadUrl,
  createTicket,
  updateTicketStatus,
  type AttachmentRef,
  type SignedUploadResponse,
} from '@/lib/api/tickets';
import { isApiError } from '@/lib/types';

const CATEGORIES = ['billing', 'integration', 'bug', 'feature_request', 'other'] as const;
const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

const CreateSchema = z.object({
  subject: z.string().min(3, 'Subject is too short').max(200),
  body: z.string().min(3, 'Add a bit more detail').max(5000),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
});

const ReplySchema = z.object({
  body: z.string().min(1, "Message can't be empty").max(5000),
});

const AttachmentSchema = z.object({
  path: z.string().min(10),
  filename: z.string().min(1).max(200),
  content_type: z.string().min(1).max(120),
  size: z.number().int().min(1).max(10 * 1024 * 1024),
});

export type CreateTicketFormState =
  | { status: 'idle' }
  | { status: 'success'; ticketId: string }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

export type ReplyFormState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

function fieldErrorsFromZod(err: z.ZodError) {
  const result: Record<string, string> = {};
  for (const issue of err.issues) {
    const path = issue.path.join('.');
    if (path && !result[path]) result[path] = issue.message;
  }
  return result;
}

export async function createTicketAction(
  _prev: CreateTicketFormState,
  formData: FormData,
): Promise<CreateTicketFormState> {
  const session = await requireDashboardSession('/support');

  const parsed = CreateSchema.safeParse({
    subject: String(formData.get('subject') ?? '').trim(),
    body: String(formData.get('body') ?? '').trim(),
    category: String(formData.get('category') ?? 'other'),
    priority: String(formData.get('priority') ?? 'normal'),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the fields below.',
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const res = await createTicket(session.active.workspace_id, parsed.data);
  if (isApiError(res)) {
    return { status: 'error', message: res.error.message };
  }

  revalidatePath('/support');
  redirect(`/support/${res.data.id}`);
}

export async function replyToTicketAction(
  ticketId: string,
  _prev: ReplyFormState,
  formData: FormData,
): Promise<ReplyFormState> {
  const session = await requireDashboardSession(`/support/${ticketId}`);

  const parsed = ReplySchema.safeParse({
    body: String(formData.get('body') ?? '').trim(),
  });
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Please check the fields below.',
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  // Attachments arrive as a JSON-encoded hidden field.
  let attachments: AttachmentRef[] | undefined;
  const attachmentsJson = formData.get('attachments_json');
  if (typeof attachmentsJson === 'string' && attachmentsJson.length > 2) {
    try {
      const raw = JSON.parse(attachmentsJson) as unknown;
      const validated = z.array(AttachmentSchema).safeParse(raw);
      if (validated.success) attachments = validated.data;
    } catch {
      /* ignore malformed; just skip attachments */
    }
  }

  const res = await addTicketMessage(
    session.active.workspace_id,
    ticketId,
    parsed.data.body,
    attachments,
  );
  if (isApiError(res)) {
    return { status: 'error', message: res.error.message };
  }

  revalidatePath(`/support/${ticketId}`);
  revalidatePath('/support');
  return { status: 'success' };
}

export async function markTicketResolvedAction(ticketId: string) {
  const session = await requireDashboardSession(`/support/${ticketId}`);
  const res = await updateTicketStatus(session.active.workspace_id, ticketId, 'resolved');
  if (isApiError(res)) return { error: res.error.message };
  revalidatePath(`/support/${ticketId}`);
  revalidatePath('/support');
  return { error: null };
}

export async function requestAttachmentUploadAction(
  ticketId: string,
  payload: { filename: string; content_type: string; size: number },
): Promise<{ data?: SignedUploadResponse; error?: string }> {
  const session = await requireDashboardSession(`/support/${ticketId}`);
  const res = await createAttachmentUploadUrl(
    session.active.workspace_id,
    ticketId,
    payload,
  );
  if (isApiError(res)) return { error: res.error.message };
  return { data: res.data };
}
