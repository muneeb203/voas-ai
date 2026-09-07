import 'server-only';
import { apiCall } from './client';

export interface EmailSettings {
  id: string;
  workspace_id: string;
  enabled: boolean;
  recipient_email: string;
  rate_limit_per_hour: number;
  created_at: string;
  updated_at: string;
}

export interface EmailLog {
  id: string;
  workspace_id: string;
  recipient_email: string;
  call_data: {
    caller_name: string;
    caller_phone: string;
    duration_seconds: number;
    transcript: string;
    inquiry: string;
    location: string;
  };
  sent_at: string;
  status: 'success' | 'failed';
  error_message: string | null;
}

export function getEmailSettings(workspaceId: string) {
  return apiCall<EmailSettings | null>(
    `/v1/workspaces/${workspaceId}/email-settings`,
    { cache: 'no-store' }
  );
}

export function updateEmailSettings(
  workspaceId: string,
  payload: { enabled: boolean }
) {
  return apiCall<EmailSettings>(
    `/v1/workspaces/${workspaceId}/email-settings`,
    {
      method: 'PATCH',
      body: payload,
    }
  );
}

export function getEmailLogs(workspaceId: string, limit: number = 50) {
  return apiCall<EmailLog[]>(
    `/v1/workspaces/${workspaceId}/email-logs?limit=${limit}`,
    { cache: 'no-store' }
  );
}
