import 'server-only';
import { apiCall } from './client';
import type { CreditGrant, UsageSummary } from '@/lib/types';

export function getBillingUsage(workspaceId: string) {
  return apiCall<UsageSummary>(`/v1/workspaces/${workspaceId}/billing/usage`, {
    cache: 'no-store',
  });
}

export function listBillingGrants(workspaceId: string) {
  return apiCall<CreditGrant[]>(`/v1/workspaces/${workspaceId}/billing/grants`, {
    cache: 'no-store',
  });
}
