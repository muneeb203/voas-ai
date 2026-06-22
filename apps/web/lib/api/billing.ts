import 'server-only';
import { apiCall } from './client';
import type { CreditGrant, UsageSummary } from '@/lib/types';

export function getBillingUsage(workspaceId: string) {
  return apiCall<UsageSummary>(`/v1/workspaces/${workspaceId}/billing/usage`, {
    next: { revalidate: 60 },
  });
}

export function listBillingGrants(workspaceId: string) {
  return apiCall<CreditGrant[]>(`/v1/workspaces/${workspaceId}/billing/grants`, {
    next: { revalidate: 60 },
  });
}
